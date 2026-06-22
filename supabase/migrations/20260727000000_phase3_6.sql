-- Phase 3: Compatibility override audit log

CREATE TABLE IF NOT EXISTS compatibility_override_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  approved_by TEXT NOT NULL,
  override_reason TEXT NOT NULL,
  incompatible_pairs JSONB NOT NULL DEFAULT '[]',
  materials JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compatibility_override_farmer
  ON compatibility_override_log (farmer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compatibility_override_finding
  ON compatibility_override_log (field_finding_id, created_at DESC);

-- Phase 5: A/B experiment definitions

CREATE TABLE IF NOT EXISTS experiment_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  hypothesis TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'completed', 'archived')),
  variants JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_definitions_status
  ON experiment_definitions (status, updated_at DESC);

-- Phase 6: Sensor + satellite stubs

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES farm_blocks(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL,
  value NUMERIC(12, 4) NOT NULL,
  unit TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_block
  ON sensor_readings (block_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS satellite_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES farm_blocks(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  overlay_type TEXT NOT NULL,
  capture_date DATE NOT NULL,
  ndvi_mean NUMERIC(8, 4),
  storage_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satellite_overlays_block
  ON satellite_overlays (block_id, capture_date DESC);
