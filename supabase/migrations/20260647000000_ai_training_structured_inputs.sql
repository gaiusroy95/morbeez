-- Stage 1 — AI training structured input foundation
-- Extends existing tables; see docs/ai-training/STAGE1-STRUCTURED-INPUTS.md

-- ─── Farmer profile enrichment ───────────────────────────────
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS farming_style TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT;

ALTER TABLE farmers DROP CONSTRAINT IF EXISTS farmers_farming_style_check;
ALTER TABLE farmers ADD CONSTRAINT farmers_farming_style_check
  CHECK (farming_style IS NULL OR farming_style IN (
    'traditional', 'semi_commercial', 'commercial', 'organic', 'mixed'
  ));

ALTER TABLE farmers DROP CONSTRAINT IF EXISTS farmers_experience_level_check;
ALTER TABLE farmers ADD CONSTRAINT farmers_experience_level_check
  CHECK (experience_level IS NULL OR experience_level IN (
    'beginner', 'intermediate', 'experienced', 'expert'
  ));

-- ─── Weather snapshots (training + event correlation) ────────
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'manual' CHECK (event_type IN (
    'field_finding', 'ai_session', 'recommendation', 'field_activity', 'manual'
  )),
  event_id UUID,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location_label TEXT,
  rainfall_mm NUMERIC(8, 2),
  rainfall_mm_forecast NUMERIC(8, 2),
  humidity_pct NUMERIC(5, 2),
  temperature_c NUMERIC(5, 2),
  soil_moisture_pct NUMERIC(5, 2),
  weather_risk_score INT,
  disease_alerts JSONB NOT NULL DEFAULT '[]',
  raw_forecast JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_farmer
  ON weather_snapshots (farmer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_block
  ON weather_snapshots (block_id, captured_at DESC)
  WHERE block_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_event
  ON weather_snapshots (event_type, event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE weather_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY weather_snapshots_service ON weather_snapshots FOR ALL USING (true) WITH CHECK (true);

-- ─── Field findings: structured AI training fields ────────────
ALTER TABLE crm_field_findings
  ADD COLUMN IF NOT EXISTS finding_type TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS affected_area_pct NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS ai_prediction TEXT,
  ADD COLUMN IF NOT EXISTS final_confirmed_issue TEXT,
  ADD COLUMN IF NOT EXISTS weather_context JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weather_snapshot_id UUID REFERENCES weather_snapshots(id) ON DELETE SET NULL;

ALTER TABLE crm_field_findings DROP CONSTRAINT IF EXISTS crm_field_findings_finding_type_check;
ALTER TABLE crm_field_findings ADD CONSTRAINT crm_field_findings_finding_type_check
  CHECK (finding_type IS NULL OR finding_type IN (
    'disease', 'pest', 'nutrient_deficiency', 'irrigation',
    'weather_stress', 'growth_observation', 'other'
  ));

ALTER TABLE crm_field_findings DROP CONSTRAINT IF EXISTS crm_field_findings_severity_check;
ALTER TABLE crm_field_findings ADD CONSTRAINT crm_field_findings_severity_check
  CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe'));

ALTER TABLE crm_field_findings DROP CONSTRAINT IF EXISTS crm_field_findings_affected_area_check;
ALTER TABLE crm_field_findings ADD CONSTRAINT crm_field_findings_affected_area_check
  CHECK (affected_area_pct IS NULL OR (affected_area_pct >= 0 AND affected_area_pct <= 100));

CREATE INDEX IF NOT EXISTS idx_crm_field_findings_type
  ON crm_field_findings (finding_type, severity)
  WHERE archived_at IS NULL;

-- ─── Field activities: structured dosage / labour ─────────────
ALTER TABLE cultivation_activities
  ADD COLUMN IF NOT EXISTS dosage_structured JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS labour_used JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS weather_snapshot_id UUID REFERENCES weather_snapshots(id) ON DELETE SET NULL;
