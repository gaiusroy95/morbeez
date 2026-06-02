-- Field Activity Operational Memory foundation
-- Dynamic activity types + pending tasks + ROI sync linkage

CREATE TABLE IF NOT EXISTS field_activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'operations',
  crop TEXT,
  icon TEXT,
  color_tag TEXT,
  followup_default_days INT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_name, crop)
);

CREATE INDEX IF NOT EXISTS idx_field_activity_types_crop_active
  ON field_activity_types (crop, active_status, sort_order, activity_name);

ALTER TABLE cultivation_activities
  ADD COLUMN IF NOT EXISTS activity_type_id UUID REFERENCES field_activity_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dap INT CHECK (dap IS NULL OR dap >= 0),
  ADD COLUMN IF NOT EXISTS labour_cost_inr NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS spray_cost_inr NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fertilizer_cost_inr NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS machinery_cost_inr NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS roi_entry_id UUID REFERENCES farmer_roi_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_type_id
  ON cultivation_activities (activity_type_id);

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_farmer_block_date
  ON cultivation_activities (farmer_id, farm_block_id, applied_at DESC);

CREATE TABLE IF NOT EXISTS pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL CHECK (task_type IN ('field_follow_up', 'activity_follow_up', 'observation_follow_up', 'other')),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  crop_block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  source_activity_id UUID REFERENCES cultivation_activities(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  assigned_employee TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_tasks_farmer_due
  ON pending_tasks (farmer_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_pending_tasks_block_due
  ON pending_tasks (crop_block_id, status, due_date);

CREATE TABLE IF NOT EXISTS roi_activity_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  activity_id UUID NOT NULL REFERENCES cultivation_activities(id) ON DELETE CASCADE,
  roi_entry_id UUID NOT NULL REFERENCES farmer_roi_entries(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('labour', 'spray', 'fertilizer', 'machinery', 'mixed')),
  amount_inr NUMERIC(12,2) NOT NULL CHECK (amount_inr >= 0),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  link_status TEXT NOT NULL DEFAULT 'linked' CHECK (link_status IN ('linked', 'created', 'deduped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roi_activity_costs_activity_id
  ON roi_activity_costs (activity_id);

CREATE INDEX IF NOT EXISTS idx_roi_activity_costs_farmer_block
  ON roi_activity_costs (farmer_id, block_id, linked_at DESC);

CREATE OR REPLACE VIEW crop_block_timeline AS
SELECT
  ca.id,
  ca.farmer_id,
  ca.farm_block_id AS crop_block_id,
  ca.applied_at AS activity_date,
  ca.dap,
  ca.activity_type,
  ca.activity_label,
  ca.activity_type_id,
  fat.activity_name,
  fat.category AS activity_category,
  fat.icon AS activity_icon,
  fat.color_tag AS activity_color_tag,
  ca.notes,
  ca.cost_inr,
  ca.labour_cost_inr,
  ca.spray_cost_inr,
  ca.fertilizer_cost_inr,
  ca.machinery_cost_inr,
  ca.follow_up_required,
  ca.follow_up_date,
  ca.activity_status,
  ca.created_at,
  ca.updated_at
FROM cultivation_activities ca
LEFT JOIN field_activity_types fat ON fat.id = ca.activity_type_id;

ALTER TABLE field_activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_activity_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY field_activity_types_service
  ON field_activity_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pending_tasks_service
  ON pending_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY roi_activity_costs_service
  ON roi_activity_costs FOR ALL USING (true) WITH CHECK (true);

-- Seed dynamic types (idempotent)
INSERT INTO field_activity_types (activity_name, category, crop, icon, color_tag, followup_default_days, sort_order, active_status)
VALUES
  ('Drenching', 'protection', 'ginger', 'droplet', 'emerald', 5, 10, true),
  ('Kana Monitoring', 'observation', 'ginger', 'sprout', 'lime', 3, 20, true),
  ('Mulching', 'operations', 'ginger', 'layers', 'amber', null, 30, true),
  ('Thrips Spray', 'protection', 'ginger', 'spray', 'red', 5, 40, true),
  ('Fertigation', 'nutrition', NULL, 'flask', 'blue', 7, 50, true),
  ('Field Observation', 'observation', NULL, 'eye', 'slate', 3, 60, true),
  ('Labour Operation', 'labour', NULL, 'users', 'violet', null, 70, true)
ON CONFLICT (activity_name, crop) DO UPDATE SET
  active_status = EXCLUDED.active_status,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  color_tag = EXCLUDED.color_tag,
  followup_default_days = EXCLUDED.followup_default_days,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
