-- Finalized retail/bulk incentive, KPI scoring, quarterly bonus

ALTER TABLE pricing_engine_config
  ADD COLUMN IF NOT EXISTS monthly_sales_target_inr NUMERIC(14, 2) NOT NULL DEFAULT 600000,
  ADD COLUMN IF NOT EXISTS bulk_order_threshold_inr NUMERIC(14, 2) NOT NULL DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS bulk_profit_bonus_pct NUMERIC(6, 2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS bulk_min_gross_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS retail_base_incentive_0_50 NUMERIC(6, 4) NOT NULL DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS retail_base_incentive_50_80 NUMERIC(6, 4) NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS retail_base_incentive_80_100 NUMERIC(6, 4) NOT NULL DEFAULT 0.03,
  ADD COLUMN IF NOT EXISTS retail_base_incentive_100_plus NUMERIC(6, 4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS realization_mult_95_plus NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS realization_mult_90_95 NUMERIC(6, 4) NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS realization_mult_85_90 NUMERIC(6, 4) NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS realization_mult_below_85 NUMERIC(6, 4) NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS quarterly_bonus_a_plus NUMERIC(12, 2) NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS quarterly_bonus_a NUMERIC(12, 2) NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS a_plus_min_realization_pct NUMERIC(6, 2) NOT NULL DEFAULT 90;

-- Monthly KPI score (100-point model)
CREATE TABLE IF NOT EXISTS employee_monthly_kpi_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  month_year TEXT NOT NULL,
  sales_volume_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sales_target_inr NUMERIC(14, 2) NOT NULL DEFAULT 600000,
  sales_achievement_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  avg_realization_pct NUMERIC(8, 4) NOT NULL DEFAULT 100,
  gross_profit_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_profit_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  incentive_earned_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  repeat_customers INTEGER NOT NULL DEFAULT 0,
  collection_efficiency_pct NUMERIC(8, 4) NOT NULL DEFAULT 100,
  return_complaint_count INTEGER NOT NULL DEFAULT 0,
  score_sales NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_realization NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_profit NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_repeat NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_collection NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_returns NUMERIC(6, 2) NOT NULL DEFAULT 0,
  total_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'B'
    CHECK (grade IN ('A+', 'A', 'B', 'C', 'Risk')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_profile_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_employee_monthly_kpi_month
  ON employee_monthly_kpi_scores(month_year DESC, total_score DESC);

-- Quarterly bonus ledger
CREATE TABLE IF NOT EXISTS employee_quarterly_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  quarter_key TEXT NOT NULL,
  avg_monthly_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  avg_realization_pct NUMERIC(8, 4) NOT NULL DEFAULT 100,
  grade TEXT NOT NULL DEFAULT 'B',
  bonus_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus_eligible BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'blocked')),
  notes TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_profile_id, quarter_key)
);

ALTER TABLE employee_sales_ledger
  ADD COLUMN IF NOT EXISTS order_value_inr NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS retail_or_bulk TEXT NOT NULL DEFAULT 'retail'
    CHECK (retail_or_bulk IN ('retail', 'bulk'));

ALTER TABLE employee_performance_snapshots
  ADD COLUMN IF NOT EXISTS kpi_score NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS kpi_grade TEXT;

ALTER TABLE employee_monthly_kpi_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_quarterly_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_monthly_kpi_scores_all ON employee_monthly_kpi_scores FOR ALL USING (true);
CREATE POLICY employee_quarterly_bonuses_all ON employee_quarterly_bonuses FOR ALL USING (true);
