import dotenv from 'dotenv';
import { pool, query } from './pool.js';

dotenv.config();

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(6202406);

function jitter(base, spread = 8) {
  return Math.round(Math.max(58, Math.min(98, base + (rand() * 2 - 1) * spread)));
}

function holdings(authorised, readiness = 0.88) {
  const held = Math.round(authorised * (0.92 + rand() * 0.08));
  const serviceable = Math.max(
    0,
    Math.round(held * Math.min(0.98, readiness - 0.04 + rand() * 0.1))
  );
  const deployed = Math.round(serviceable * (0.5 + rand() * 0.4));
  const inMaintenance = Math.max(0, held - serviceable);
  return { authorised, held, serviceable, deployed, in_maintenance: inMaintenance };
}

function personnel(authorised) {
  const present = Math.round(authorised * (0.86 + rand() * 0.12));
  return { personnel_authorised: authorised, personnel_present: present };
}

/** Approximate garrison / deployment anchors (synthetic training coords). */
const LOCATION_COORDS = {
  Gujranwala: { lat: 32.1877, lng: 74.1945 },
  Mangla: { lat: 33.142, lng: 73.639 },
  Dispersed: { lat: 32.55, lng: 73.95 },
};

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function coordsFor(location, code) {
  const base = LOCATION_COORDS[location] || LOCATION_COORDS.Gujranwala;
  const h = hashCode(code || 'ORG');
  const lat = base.lat + ((h % 1000) / 1000 - 0.5) * 0.09;
  const lng = base.lng + ((((h / 1000) | 0) % 1000) / 1000 - 0.5) * 0.09;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

async function insertOrg(org) {
  const geo =
    org.lat != null && org.lng != null
      ? { lat: org.lat, lng: org.lng }
      : coordsFor(org.location, org.code);

  const result = await query(
    `INSERT INTO orgs (
       parent_id, code, name, short_name, org_level, arm, location,
       wartime_only, readiness_pct, personnel_authorised, personnel_present,
       status, notes, sort_order, lat, lng, position_reported_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
     RETURNING id`,
    [
      org.parent_id ?? null,
      org.code,
      org.name,
      org.short_name,
      org.org_level,
      org.arm,
      org.location ?? null,
      Boolean(org.wartime_only),
      org.readiness_pct ?? jitter(88),
      org.personnel_authorised ?? 0,
      org.personnel_present ?? 0,
      org.status ?? 'operational',
      org.notes ?? null,
      org.sort_order ?? 0,
      geo.lat,
      geo.lng,
    ]
  );
  return result.rows[0].id;
}

async function insertEquipment(orgId, items) {
  for (const [i, item] of items.entries()) {
    const h = holdings(item.authorised, item.readiness ?? 0.88);
    await query(
      `INSERT INTO equipment (
         org_id, category, nomenclature, role,
         authorised, held, serviceable, deployed, in_maintenance, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        orgId,
        item.category,
        item.nomenclature,
        item.role ?? null,
        h.authorised,
        h.held,
        h.serviceable,
        h.deployed,
        h.in_maintenance,
        i,
      ]
    );
  }
}

async function seedReadinessHistory(orgId, base) {
  for (let day = 13; day >= 0; day -= 1) {
    const sampledAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO readiness_samples (
         org_id, sampled_at, readiness_pct, personnel_present,
         serviceable_major, fuel_days, ammo_days
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        orgId,
        sampledAt.toISOString(),
        jitter(base, 6),
        Math.round(400 + rand() * 200),
        Math.round(20 + rand() * 30),
        Number((3 + rand() * 5).toFixed(1)),
        Number((4 + rand() * 6).toFixed(1)),
      ]
    );
  }
}

async function insertEvents(orgId, events) {
  for (const event of events) {
    await query(
      `INSERT INTO operational_events (org_id, severity, title, detail, occurred_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        orgId,
        event.severity,
        event.title,
        event.detail,
        new Date(Date.now() - (event.hoursAgo || 6) * 3600 * 1000).toISOString(),
      ]
    );
  }
}

function armourBnEquipment() {
  return [
    { category: 'MBT', nomenclature: 'VT-4 / Haider', role: 'Main battle tank', authorised: 44, readiness: 0.9 },
    { category: 'MBT', nomenclature: 'Al-Khalid-I', role: 'Main battle tank', authorised: 14, readiness: 0.86 },
    { category: 'APC', nomenclature: 'M113P / Talha', role: 'Armoured personnel carrier', authorised: 18, readiness: 0.88 },
    { category: 'APC', nomenclature: 'HIT Sakb', role: 'Command APC', authorised: 4, readiness: 0.91 },
    { category: 'Support', nomenclature: 'ARV / recovery', role: 'Recovery', authorised: 4, readiness: 0.84 },
  ];
}

function mechBnEquipment() {
  return [
    { category: 'APC', nomenclature: 'M113A2 / VCC-2', role: 'Mechanised infantry APC', authorised: 52, readiness: 0.87 },
    { category: 'APC', nomenclature: 'HIT Talha / Saad', role: 'APC / IFV', authorised: 12, readiness: 0.89 },
    { category: 'AT', nomenclature: 'Baktar Shikan (on Maaz)', role: 'Anti-tank', authorised: 8, readiness: 0.9 },
    { category: 'Support', nomenclature: 'Mortars 120mm', role: 'Indirect fire', authorised: 6, readiness: 0.92 },
  ];
}

function adBatteryEquipment() {
  return [
    { category: 'SHORAD', nomenclature: 'RBS 70 (APC-mounted)', role: 'Short-range AD', authorised: 12, readiness: 0.9 },
    { category: 'Radar', nomenclature: 'Giraffe AMB', role: 'Surveillance radar', authorised: 2, readiness: 0.93 },
    { category: 'SHORAD', nomenclature: 'HIT Mouz AD APC', role: 'AD carrier', authorised: 6, readiness: 0.88 },
    { category: 'Support', nomenclature: 'Early-warning nodes', role: 'C2 node', authorised: 4, readiness: 0.91 },
  ];
}

function engineerEquipment() {
  return [
    { category: 'Bridging', nomenclature: 'Type 79A ribbon bridge sets', role: 'Wet gap crossing', authorised: 6, readiness: 0.9 },
    { category: 'Bridging', nomenclature: 'Al-Khalid / M47 AVLB', role: 'Armoured bridge layer', authorised: 4, readiness: 0.86 },
    { category: 'Bridging', nomenclature: 'AM 50B bridge layers', role: 'Tactical bridging', authorised: 3, readiness: 0.88 },
    { category: 'Mobility', nomenclature: 'Assault trackway sets', role: 'Soft-ground mobility', authorised: 8, readiness: 0.91 },
    { category: 'Counter-mine', nomenclature: 'Troll Anti-Mine (TAM)', role: 'Mine clearance', authorised: 6, readiness: 0.85 },
    { category: 'Counter-mine', nomenclature: 'Mine dispensing / RDS', role: 'Obstacle creation', authorised: 4, readiness: 0.87 },
  ];
}

function signalsEquipment() {
  return [
    { category: 'C2', nomenclature: 'Division / brigade radio nodes', role: 'Combat net radio hub', authorised: 18, readiness: 0.92 },
    { category: 'C2', nomenclature: 'SATCOM terminals', role: 'Beyond-line-of-sight', authorised: 6, readiness: 0.9 },
    { category: 'C2', nomenclature: 'Field exchange / VoIP nodes', role: 'Static C2', authorised: 8, readiness: 0.93 },
    { category: 'EW', nomenclature: 'Spectrum monitoring sets', role: 'Electromagnetic awareness', authorised: 4, readiness: 0.86 },
    { category: 'Transport', nomenclature: 'Signal shelter vehicles', role: 'Mobile node', authorised: 14, readiness: 0.89 },
  ];
}

function artilleryEquipment() {
  return [
    { category: 'SP Artillery', nomenclature: 'M109A2 155mm SPH', role: 'Self-propelled howitzer', authorised: 18, readiness: 0.88 },
    { category: 'C2', nomenclature: 'Artillery C2 / FO vehicles', role: 'Fire direction', authorised: 8, readiness: 0.9 },
    { category: 'Ammo', nomenclature: 'Ammo resupply vehicles', role: 'Sustainment', authorised: 12, readiness: 0.87 },
    { category: 'UAV', nomenclature: 'Tactical observation UAVs', role: 'Target acquisition', authorised: 4, readiness: 0.84 },
  ];
}

function aviationEquipment() {
  return [
    { category: 'Aviation', nomenclature: 'Utility / scout helicopters (detached)', role: 'Recce / lift', authorised: 8, readiness: 0.82 },
    { category: 'Aviation', nomenclature: 'UAV flight (corps attached)', role: 'ISR', authorised: 6, readiness: 0.85 },
    { category: 'Support', nomenclature: 'Forward arming / refuel points', role: 'FARP kits', authorised: 3, readiness: 0.9 },
  ];
}

function recceEquipment() {
  return [
    { category: 'Recce', nomenclature: 'Light AFV / scout cars', role: 'Screening', authorised: 32, readiness: 0.89 },
    { category: 'APC', nomenclature: 'M113 recce variants', role: 'Armoured recce', authorised: 16, readiness: 0.88 },
    { category: 'Sensors', nomenclature: 'Ground surveillance radars', role: 'Surveillance', authorised: 6, readiness: 0.9 },
    { category: 'UAV', nomenclature: 'Mini-UAV sections', role: 'Organic ISR', authorised: 8, readiness: 0.86 },
  ];
}

function ascEquipment() {
  return [
    { category: 'Fuel', nomenclature: 'POL tankers', role: 'Fuel distribution', authorised: 28, readiness: 0.9 },
    { category: 'Transport', nomenclature: 'General transport trucks', role: 'Lift', authorised: 60, readiness: 0.91 },
    { category: 'Ammo', nomenclature: 'Ammunition carriers', role: 'Class V', authorised: 22, readiness: 0.88 },
    { category: 'Water', nomenclature: 'Water bowsers', role: 'Class I', authorised: 12, readiness: 0.93 },
  ];
}

function ordnanceEquipment() {
  return [
    { category: 'Ammo', nomenclature: 'Divisional ammo points (capacity lots)', role: 'Class V holdings', authorised: 12, readiness: 0.94 },
    { category: 'Ammo', nomenclature: 'Tank / APC ammo modules', role: 'Armour ammo', authorised: 40, readiness: 0.9 },
    { category: 'Ammo', nomenclature: 'Artillery ammo modules', role: 'Indirect fire ammo', authorised: 24, readiness: 0.89 },
    { category: 'Stores', nomenclature: 'Ordnance workshops (mobile)', role: 'Ammo tech', authorised: 4, readiness: 0.92 },
  ];
}

function emeEquipment() {
  return [
    { category: 'Recovery', nomenclature: 'Heavy ARVs', role: 'Tank recovery', authorised: 10, readiness: 0.86 },
    { category: 'Workshops', nomenclature: '1st / 2nd line workshops', role: 'Field repair', authorised: 6, readiness: 0.9 },
    { category: 'Recovery', nomenclature: 'Wheel recovery vehicles', role: 'Soft-skin recovery', authorised: 8, readiness: 0.91 },
    { category: 'Stores', nomenclature: 'Critical spares packs (MBT/APC)', role: 'Spares', authorised: 20, readiness: 0.87 },
  ];
}

function medicalEquipment() {
  return [
    { category: 'Medical', nomenclature: 'Field ambulance vehicles', role: 'CASEVAC', authorised: 24, readiness: 0.93 },
    { category: 'Medical', nomenclature: 'Field hospital beds', role: 'Role 2 care', authorised: 40, readiness: 0.95 },
    { category: 'Medical', nomenclature: 'Surgical teams (sets)', role: 'Damage control surgery', authorised: 4, readiness: 0.92 },
    { category: 'Medical', nomenclature: 'Blood / cold-chain units', role: 'Medical logistics', authorised: 6, readiness: 0.94 },
  ];
}

async function addBn(parentId, def, equipmentFn) {
  const p = personnel(def.strength ?? 520);
  const id = await insertOrg({
    parent_id: parentId,
    code: def.code,
    name: def.name,
    short_name: def.short_name,
    org_level: 'battalion',
    arm: def.arm,
    location: def.location,
    wartime_only: def.wartime_only,
    readiness_pct: jitter(def.readiness ?? 87),
    ...p,
    notes: def.notes,
    sort_order: def.sort_order,
  });
  await insertEquipment(id, equipmentFn());
  await seedReadinessHistory(id, def.readiness ?? 87);
  await insertEvents(id, def.events ?? []);
  return id;
}

async function seed() {
  console.log('Resetting operational data…');
  await query(
    'TRUNCATE location_events, operational_events, readiness_samples, equipment, orgs RESTART IDENTITY CASCADE'
  );

  const divP = personnel(14800);
  const divisionId = await insertOrg({
    code: '6ARMD-DIV',
    name: 'HQ 6 Armoured Division',
    short_name: '6 Armd Div',
    org_level: 'division',
    arm: 'armour',
    location: 'Gujranwala',
    readiness_pct: 86,
    ...divP,
    notes: 'Shahsawar — striking offensive formation under I Strike Corps. Synthetic training dataset for FieldPulse.',
    sort_order: 0,
  });
  await seedReadinessHistory(divisionId, 86);
  await insertEvents(divisionId, [
    {
      severity: 'info',
      title: 'Division readiness consolidation complete',
      detail: 'Brigade returns submitted; ECHO-silent units flagged for follow-up.',
      hoursAgo: 2,
    },
    {
      severity: 'warn',
      title: '8 Armd Bde Gp wartime attachment status',
      detail: 'Mangla-based brigade group held at higher readiness for corps attachment drills.',
      hoursAgo: 18,
    },
  ]);

  // --- Armoured brigades ---
  const brigades = [
    {
      code: '7ARMD-BDE',
      name: '7th Armoured Brigade',
      short_name: '7 Armd Bde',
      location: 'Gujranwala',
      sort_order: 10,
      battalions: [
        { code: '15CAV', name: '15 Cavalry', short_name: '15 Cav', arm: 'armour', strength: 580, eq: armourBnEquipment },
        { code: '22CAV', name: '22 Cavalry', short_name: '22 Cav', arm: 'armour', strength: 575, eq: armourBnEquipment },
        { code: '3FF', name: '3 Frontier Force (Mech)', short_name: '3 FF', arm: 'mechanised', strength: 640, eq: mechBnEquipment },
        {
          code: '7BDE-SPT',
          name: '7 Brigade Support Squadron',
          short_name: '7 Bde Spt',
          arm: 'support',
          strength: 220,
          eq: () => [
            { category: 'Support', nomenclature: 'Bde HQ C2 vehicles', role: 'Command', authorised: 8, readiness: 0.92 },
            { category: 'APC', nomenclature: 'Escort APCs', role: 'Protection', authorised: 10, readiness: 0.9 },
            { category: 'Fuel', nomenclature: 'Bde POL section', role: 'Fuel', authorised: 6, readiness: 0.91 },
          ],
        },
      ],
    },
    {
      code: '9ARMD-BDE',
      name: '9th Armoured Brigade (Asad-e-Ilahi)',
      short_name: '9 Armd Bde',
      location: 'Gujranwala',
      sort_order: 20,
      battalions: [
        { code: '10CAV', name: '10 Cavalry', short_name: '10 Cav', arm: 'armour', strength: 585, eq: armourBnEquipment },
        { code: '31CAV', name: '31 Cavalry', short_name: '31 Cav', arm: 'armour', strength: 570, eq: armourBnEquipment },
        { code: '11FF', name: '11 Frontier Force (Mech)', short_name: '11 FF', arm: 'mechanised', strength: 650, eq: mechBnEquipment },
        {
          code: '9BDE-SPT',
          name: '9 Brigade Support Squadron',
          short_name: '9 Bde Spt',
          arm: 'support',
          strength: 230,
          eq: () => [
            { category: 'Support', nomenclature: 'Bde HQ C2 vehicles', role: 'Command', authorised: 8, readiness: 0.93 },
            { category: 'APC', nomenclature: 'Escort APCs', role: 'Protection', authorised: 10, readiness: 0.89 },
            { category: 'Ammo', nomenclature: 'Bde ammo section', role: 'Class V', authorised: 8, readiness: 0.9 },
          ],
        },
      ],
    },
    {
      code: '11ARMD-BDE',
      name: '11th Armoured Brigade',
      short_name: '11 Armd Bde',
      location: 'Gujranwala',
      sort_order: 30,
      battalions: [
        { code: '13CAV', name: '13 Cavalry', short_name: '13 Cav', arm: 'armour', strength: 560, eq: armourBnEquipment },
        { code: '28CAV', name: '28 Cavalry', short_name: '28 Cav', arm: 'armour', strength: 555, eq: armourBnEquipment },
        { code: '7PUNJAB', name: '7 Punjab (Mech)', short_name: '7 Punjab', arm: 'mechanised', strength: 645, eq: mechBnEquipment },
        {
          code: '11BDE-SPT',
          name: '11 Brigade Support Squadron',
          short_name: '11 Bde Spt',
          arm: 'support',
          strength: 225,
          eq: () => [
            { category: 'Support', nomenclature: 'Bde HQ C2 vehicles', role: 'Command', authorised: 8, readiness: 0.9 },
            { category: 'Recovery', nomenclature: 'Bde recovery section', role: 'ARV', authorised: 4, readiness: 0.86 },
          ],
        },
      ],
    },
    {
      code: '8ARMD-BDE',
      name: '8th Armoured Brigade Group',
      short_name: '8 Armd Bde Gp',
      location: 'Mangla',
      wartime_only: true,
      sort_order: 40,
      notes: 'Wartime attachment; normally under corps control.',
      battalions: [
        { code: '5CAV', name: '5 Cavalry', short_name: '5 Cav', arm: 'armour', strength: 540, wartime_only: true, eq: armourBnEquipment },
        { code: '6CAV', name: '6 Cavalry', short_name: '6 Cav', arm: 'armour', strength: 535, wartime_only: true, eq: armourBnEquipment },
        { code: '2BALOCH', name: '2 Baloch (Mech)', short_name: '2 Baloch', arm: 'mechanised', strength: 620, wartime_only: true, eq: mechBnEquipment },
      ],
    },
  ];

  for (const bde of brigades) {
    const bdeP = personnel(2200);
    const bdeId = await insertOrg({
      parent_id: divisionId,
      code: bde.code,
      name: bde.name,
      short_name: bde.short_name,
      org_level: 'brigade',
      arm: 'armour',
      location: bde.location,
      wartime_only: bde.wartime_only,
      readiness_pct: jitter(85),
      ...bdeP,
      notes: bde.notes,
      sort_order: bde.sort_order,
    });
    await seedReadinessHistory(bdeId, 85);
    for (const [i, bn] of bde.battalions.entries()) {
      await addBn(
        bdeId,
        {
          ...bn,
          location: bde.location,
          sort_order: i + 1,
          events: [
            {
              severity: 'info',
              title: `${bn.short_name} equipment parade complete`,
              detail: 'Serviceability figures updated in ORBAT holdings.',
              hoursAgo: 4 + i,
            },
          ],
        },
        bn.eq
      );
    }
  }

  // --- 106 Air Defence Brigade ---
  const adP = personnel(1600);
  const adId = await insertOrg({
    parent_id: divisionId,
    code: '106AD-BDE',
    name: '106 Air Defence Brigade',
    short_name: '106 AD Bde',
    org_level: 'brigade',
    arm: 'air_defence',
    location: 'Gujranwala',
    readiness_pct: jitter(88),
    ...adP,
    sort_order: 50,
  });
  await seedReadinessHistory(adId, 88);
  for (const [i, bat] of [
    { code: '106AD-BTY-A', name: '106 AD Battery A', short_name: 'AD Bty A' },
    { code: '106AD-BTY-B', name: '106 AD Battery B', short_name: 'AD Bty B' },
    { code: '106AD-BTY-C', name: '106 AD Battery C', short_name: 'AD Bty C' },
  ].entries()) {
    await addBn(
      adId,
      {
        code: bat.code,
        name: bat.name,
        short_name: bat.short_name,
        arm: 'air_defence',
        location: 'Gujranwala',
        strength: 280,
        sort_order: i + 1,
      },
      adBatteryEquipment
    );
  }

  // --- Div Artillery ---
  const artyP = personnel(1800);
  const artyId = await insertOrg({
    parent_id: divisionId,
    code: '6ARMD-ARTY',
    name: '6 Armoured Division Artillery',
    short_name: 'Div Arty',
    org_level: 'group',
    arm: 'artillery',
    location: 'Gujranwala',
    readiness_pct: jitter(84),
    ...artyP,
    notes: 'Artillery grouping equivalent to a brigade.',
    sort_order: 60,
  });
  await seedReadinessHistory(artyId, 84);
  for (const [i, r] of [
    { code: '45SP', name: '45 SP Field Regiment', short_name: '45 SP' },
    { code: '46SP', name: '46 SP Field Regiment', short_name: '46 SP' },
    { code: '47SP', name: '47 SP Field Regiment', short_name: '47 SP' },
  ].entries()) {
    await addBn(
      artyId,
      {
        code: r.code,
        name: r.name,
        short_name: r.short_name,
        arm: 'artillery',
        location: 'Gujranwala',
        strength: 480,
        sort_order: i + 1,
      },
      artilleryEquipment
    );
  }

  // --- Div Aviation (wartime) ---
  const avP = personnel(420);
  const avId = await insertOrg({
    parent_id: divisionId,
    code: '6ARMD-AVN',
    name: '6 Armoured Div Aviation Air Brigade',
    short_name: 'Div Avn',
    org_level: 'brigade',
    arm: 'aviation',
    location: 'Dispersed',
    wartime_only: true,
    readiness_pct: jitter(80),
    ...avP,
    notes: 'Wartime only; units ordinarily dispersed.',
    sort_order: 70,
  });
  await seedReadinessHistory(avId, 80);
  await addBn(
    avId,
    {
      code: '6AVN-SQN',
      name: '6 Div Aviation Squadron (Composite)',
      short_name: 'Avn Sqn',
      arm: 'aviation',
      location: 'Dispersed',
      wartime_only: true,
      strength: 180,
      sort_order: 1,
    },
    aviationEquipment
  );

  // --- Division Troops ---
  const troopsP = personnel(2100);
  const troopsId = await insertOrg({
    parent_id: divisionId,
    code: '6ARMD-TPS',
    name: '6 Armoured Division Troops',
    short_name: 'Div Troops',
    org_level: 'group',
    arm: 'support',
    location: 'Gujranwala',
    readiness_pct: jitter(87),
    ...troopsP,
    notes: 'Engineers, signals, recce and related divisional troops.',
    sort_order: 80,
  });
  await seedReadinessHistory(troopsId, 87);

  await addBn(
    troopsId,
    {
      code: '313AE',
      name: '313 Assault Engineers Battalion',
      short_name: '313 AE',
      arm: 'engineers',
      location: 'Gujranwala',
      strength: 540,
      sort_order: 1,
      events: [
        {
          severity: 'info',
          title: 'Ribbon bridge rehearsal',
          detail: 'Type 79A wet-gap drill completed on local water obstacle.',
          hoursAgo: 30,
        },
      ],
    },
    engineerEquipment
  );
  await addBn(
    troopsId,
    {
      code: '314AE',
      name: '314 Assault Engineers Battalion',
      short_name: '314 AE',
      arm: 'engineers',
      location: 'Gujranwala',
      strength: 535,
      sort_order: 2,
    },
    engineerEquipment
  );
  await addBn(
    troopsId,
    {
      code: '6SIG',
      name: '6 Armoured Division Signal Battalion',
      short_name: '6 Sig Bn',
      arm: 'signals',
      location: 'Gujranwala',
      strength: 480,
      sort_order: 3,
      events: [
        {
          severity: 'warn',
          title: 'SATCOM terminal maintenance',
          detail: 'Two beyond-line-of-sight terminals in scheduled maintenance window.',
          hoursAgo: 8,
        },
      ],
    },
    signalsEquipment
  );
  await addBn(
    troopsId,
    {
      code: '6RECCE',
      name: '6 Armoured Division Recce Regiment',
      short_name: '6 Recce',
      arm: 'recce',
      location: 'Gujranwala',
      strength: 520,
      sort_order: 4,
    },
    recceEquipment
  );

  // --- Division Logistics ---
  const logP = personnel(1900);
  const logId = await insertOrg({
    parent_id: divisionId,
    code: '6ARMD-LOG',
    name: '6 Armoured Division Logistics',
    short_name: 'Div Log',
    org_level: 'group',
    arm: 'logistics',
    location: 'Gujranwala',
    readiness_pct: jitter(89),
    ...logP,
    notes: 'ASC, Ordnance, EME and Medical.',
    sort_order: 90,
  });
  await seedReadinessHistory(logId, 89);

  await addBn(
    logId,
    {
      code: '6ASC',
      name: '6 Div ASC Battalion',
      short_name: 'ASC Bn',
      arm: 'asc',
      location: 'Gujranwala',
      strength: 520,
      sort_order: 1,
    },
    ascEquipment
  );
  await addBn(
    logId,
    {
      code: '6ORD',
      name: '6 Div Ordnance Battalion',
      short_name: 'Ord Bn',
      arm: 'ordnance',
      location: 'Gujranwala',
      strength: 410,
      sort_order: 2,
    },
    ordnanceEquipment
  );
  await addBn(
    logId,
    {
      code: '6EME',
      name: '6 Div EME Battalion',
      short_name: 'EME Bn',
      arm: 'eme',
      location: 'Gujranwala',
      strength: 460,
      sort_order: 3,
      events: [
        {
          severity: 'info',
          title: 'MBT powerpack exchange',
          detail: 'Three VT-4/Haider powerpacks rotated through 2nd-line workshop.',
          hoursAgo: 12,
        },
      ],
    },
    emeEquipment
  );
  await addBn(
    logId,
    {
      code: '6MED',
      name: '6 Div Medical Battalion',
      short_name: 'Med Bn',
      arm: 'medical',
      location: 'Gujranwala',
      strength: 380,
      sort_order: 4,
    },
    medicalEquipment
  );

  const counts = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM orgs) AS orgs,
       (SELECT COUNT(*)::int FROM equipment) AS equipment,
       (SELECT COUNT(*)::int FROM readiness_samples) AS samples,
       (SELECT COUNT(*)::int FROM operational_events) AS events`
  );
  console.log('Seed complete:', counts.rows[0]);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
