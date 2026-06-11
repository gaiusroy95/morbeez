-- Agronomist operations: richer CRM tasks + comment threads between telecaller & agronomist

ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS assigned_agronomist TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS issue_description TEXT,
  ADD COLUMN IF NOT EXISTS task_category TEXT NOT NULL DEFAULT 'other'
    CHECK (task_category IN (
      'call_farmer',
      'visit_request',
      'recommendation',
      'soil_test_review',
      'disease_review',
      'other'
    ));

CREATE INDEX IF NOT EXISTS idx_crm_tasks_agronomist
  ON crm_tasks(assigned_agronomist, status, due_at)
  WHERE assigned_agronomist IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES crm_tasks(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'telecaller'
    CHECK (author_role IN ('telecaller', 'agronomist', 'system')),
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_task_comments_task
  ON crm_task_comments(task_id, created_at ASC);

ALTER TABLE crm_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_task_comments_service_role ON crm_task_comments
  FOR ALL USING (true) WITH CHECK (true);
