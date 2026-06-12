-- Stage 4 — AI confidence lifecycle on advisory sessions

ALTER TABLE ai_advisory_sessions
  ADD COLUMN IF NOT EXISTS confidence_band TEXT,
  ADD COLUMN IF NOT EXISTS auto_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_reviewed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS corrected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS routing_decided_at TIMESTAMPTZ;

ALTER TABLE ai_advisory_sessions DROP CONSTRAINT IF EXISTS ai_advisory_sessions_confidence_band_check;
ALTER TABLE ai_advisory_sessions ADD CONSTRAINT ai_advisory_sessions_confidence_band_check
  CHECK (confidence_band IS NULL OR confidence_band IN ('auto_send', 'employee_review', 'escalate'));

CREATE INDEX IF NOT EXISTS idx_ai_sessions_confidence_band
  ON ai_advisory_sessions (confidence_band, created_at DESC)
  WHERE confidence_band IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_sessions_auto_sent
  ON ai_advisory_sessions (auto_sent, created_at DESC)
  WHERE auto_sent = true;

-- Backfill band from existing confidence_score where possible
UPDATE ai_advisory_sessions
SET confidence_band = CASE
  WHEN confidence_score >= 0.95 THEN 'auto_send'
  WHEN confidence_score >= 0.80 THEN 'employee_review'
  WHEN confidence_score IS NOT NULL THEN 'escalate'
  ELSE NULL
END,
routing_decided_at = COALESCE(routing_decided_at, updated_at, created_at)
WHERE confidence_band IS NULL AND confidence_score IS NOT NULL;
