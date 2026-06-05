-- Dynamic pricing, landed cost, weighted average, incentives, employee performance

-- ─── Global pricing engine config (single row) ───────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_engine_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_gross_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 30,
  recommended_pct_of_listed NUMERIC(6, 2) NOT NULL DEFAULT 95,
  safe_margin_pct_of_gross NUMERIC(6, 2) NOT NULL DEFAULT 50,
  hard_floor_margin_pct_of_gross NUMERIC(6, 2) NOT NULL DEFAULT 27,
  incentive_factor NUMERIC(6, 4) NOT NULL DEFAULT 0.20,
  platform_cost_pct NUMERIC(6, 2) NOT NULL DEFAULT 2,
  ad_allocation_pct NUMERIC(6, 2) NOT NULL DEFAULT 3,
  return_risk_pct NUMERIC(6, 2) NOT NULL DEFAULT 2,
  realization_excellent NUMERIC(6, 2) NOT NULL DEFAULT 95,
  realization_good NUMERIC(6, 2) NOT NULL DEFAULT 90,
  realization_warning NUMERIC(6, 2) NOT NULL DEFAULT 85,
  bulk_bonus_25k NUMERIC(12, 2) NOT NULL DEFAULT 300,
  bulk_bonus_50k NUMERIC(12, 2) NOT NULL DEFAULT 700,
  bulk_bonus_100k NUMERIC(12, 2) NOT NULL DEFAULT 1500,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pricing_engine_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM pricing_engine_config);

-- ─── Product effective cost + safe price tiers ───────────────────────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS weighted_avg_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS cost_qty_on_hand INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_cost_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS product_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  shopify_variant_id TEXT,
  sku TEXT,
  listed_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  recommended_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  safe_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hard_floor_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  effective_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  recalculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_tiers_variant
  ON product_pricing_tiers(shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_tiers_sku
  ON product_pricing_tiers(sku);

-- ─── Batch landed cost on GRN ───────────────────────────────────────────────
ALTER TABLE inventory_batches
  ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customs_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS misc_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landed_unit_cost NUMERIC(12, 2);

-- ─── Employee sales ledger (quote/order profit + incentive) ─────────────────
CREATE TABLE IF NOT EXISTS employee_sales_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  commerce_quote_id UUID REFERENCES commerce_quotes(id) ON DELETE SET NULL,
  commerce_order_id UUID REFERENCES commerce_orders(id) ON DELETE SET NULL,
  lead_id UUID,
  variant_id BIGINT,
  sku TEXT,
  product_title TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  listed_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  realization_pct NUMERIC(8, 4) NOT NULL DEFAULT 100,
  effective_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  incentive_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  order_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (order_type IN ('standard', 'bulk', 'clearance', 'strategic', 'liquidation')),
  sales_source TEXT NOT NULL DEFAULT 'telecaller'
    CHECK (sales_source IN ('telecaller', 'whatsapp', 'website', 'quotation')),
  customer_type TEXT,
  status TEXT NOT NULL DEFAULT 'quoted'
    CHECK (status IN ('quoted', 'confirmed', 'paid', 'cancelled', 'returned')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_sales_ledger_admin
  ON employee_sales_ledger(admin_user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_sales_ledger_profile
  ON employee_sales_ledger(employee_profile_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_sales_ledger_quote
  ON employee_sales_ledger(commerce_quote_id);

-- ─── Daily employee performance snapshots ───────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily', 'weekly', 'monthly')),
  sales_volume_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  avg_realization_pct NUMERIC(8, 4) NOT NULL DEFAULT 100,
  gross_profit_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_profit_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  incentive_earned_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  repeat_customers INTEGER NOT NULL DEFAULT 0,
  return_count INTEGER NOT NULL DEFAULT 0,
  performance_status TEXT NOT NULL DEFAULT 'good'
    CHECK (performance_status IN ('excellent', 'good', 'warning', 'critical', 'restricted')),
  action_stage INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_profile_id, snapshot_date, period)
);

CREATE INDEX IF NOT EXISTS idx_employee_performance_date
  ON employee_performance_snapshots(snapshot_date DESC, performance_status);

-- Quote-level pricing summary (employee-safe fields stored in line_items JSONB)
ALTER TABLE commerce_quotes
  ADD COLUMN IF NOT EXISTS pricing_summary JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_incentive NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_realization_pct NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (order_type IN ('standard', 'bulk', 'clearance', 'strategic', 'liquidation'));

ALTER TABLE employee_compensation
  ADD COLUMN IF NOT EXISTS incentive_factor NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS pricing_access_restricted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS performance_action_stage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pricing_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sales_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_engine_config_all ON pricing_engine_config FOR ALL USING (true);
CREATE POLICY product_pricing_tiers_all ON product_pricing_tiers FOR ALL USING (true);
CREATE POLICY employee_sales_ledger_all ON employee_sales_ledger FOR ALL USING (true);
CREATE POLICY employee_performance_snapshots_all ON employee_performance_snapshots FOR ALL USING (true);
