-- Farmer ROI v1: multi-harvest, farmer categories, income subtypes

ALTER TABLE harvest_records
  ADD COLUMN IF NOT EXISTS buyer TEXT;

ALTER TABLE farmer_roi_entries
  ADD COLUMN IF NOT EXISTS income_subtype TEXT CHECK (
    income_subtype IS NULL OR income_subtype IN ('harvest_sale', 'advance', 'subsidy', 'other')
  ),
  ADD COLUMN IF NOT EXISTS category_id UUID;

ALTER TABLE crop_seasons
  ADD COLUMN IF NOT EXISTS harvest_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_yield_kg NUMERIC(12, 3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS farmer_roi_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  ledger_entry_type TEXT NOT NULL DEFAULT 'misc' CHECK (
    ledger_entry_type IN ('labour', 'purchase', 'misc', 'harvest', 'income')
  ),
  is_system BOOLEAN NOT NULL DEFAULT false,
  active_status BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  legacy_expense_type_id UUID REFERENCES roi_expense_types(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farmer_roi_categories_farmer_name
  ON farmer_roi_categories (farmer_id, name) WHERE farmer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_farmer_roi_categories_system_name
  ON farmer_roi_categories (name) WHERE is_system = true AND farmer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_roi_categories_farmer
  ON farmer_roi_categories (farmer_id, active_status, sort_order);

-- Seed system categories from roi_expense_types
INSERT INTO farmer_roi_categories (farmer_id, name, icon, color, ledger_entry_type, is_system, sort_order, legacy_expense_type_id)
SELECT NULL, expense_name, icon, color, ledger_entry_type, true, sort_order, id
FROM roi_expense_types
WHERE active_status = true
ON CONFLICT DO NOTHING;

-- Backfill category_id on entries where expense_type_id is set
UPDATE farmer_roi_entries e
SET category_id = c.id
FROM farmer_roi_categories c
WHERE e.expense_type_id = c.legacy_expense_type_id
  AND e.category_id IS NULL;

ALTER TABLE farmer_roi_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY farmer_roi_categories_service ON farmer_roi_categories FOR ALL USING (true) WITH CHECK (true);
