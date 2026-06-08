-- Rack-by-rack picker workflow state on pack sessions

ALTER TABLE pack_sessions
  ADD COLUMN IF NOT EXISTS completed_racks JSONB NOT NULL DEFAULT '[]';
