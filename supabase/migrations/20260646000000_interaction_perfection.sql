-- Interaction module perfection: escalation link, task link, store finding text without duplicate row.

ALTER TABLE interaction_logs
  ADD COLUMN IF NOT EXISTS escalation_id UUID REFERENCES agronomist_escalations(id) ON DELETE SET NULL;

ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS interaction_log_id UUID REFERENCES interaction_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_interaction
  ON crm_tasks (interaction_log_id)
  WHERE interaction_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interaction_logs_escalation
  ON interaction_logs (escalation_id)
  WHERE escalation_id IS NOT NULL;
