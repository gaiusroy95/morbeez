-- Scalable WhatsApp KPI outcome follow-up (structured + human verification queue)

ALTER TABLE recommendation_records
  ADD COLUMN IF NOT EXISTS outcome_kpi JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outcome_source TEXT CHECK (
    outcome_source IS NULL OR outcome_source IN (
      'whatsapp_kpi',
      'whatsapp_ai',
      'agronomist',
      'telecaller',
      'system'
    )
  ),
  ADD COLUMN IF NOT EXISTS needs_human_outcome_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_outcome_review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_recommendation_records_human_outcome_review
  ON recommendation_records (needs_human_outcome_review, communicated_at DESC)
  WHERE needs_human_outcome_review = TRUE AND outcome IS NULL;

COMMENT ON COLUMN recommendation_records.outcome_kpi IS 'Structured WhatsApp KPI: improvement_level, photo_uploaded, ai_classification, etc.';
COMMENT ON COLUMN recommendation_records.needs_human_outcome_review IS 'Selective manual verification — severe/failed/uncertain/QA sample';

-- Allow outcome reminder phase on follow-up rows
ALTER TABLE recommendation_follow_ups
  DROP CONSTRAINT IF EXISTS recommendation_follow_ups_phase_check;

ALTER TABLE recommendation_follow_ups
  ADD CONSTRAINT recommendation_follow_ups_phase_check CHECK (
    phase IN (
      'application_check',
      'application_reminder',
      'outcome_check',
      'outcome_reminder'
    )
  );
