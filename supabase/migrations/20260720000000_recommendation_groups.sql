-- Phase 2 — structured recommendation groups, materials, monitoring plan items

CREATE TABLE IF NOT EXISTS recommendation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID NOT NULL REFERENCES crm_field_findings(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL,
  application_day INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_groups_finding
  ON recommendation_groups (field_finding_id, sort_order);

CREATE TABLE IF NOT EXISTS recommendation_group_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES recommendation_groups(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES visit_issues(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  technical_name TEXT NOT NULL,
  dose TEXT,
  method TEXT,
  related_issue_id UUID REFERENCES visit_issues(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recommendation_group_materials_group
  ON recommendation_group_materials (group_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_recommendation_group_materials_issue
  ON recommendation_group_materials (issue_id)
  WHERE issue_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS monitoring_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_record_id UUID NOT NULL REFERENCES recommendation_records(id) ON DELETE CASCADE,
  interval_days INT NOT NULL,
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  next_check_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_plan_items_rec
  ON monitoring_plan_items (recommendation_record_id, next_check_at);

ALTER TABLE recommendation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_group_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY recommendation_groups_service ON recommendation_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY recommendation_group_materials_service ON recommendation_group_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY monitoring_plan_items_service ON monitoring_plan_items FOR ALL USING (true) WITH CHECK (true);
