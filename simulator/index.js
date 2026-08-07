import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS) || 3000;
const seedOnly = process.argv.includes('--seed-only');

const UNITS = [
  { callsign: 'ALPHA-1', unit_type: 'ground', latitude: 60.1699, longitude: 24.9384 },
  { callsign: 'BRAVO-2', unit_type: 'aerial', latitude: 60.2055, longitude: 24.6559 },
  { callsign: 'CHARLIE-3', unit_type: 'ground', latitude: 60.4518, longitude: 22.2666 },
  { callsign: 'DELTA-4', unit_type: 'maritime', latitude: 60.1608, longitude: 24.9550 },
  { callsign: 'ECHO-5', unit_type: 'aerial', latitude: 61.4978, longitude: 23.7610 },
];

const state = new Map(
  UNITS.map((u) => [
    u.callsign,
    {
      ...u,
      battery_pct: 70 + Math.random() * 30,
      signal_strength: 0.6 + Math.random() * 0.4,
      altitude_m: u.unit_type === 'aerial' ? 120 + Math.random() * 80 : 0,
      speed_mps: 1 + Math.random() * 8,
      heading_deg: Math.random() * 360,
      status: 'active',
      silent: false,
    },
  ])
);

// Occasionally mark one unit silent to demo offline queries
state.get('ECHO-5').silent = true;
state.get('ECHO-5').status = 'degraded';

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function seedUnits() {
  for (const unit of UNITS) {
    await postJson('/units', unit);
    console.log(`Seeded unit ${unit.callsign}`);
  }
}

function stepUnit(unit) {
  if (unit.silent) {
    return null;
  }

  unit.heading_deg = (unit.heading_deg + (Math.random() * 20 - 10) + 360) % 360;
  const rad = (unit.heading_deg * Math.PI) / 180;
  const drift = 0.0003 + Math.random() * 0.0004;
  unit.latitude += Math.cos(rad) * drift;
  unit.longitude += Math.sin(rad) * drift;
  unit.battery_pct = Math.max(5, unit.battery_pct - Math.random() * 0.4);
  unit.signal_strength = Math.min(1, Math.max(0.1, unit.signal_strength + (Math.random() * 0.1 - 0.05)));
  unit.speed_mps = Math.max(0, unit.speed_mps + (Math.random() * 2 - 1));
  if (unit.unit_type === 'aerial') {
    unit.altitude_m = Math.max(40, unit.altitude_m + (Math.random() * 10 - 5));
  }
  if (unit.battery_pct < 20) {
    unit.status = 'degraded';
  }

  return {
    callsign: unit.callsign,
    unit_type: unit.unit_type,
    battery_pct: Number(unit.battery_pct.toFixed(1)),
    signal_strength: Number(unit.signal_strength.toFixed(2)),
    latitude: Number(unit.latitude.toFixed(6)),
    longitude: Number(unit.longitude.toFixed(6)),
    altitude_m: Number(unit.altitude_m.toFixed(1)),
    speed_mps: Number(unit.speed_mps.toFixed(2)),
    heading_deg: Number(unit.heading_deg.toFixed(1)),
    status: unit.status,
    payload: { source: 'simulator' },
  };
}

async function tick() {
  for (const unit of state.values()) {
    const reading = stepUnit(unit);
    if (!reading) {
      console.log(`Skipping silent unit ${unit.callsign}`);
      continue;
    }
    await postJson('/telemetry', reading);
    console.log(`Telemetry ${reading.callsign} battery=${reading.battery_pct}%`);
  }
}

async function main() {
  console.log(`FieldPulse simulator → ${API_URL}`);
  await seedUnits();
  if (seedOnly) {
    console.log('Seed only complete');
    return;
  }

  await tick();
  setInterval(() => {
    tick().catch((err) => console.error(err.message));
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
