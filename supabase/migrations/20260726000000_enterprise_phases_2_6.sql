-- Phase 2: Farmer 360 + yield history

CREATE TABLE IF NOT EXISTS yield_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  crop_type TEXT NOT NULL,
  season_label TEXT,
  yield_kg_per_acre NUMERIC(12, 2),
  harvest_date DATE,
  source TEXT NOT NULL DEFAULT 'harvest_record',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yield_history_farmer ON yield_history (farmer_id, harvest_date DESC);
CREATE INDEX IF NOT EXISTS idx_yield_history_block ON yield_history (block_id, harvest_date DESC);

CREATE TABLE IF NOT EXISTS farmer_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  health_band TEXT,
  retention_band TEXT,
  compliance_score INT,
  risk_score INT,
  opportunity_score INT,
  summary JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_intel_farmer ON farmer_intelligence_snapshots (farmer_id, computed_at DESC);

-- Phase 4: Protocol definitions + application history

CREATE TABLE IF NOT EXISTS protocol_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type TEXT NOT NULL,
  issue_label TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  label TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',
  products JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_type, issue_label, version)
);

CREATE TABLE IF NOT EXISTS application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  dose TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT NOT NULL CHECK (method IN ('spray', 'drench', 'fertigation', 'soil')),
  source TEXT NOT NULL DEFAULT 'visit',
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_history_farmer ON application_history (farmer_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_history_block ON application_history (block_id, applied_at DESC);

-- Phase 6: A/B experiment fields on recommendation variants

ALTER TABLE recommendation_variants
  ADD COLUMN IF NOT EXISTS experiment_id TEXT,
  ADD COLUMN IF NOT EXISTS variant_key TEXT,
  ADD COLUMN IF NOT EXISTS protocol_version INT;
