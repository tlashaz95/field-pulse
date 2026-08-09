import { query } from '../db/pool.js';
import { broadcast, clientCount } from './hub.js';

/**
 * Every tick: report current (or slightly nudged) positions for all geolocated orgs.
 * Always emits an event — even when coords are unchanged — so the map stays live.
 */
const MOVE_PROBABILITY = Number(process.env.LOCATION_MOVE_PROBABILITY || 0.28);
const NUDGE_DEG = Number(process.env.LOCATION_NUDGE_DEG || 0.0025); // ~250m

let timer = null;
let running = false;

async function publishLocationBatch() {
  if (running) return;
  running = true;
  try {
    const { rows } = await query(
      `SELECT id, code, short_name, org_level, arm, lat, lng
       FROM orgs
       WHERE lat IS NOT NULL AND lng IS NOT NULL`
    );

    const reportedAt = new Date().toISOString();
    const events = [];

    for (const org of rows) {
      let lat = Number(org.lat);
      let lng = Number(org.lng);
      let changed = false;

      if (Math.random() < MOVE_PROBABILITY) {
        lat = Number((lat + (Math.random() - 0.5) * NUDGE_DEG).toFixed(6));
        lng = Number((lng + (Math.random() - 0.5) * NUDGE_DEG).toFixed(6));
        changed = true;
      }

      await query(
        `UPDATE orgs
         SET lat = $1, lng = $2, position_reported_at = $3::timestamptz
         WHERE id = $4`,
        [lat, lng, reportedAt, org.id]
      );

      await query(
        `INSERT INTO location_events (org_id, lat, lng, changed, reported_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz)`,
        [org.id, lat, lng, changed, reportedAt]
      );

      events.push({
        type: 'location.updated',
        org_id: org.id,
        code: org.code,
        short_name: org.short_name,
        org_level: org.org_level,
        arm: org.arm,
        lat,
        lng,
        changed,
        reported_at: reportedAt,
      });
    }

    const batch = {
      type: 'location.batch',
      reported_at: reportedAt,
      count: events.length,
      moved: events.filter((e) => e.changed).length,
      events,
    };

    broadcast(batch);
    console.log(
      `location tick: ${batch.count} reports (${batch.moved} moved) → ${clientCount()} SSE clients`
    );
  } catch (err) {
    console.warn('location tick failed:', err.message);
  } finally {
    running = false;
  }
}

export function startLocationTicker() {
  const intervalMs = Number(process.env.LOCATION_TICK_MS || 60_000);
  if (timer) return;

  // First pulse shortly after boot so demos don't wait a full minute
  const firstDelay = Math.min(8_000, intervalMs);
  setTimeout(() => {
    publishLocationBatch();
  }, firstDelay);

  timer = setInterval(publishLocationBatch, intervalMs);
  console.log(`Location ticker started (every ${intervalMs}ms)`);
}

export function stopLocationTicker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export { publishLocationBatch };
