CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  org_level TEXT NOT NULL CHECK (org_level IN ('division', 'group', 'brigade', 'battalion', 'hq')),
  arm TEXT NOT NULL,
  location TEXT,
  wartime_only BOOLEAN NOT NULL DEFAULT FALSE,
  readiness_pct REAL NOT NULL DEFAULT 85,
  personnel_authorised INT NOT NULL DEFAULT 0,
  personnel_present INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'operational',
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  position_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing DBs created before geo columns
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS position_reported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orgs_parent ON orgs (parent_id);
CREATE INDEX IF NOT EXISTS idx_orgs_level ON orgs (org_level);
CREATE INDEX IF NOT EXISTS idx_orgs_arm ON orgs (arm);
CREATE INDEX IF NOT EXISTS idx_orgs_position ON orgs (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  nomenclature TEXT NOT NULL,
  role TEXT,
  authorised INT NOT NULL DEFAULT 0,
  held INT NOT NULL DEFAULT 0,
  serviceable INT NOT NULL DEFAULT 0,
  deployed INT NOT NULL DEFAULT 0,
  in_maintenance INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_equipment_org ON equipment (org_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);

CREATE TABLE IF NOT EXISTS readiness_samples (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  readiness_pct REAL NOT NULL,
  personnel_present INT,
  serviceable_major INT,
  fuel_days REAL,
  ammo_days REAL
);

CREATE INDEX IF NOT EXISTS idx_readiness_org_time
  ON readiness_samples (org_id, sampled_at DESC);

CREATE TABLE IF NOT EXISTS operational_events (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  detail TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_org_time
  ON operational_events (org_id, occurred_at DESC);

-- Event log for deployment position heartbeats / moves (event-driven map)
CREATE TABLE IF NOT EXISTS location_events (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  changed BOOLEAN NOT NULL DEFAULT FALSE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_events_time
  ON location_events (reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_events_org_time
  ON location_events (org_id, reported_at DESC);

-- Drop legacy FieldPulse tables if present
DROP TABLE IF EXISTS telemetry_readings CASCADE;
DROP TABLE IF EXISTS units CASCADE;
