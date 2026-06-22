-- Plot intelligence snapshots + outcome variants + regional threat signals (Morbeez AI OS 10/10)

CREATE TABLE IF NOT EXISTS plot_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES farm_blocks(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  crop_type TEXT,
  season_label TEXT,
  trends JSONB NOT NULL DEFAULT '{}',
  recurring_issues JSONB NOT NULL DEFAULT '[]',
  soil_trend JSONB,
  outcome_summary JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plot_intel_block ON plot_intelligence_snapshots (block_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS recommendation_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  recommendation_record_id UUID REFERENCES recommendation_records(id) ON DELETE SET NULL,
  issue_label TEXT NOT NULL,
  protocol_label TEXT NOT NULL,
  cost_inr NUMERIC(12, 2),
  expected_recovery_pct NUMERIC(5, 2),
  actual_outcome TEXT,
  recovery_days INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_variants_issue ON recommendation_variants (issue_label, created_at DESC);

CREATE TABLE IF NOT EXISTS regional_threat_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  issue_label TEXT NOT NULL,
  threat_level TEXT NOT NULL CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
  case_count_7d INT NOT NULL DEFAULT 0,
  trend_direction TEXT CHECK (trend_direction IN ('rising', 'stable', 'falling')),
  reasoning TEXT,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regional_threat_lookup
  ON regional_threat_signals (district, crop_type, valid_from DESC);

ALTER TABLE plot_intelligence_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_threat_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY plot_intel_service ON plot_intelligence_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY rec_variants_service ON recommendation_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY regional_threat_service ON regional_threat_signals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE crm_field_findings
  ADD COLUMN IF NOT EXISTS visit_classification TEXT CHECK (
    visit_classification IS NULL OR visit_classification IN ('first', 'follow_up', 'rectification')
  );
