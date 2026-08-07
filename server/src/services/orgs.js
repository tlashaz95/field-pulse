import { query } from '../db/pool.js';

export async function getDivision() {
  const result = await query(
    `SELECT * FROM orgs WHERE org_level = 'division' ORDER BY sort_order LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function getOrgById(id) {
  const result = await query(`SELECT * FROM orgs WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function getOrgByCode(code) {
  const result = await query(`SELECT * FROM orgs WHERE code = $1`, [code]);
  return result.rows[0] || null;
}

export async function getChildren(parentId) {
  const result = await query(
    `SELECT * FROM orgs WHERE parent_id = $1 ORDER BY sort_order, short_name`,
    [parentId]
  );
  return result.rows;
}

export async function getAncestors(orgId) {
  const result = await query(
    `WITH RECURSIVE chain AS (
       SELECT * FROM orgs WHERE id = $1
       UNION ALL
       SELECT o.* FROM orgs o
       JOIN chain c ON o.id = c.parent_id
     )
     SELECT * FROM chain ORDER BY sort_order`,
    [orgId]
  );
  return result.rows.reverse();
}

export async function getDescendantIds(orgId) {
  const result = await query(
    `WITH RECURSIVE tree AS (
       SELECT id FROM orgs WHERE id = $1
       UNION ALL
       SELECT o.id FROM orgs o JOIN tree t ON o.parent_id = t.id
     )
     SELECT id FROM tree`,
    [orgId]
  );
  return result.rows.map((r) => r.id);
}

export async function getEquipmentForOrg(orgId, { includeDescendants = false } = {}) {
  if (!includeDescendants) {
    const result = await query(
      `SELECT * FROM equipment WHERE org_id = $1 ORDER BY sort_order, category, nomenclature`,
      [orgId]
    );
    return result.rows;
  }

  const result = await query(
    `WITH RECURSIVE tree AS (
       SELECT id FROM orgs WHERE id = $1
       UNION ALL
       SELECT o.id FROM orgs o JOIN tree t ON o.parent_id = t.id
     )
     SELECT e.*, org.short_name AS org_short_name, org.code AS org_code, org.arm AS org_arm
     FROM equipment e
     JOIN orgs org ON org.id = e.org_id
     WHERE e.org_id IN (SELECT id FROM tree)
     ORDER BY org.sort_order, e.sort_order, e.category`,
    [orgId]
  );
  return result.rows;
}

export async function summarizeEquipment(orgId) {
  const result = await query(
    `WITH RECURSIVE tree AS (
       SELECT id FROM orgs WHERE id = $1
       UNION ALL
       SELECT o.id FROM orgs o JOIN tree t ON o.parent_id = t.id
     )
     SELECT category,
            SUM(authorised)::int AS authorised,
            SUM(held)::int AS held,
            SUM(serviceable)::int AS serviceable,
            SUM(deployed)::int AS deployed,
            SUM(in_maintenance)::int AS in_maintenance
     FROM equipment
     WHERE org_id IN (SELECT id FROM tree)
     GROUP BY category
     ORDER BY category`,
    [orgId]
  );
  return result.rows;
}

export async function getReadinessSeries(orgId, days = 14) {
  const result = await query(
    `SELECT sampled_at, readiness_pct, fuel_days, ammo_days, serviceable_major
     FROM readiness_samples
     WHERE org_id = $1
       AND sampled_at >= NOW() - ($2 || ' days')::interval
     ORDER BY sampled_at ASC`,
    [orgId, String(days)]
  );
  return result.rows;
}

export async function getEvents(orgId, { includeDescendants = true, limit = 20 } = {}) {
  if (!includeDescendants) {
    const result = await query(
      `SELECT e.*, o.short_name AS org_short_name
       FROM operational_events e
       JOIN orgs o ON o.id = e.org_id
       WHERE e.org_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return result.rows;
  }

  const result = await query(
    `WITH RECURSIVE tree AS (
       SELECT id FROM orgs WHERE id = $1
       UNION ALL
       SELECT o.id FROM orgs o JOIN tree t ON o.parent_id = t.id
     )
     SELECT e.*, o.short_name AS org_short_name
     FROM operational_events e
     JOIN orgs o ON o.id = e.org_id
     WHERE e.org_id IN (SELECT id FROM tree)
     ORDER BY occurred_at DESC
     LIMIT $2`,
    [orgId, limit]
  );
  return result.rows;
}

export async function getChildReadiness(parentId) {
  const result = await query(
    `SELECT id, code, short_name, name, org_level, arm, location, wartime_only,
            readiness_pct, personnel_authorised, personnel_present, status
     FROM orgs
     WHERE parent_id = $1
     ORDER BY sort_order`,
    [parentId]
  );
  return result.rows;
}

export async function buildDashboard(orgId) {
  const org = await getOrgById(orgId);
  if (!org) return null;

  const [ancestors, children, equipmentSummary, equipmentDetail, readiness, events] =
    await Promise.all([
      getAncestors(orgId),
      getChildReadiness(orgId),
      summarizeEquipment(orgId),
      getEquipmentForOrg(orgId, {
        includeDescendants: org.org_level !== 'battalion',
      }),
      getReadinessSeries(orgId),
      getEvents(orgId),
    ]);

  const personnelFill =
    org.personnel_authorised > 0
      ? Math.round((org.personnel_present / org.personnel_authorised) * 100)
      : 0;

  const totals = equipmentSummary.reduce(
    (acc, row) => {
      acc.authorised += row.authorised;
      acc.held += row.held;
      acc.serviceable += row.serviceable;
      acc.deployed += row.deployed;
      acc.in_maintenance += row.in_maintenance;
      return acc;
    },
    { authorised: 0, held: 0, serviceable: 0, deployed: 0, in_maintenance: 0 }
  );

  return {
    org,
    breadcrumb: ancestors,
    children,
    kpis: {
      readiness_pct: org.readiness_pct,
      personnel_fill_pct: personnelFill,
      personnel_present: org.personnel_present,
      personnel_authorised: org.personnel_authorised,
      equipment_serviceable_pct:
        totals.held > 0 ? Math.round((totals.serviceable / totals.held) * 100) : 0,
      equipment_deployed: totals.deployed,
      equipment_in_maintenance: totals.in_maintenance,
      child_count: children.length,
    },
    equipment_by_category: equipmentSummary,
    equipment: equipmentDetail,
    readiness_trend: readiness,
    events,
  };
}

export async function buildLlmContext() {
  const division = await getDivision();
  if (!division) return null;

  // Keep well under Groq free-tier TPM (often 6k tokens/request for small models)
  const formations = await query(
    `SELECT code, short_name, org_level, arm, location, wartime_only,
            ROUND(readiness_pct)::int AS readiness_pct,
            personnel_present, personnel_authorised
     FROM orgs
     WHERE org_level IN ('division', 'group', 'brigade')
     ORDER BY sort_order, short_name`
  );

  const battalions = await query(
    `SELECT code, short_name, arm, parent_id,
            ROUND(readiness_pct)::int AS readiness_pct
     FROM orgs
     WHERE org_level = 'battalion'
     ORDER BY sort_order, short_name`
  );

  const parents = await query(`SELECT id, code FROM orgs`);
  const parentCode = Object.fromEntries(parents.rows.map((r) => [r.id, r.code]));
  const battalionSummary = battalions.rows.map((b) => ({
    code: b.code,
    short_name: b.short_name,
    arm: b.arm,
    parent: parentCode[b.parent_id] || null,
    readiness_pct: b.readiness_pct,
  }));

  const equipmentTypes = await query(
    `SELECT e.category, e.nomenclature,
            SUM(e.held)::int AS held,
            SUM(e.serviceable)::int AS serviceable,
            SUM(e.deployed)::int AS deployed,
            SUM(e.in_maintenance)::int AS maint
     FROM equipment e
     GROUP BY e.category, e.nomenclature
     ORDER BY e.category, SUM(e.held) DESC`
  );

  const events = await query(
    `SELECT o.short_name, e.severity, e.title
     FROM operational_events e
     JOIN orgs o ON o.id = e.org_id
     ORDER BY e.occurred_at DESC
     LIMIT 8`
  );

  return {
    division: {
      code: division.code,
      name: division.name,
      location: division.location,
      readiness_pct: Math.round(division.readiness_pct),
    },
    formations: formations.rows,
    battalions: battalionSummary,
    equipment: equipmentTypes.rows,
    recent_events: events.rows,
  };
}
