-- Visit priority tagging for command center (Module A)

ALTER TABLE crm_field_findings
  ADD COLUMN IF NOT EXISTS visit_priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (visit_priority IN ('normal', 'urgent', 'emergency'));

CREATE INDEX IF NOT EXISTS idx_crm_field_findings_priority
  ON crm_field_findings (visit_priority, visited_at DESC)
  WHERE archived_at IS NULL;
