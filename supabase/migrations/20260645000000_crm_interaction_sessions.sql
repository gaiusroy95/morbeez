-- Operational interaction sessions — one row = one meaningful workflow session (not micro system events).

ALTER TABLE interaction_logs
  ADD COLUMN IF NOT EXISTS is_operational_session BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT 'Closed',
  ADD COLUMN IF NOT EXISTS field_finding_text TEXT,
  ADD COLUMN IF NOT EXISTS field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_activity_label TEXT,
  ADD COLUMN IF NOT EXISTS field_activity_date DATE,
  ADD COLUMN IF NOT EXISTS field_activity_id UUID REFERENCES cultivation_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_activity_type_id UUID REFERENCES field_activity_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommendation_summary TEXT,
  ADD COLUMN IF NOT EXISTS recommendation_id UUID REFERENCES crm_recommendations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cultivation_activities
  ADD COLUMN IF NOT EXISTS interaction_log_id UUID REFERENCES interaction_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS added_from TEXT DEFAULT 'direct';

CREATE INDEX IF NOT EXISTS idx_interaction_logs_operational
  ON interaction_logs (farmer_id, COALESCE(interaction_at, created_at) DESC)
  WHERE is_operational_session = true AND (status IS NULL OR status <> 'archived');

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_interaction
  ON cultivation_activities (interaction_log_id)
  WHERE interaction_log_id IS NOT NULL;

-- Backfill: prior manual CRM logs become operational sessions.
UPDATE interaction_logs
SET
  is_operational_session = true,
  interaction_at = COALESCE(interaction_at, created_at),
  workflow_status = COALESCE(workflow_status, 'Closed')
WHERE channel = 'crm'
  AND interaction_type IS NOT NULL
  AND (status IS NULL OR status <> 'archived')
  AND is_operational_session = false;

-- Session interaction types (searchable via crm_masters).
INSERT INTO crm_masters (master_type, name, sort_order)
SELECT v.master_type, v.name, v.sort_order
FROM (VALUES
  ('interaction_type', 'ROI Discussion', 11),
  ('interaction_type', 'WhatsApp Discussion', 12),
  ('interaction_type', 'Issue Review', 13),
  ('interaction_type', 'Recommendation Discussion', 14),
  ('interaction_type', 'Agronomist Visit', 15),
  ('interaction_outcome', 'Recommendation Accepted', 1),
  ('interaction_outcome', 'Issue Resolved', 2),
  ('interaction_outcome', 'Monitoring Required', 3),
  ('interaction_outcome', 'Farmer Hesitant', 4),
  ('interaction_outcome', 'Clarification Requested', 5),
  ('interaction_next_action', 'Monthly ROI Review', 1),
  ('interaction_next_action', 'Close Workflow', 2),
  ('interaction_next_action', 'Recovery Check after 5 days', 3),
  ('interaction_next_action', 'Spray Follow-up after 3 days', 4),
  ('interaction_next_action', 'Agronomist Review', 5),
  ('interaction_next_action', 'Telecaller Clarification', 6),
  ('interaction_next_action', 'Monitoring Follow-up', 7),
  ('interaction_next_action', 'Recovery Review after 4 days', 8)
) AS v(master_type, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM crm_masters m
  WHERE m.master_type = v.master_type AND lower(m.name) = lower(v.name)
);
