-- Phase C: versioned KPI Control Center, qualified-case definition,
-- diagnosis QA sample, month-end freeze. Never overwrite an active rule row.

ALTER TABLE earning_rule_versions
  DROP CONSTRAINT IF EXISTS earning_rule_versions_rule_type_check;

ALTER TABLE earning_rule_versions
  ADD CONSTRAINT earning_rule_versions_rule_type_check
  CHECK (rule_type IN (
    'partner_kpi_factor',
    'agronomist_sales_slab',
    'settlement_80_20',
    'eligible_sale',
    'farmer_introduction',
    'partner_kpi_weights',
    'agronomist_kpi',
    'qualified_case',
    'diagnosis_qa'
  ));

ALTER TABLE earning_rule_versions
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

INSERT INTO earning_rule_versions (rule_type, version_number, effective_from, status, payload, change_reason)
SELECT * FROM (VALUES
  (
    'partner_kpi_weights',
    1,
    DATE '2026-08-01',
    'active',
    '{"parameters":[{"key":"eligible_sales","label":"Eligible Delivered Sales","weightPct":30,"target":100000,"unit":"inr"},{"key":"farmer_retention","label":"Farmer Retention","weightPct":20,"target":80,"unit":"pct"},{"key":"field_service","label":"Field Service","weightPct":15,"target":80,"unit":"pct"},{"key":"territory","label":"Territory Penetration","weightPct":15,"target":80,"unit":"pct"},{"key":"collections","label":"Collections","weightPct":10,"target":90,"unit":"pct"},{"key":"advocacy","label":"Advocacy / Digital","weightPct":5,"target":50,"unit":"pct"},{"key":"lead_response","label":"Lead Response","weightPct":3,"target":80,"unit":"pct"},{"key":"reporting","label":"Reporting","weightPct":2,"target":80,"unit":"pct"}]}'::jsonb,
    'Phase C default partner KPI 8-parameter weights'
  ),
  (
    'agronomist_kpi',
    1,
    DATE '2026-08-01',
    'active',
    '{"qualifiedCaseTarget":300,"parameters":[{"key":"qualified_cases","label":"Qualified Cases","weightPct":40,"target":300,"unit":"count"},{"key":"diagnosis_accuracy","label":"Diagnosis Accuracy","weightPct":35,"target":90,"unit":"pct"},{"key":"eligible_sales","label":"Attributed Eligible Sales","weightPct":25,"target":300000,"unit":"inr"}]}'::jsonb,
    'Phase C default agronomist KPI'
  ),
  (
    'qualified_case',
    1,
    DATE '2026-08-01',
    'active',
    '{"requireFarmerVerified":true,"requireCrop":true,"requireCropStage":true,"requireProblem":true,"requireDiagnosis":true,"requireRecommendation":true,"requireEvidence":true}'::jsonb,
    'Phase C default qualified-case gates'
  ),
  (
    'diagnosis_qa',
    1,
    DATE '2026-08-01',
    'active',
    '{"sampleRatePct":10,"sampleCap":30}'::jsonb,
    'Phase C default diagnosis QA sample MIN(10%, 30)'
  )
) AS v(rule_type, version_number, effective_from, status, payload, change_reason)
WHERE NOT EXISTS (
  SELECT 1 FROM earning_rule_versions e
  WHERE e.rule_type = v.rule_type AND e.version_number = v.version_number
);

-- Frozen rule version per calendar month. August never recalculates on September targets.
CREATE TABLE IF NOT EXISTS kpi_period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_version_id UUID NOT NULL REFERENCES earning_rule_versions(id) ON DELETE RESTRICT,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frozen_by TEXT,
  UNIQUE (period_month, rule_type)
);

CREATE INDEX IF NOT EXISTS idx_kpi_period_locks_month
  ON kpi_period_locks (period_month);

ALTER TABLE kpi_period_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kpi_period_locks_all ON kpi_period_locks;
CREATE POLICY kpi_period_locks_all
  ON kpi_period_locks FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS qualified_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('expert_case', 'recommendation')),
  source_id UUID NOT NULL,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  agronomist_email TEXT,
  qualified BOOLEAN NOT NULL DEFAULT false,
  missing_reasons JSONB NOT NULL DEFAULT '[]',
  facts JSONB NOT NULL DEFAULT '{}',
  rule_version_id UUID REFERENCES earning_rule_versions(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_qualified_cases_month
  ON qualified_cases (period_month, qualified);
CREATE INDEX IF NOT EXISTS idx_qualified_cases_agronomist
  ON qualified_cases (agronomist_email, period_month)
  WHERE agronomist_email IS NOT NULL;

ALTER TABLE qualified_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qualified_cases_all ON qualified_cases;
CREATE POLICY qualified_cases_all
  ON qualified_cases FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS diagnosis_qa_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month TEXT NOT NULL,
  qualified_case_id UUID NOT NULL REFERENCES qualified_cases(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  agronomist_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accurate', 'inaccurate', 'skipped')),
  audited_by TEXT,
  audited_at TIMESTAMPTZ,
  notes TEXT,
  rule_version_id UUID REFERENCES earning_rule_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_month, qualified_case_id)
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_qa_month
  ON diagnosis_qa_samples (period_month, status);

ALTER TABLE diagnosis_qa_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diagnosis_qa_samples_all ON diagnosis_qa_samples;
CREATE POLICY diagnosis_qa_samples_all
  ON diagnosis_qa_samples FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS agronomist_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agronomist_email TEXT NOT NULL,
  period_month TEXT NOT NULL,
  qualified_case_count INT NOT NULL DEFAULT 0,
  diagnosis_accuracy_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  eligible_sales_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  lines JSONB NOT NULL DEFAULT '[]',
  rule_version_id UUID REFERENCES earning_rule_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agronomist_email, period_month)
);

ALTER TABLE agronomist_kpi_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agronomist_kpi_snapshots_all ON agronomist_kpi_snapshots;
CREATE POLICY agronomist_kpi_snapshots_all
  ON agronomist_kpi_snapshots FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE kpi_period_locks IS
  'Month-end freeze of the active earning/KPI rule version. A closed month never recalculates on a later version.';
COMMENT ON TABLE qualified_cases IS
  'Qualified agronomy cases: farmer + crop + stage + problem + diagnosis + recommendation + evidence. A case row alone is not enough.';
COMMENT ON TABLE diagnosis_qa_samples IS
  'Diagnosis QA sample = MIN(10% of qualified cases, 30) unless the diagnosis_qa rule version says otherwise.';
