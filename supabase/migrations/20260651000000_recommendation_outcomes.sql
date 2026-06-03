-- Stage 5 — Recommendation outcome review (effectiveness learning)

ALTER TABLE recommendation_records
  ADD COLUMN IF NOT EXISTS recovery_days INT CHECK (recovery_days IS NULL OR (recovery_days >= 0 AND recovery_days <= 365)),
  ADD COLUMN IF NOT EXISTS farmer_outcome_feedback TEXT,
  ADD COLUMN IF NOT EXISTS agronomist_outcome_feedback TEXT,
  ADD COLUMN IF NOT EXISTS issue_resolved BOOLEAN,
  ADD COLUMN IF NOT EXISTS outcome_recorded_by TEXT;

CREATE INDEX IF NOT EXISTS idx_recommendation_records_outcome_pending
  ON recommendation_records (communicated_at DESC)
  WHERE status IN ('communicated', 'applied') AND outcome IS NULL;

COMMENT ON COLUMN recommendation_records.recovery_days IS 'Days until visible crop recovery after recommendation applied';
COMMENT ON COLUMN recommendation_records.issue_resolved IS 'Agronomist-confirmed issue resolution for AI training';
