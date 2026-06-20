-- Soft-clear completed escalations from staff CRM lists (audit row retained).
ALTER TABLE agronomist_escalations
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_escalations_dismissed
  ON agronomist_escalations (dismissed_at)
  WHERE dismissed_at IS NOT NULL;
