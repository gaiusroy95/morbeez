-- Allow field-visit and recommendation-origin reuse cases without ai_advisory_sessions FK
ALTER TABLE advisory_reuse_cases
  ALTER COLUMN source_session_id DROP NOT NULL;

ALTER TABLE advisory_reuse_cases
  DROP CONSTRAINT IF EXISTS advisory_reuse_cases_source_session_id_fkey;

ALTER TABLE advisory_reuse_cases
  ADD CONSTRAINT advisory_reuse_cases_source_session_id_fkey
  FOREIGN KEY (source_session_id) REFERENCES ai_advisory_sessions(id) ON DELETE SET NULL;

ALTER TABLE advisory_reuse_cases
  ADD COLUMN IF NOT EXISTS source_field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_recommendation_id UUID REFERENCES recommendation_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'ai_session';

CREATE INDEX IF NOT EXISTS idx_advisory_reuse_field_finding
  ON advisory_reuse_cases (source_field_finding_id)
  WHERE source_field_finding_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_advisory_reuse_recommendation
  ON advisory_reuse_cases (source_recommendation_id)
  WHERE source_recommendation_id IS NOT NULL;
