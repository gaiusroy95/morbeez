-- Crop season ROI: dynamic expense/labour types + season-scoped ledger

CREATE TABLE IF NOT EXISTS roi_expense_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  ledger_entry_type TEXT NOT NULL DEFAULT 'misc' CHECK (
    ledger_entry_type IN ('labour', 'purchase', 'misc', 'harvest', 'income')
  ),
  active_status BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roi_expense_types_active
  ON roi_expense_types (active_status, sort_order, expense_name);

CREATE TABLE IF NOT EXISTS roi_labour_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_name TEXT NOT NULL UNIQUE,
  icon TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roi_labour_types_active
  ON roi_labour_types (active_status, sort_order, labour_name);

CREATE TABLE IF NOT EXISTS crop_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES farm_blocks(id) ON DELETE CASCADE,
  crop TEXT NOT NULL,
  acreage NUMERIC(10, 3),
  start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  end_date DATE,
  dap INT CHECK (dap IS NULL OR dap >= 0),
  total_expense NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(14, 2) NOT NULL DEFAULT 0,
  final_yield_kg NUMERIC(12, 3),
  expected_income_inr NUMERIC(14, 2),
  market_note TEXT,
  season_status TEXT NOT NULL DEFAULT 'active' CHECK (season_status IN ('active', 'harvested', 'archived')),
  season_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crop_seasons_active_block
  ON crop_seasons (block_id) WHERE season_status = 'active';

CREATE INDEX IF NOT EXISTS idx_crop_seasons_farmer_status
  ON crop_seasons (farmer_id, season_status, start_date DESC);

CREATE TABLE IF NOT EXISTS harvest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES crop_seasons(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  harvest_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  yield_kg NUMERIC(12, 3) NOT NULL CHECK (yield_kg >= 0),
  selling_price_per_kg NUMERIC(12, 2) NOT NULL CHECK (selling_price_per_kg >= 0),
  total_income_inr NUMERIC(14, 2) NOT NULL CHECK (total_income_inr >= 0),
  roi_entry_id UUID REFERENCES farmer_roi_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harvest_records_season
  ON harvest_records (season_id);

ALTER TABLE farmer_roi_entries
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES crop_seasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expense_type_id UUID REFERENCES roi_expense_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS labour_type_id UUID REFERENCES roi_labour_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workers_count INT CHECK (workers_count IS NULL OR workers_count >= 0),
  ADD COLUMN IF NOT EXISTS commerce_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_farmer_roi_entries_season
  ON farmer_roi_entries (season_id, entry_date DESC);

-- Seed default expense types
INSERT INTO roi_expense_types (expense_name, icon, color, ledger_entry_type, sort_order) VALUES
  ('Fertilizer', '🌱', '#2e7d32', 'purchase', 10),
  ('Spray', '🧪', '#1565c0', 'purchase', 20),
  ('Labour', '👨‍🌾', '#f57c00', 'labour', 30),
  ('Irrigation', '💧', '#0288d1', 'misc', 40),
  ('Machinery', '🚜', '#6d4c41', 'misc', 50),
  ('Miscellaneous', '📦', '#757575', 'misc', 60)
ON CONFLICT (expense_name) DO NOTHING;

INSERT INTO roi_labour_types (labour_name, icon, sort_order) VALUES
  ('Weeding', '🌿', 10),
  ('Spraying help', '🧪', 20),
  ('Harvest labour', '🌾', 30),
  ('Other', '👷', 40)
ON CONFLICT (labour_name) DO NOTHING;

ALTER TABLE roi_expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_labour_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY roi_expense_types_service ON roi_expense_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY roi_labour_types_service ON roi_labour_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY crop_seasons_service ON crop_seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY harvest_records_service ON harvest_records FOR ALL USING (true) WITH CHECK (true);
