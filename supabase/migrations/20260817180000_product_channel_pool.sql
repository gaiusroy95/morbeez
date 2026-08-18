-- Versioned Channel Pool per SKU (slowly changing). Never overwrite history.
-- Orders/incentives snapshot the version effective on the transaction date.

CREATE TABLE IF NOT EXISTS product_channel_pool_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  sku TEXT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  pool_pct NUMERIC(6, 2) NOT NULL CHECK (pool_pct >= 0 AND pool_pct <= 100),
  previous_pool_pct NUMERIC(6, 2),
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'closed')),
  change_reason TEXT NOT NULL,
  edited_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (variant_id, version_number),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_channel_pool_product
  ON product_channel_pool_versions (product_id, variant_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_channel_pool_lookup
  ON product_channel_pool_versions (variant_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_channel_pool_sku_lookup
  ON product_channel_pool_versions (sku, effective_from)
  WHERE sku IS NOT NULL;

COMMENT ON TABLE product_channel_pool_versions IS
  'SKU Channel Pool history. Current rate is the version effective on a given date; never mutate past rows.';

ALTER TABLE product_channel_pool_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_channel_pool_versions_all ON product_channel_pool_versions;
CREATE POLICY product_channel_pool_versions_all
  ON product_channel_pool_versions FOR ALL USING (true) WITH CHECK (true);

-- Snapshot on employee incentive ledger (historical protection)
ALTER TABLE employee_sales_ledger
  ADD COLUMN IF NOT EXISTS channel_pool_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS channel_pool_version_id UUID,
  ADD COLUMN IF NOT EXISTS channel_pool_version_label TEXT,
  ADD COLUMN IF NOT EXISTS channel_pool_effective_from DATE,
  ADD COLUMN IF NOT EXISTS channel_pool_amount NUMERIC(12, 2);

-- Snapshot on warehouse order lines
ALTER TABLE commerce_order_lines
  ADD COLUMN IF NOT EXISTS channel_pool_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS channel_pool_version_id UUID,
  ADD COLUMN IF NOT EXISTS channel_pool_version_label TEXT,
  ADD COLUMN IF NOT EXISTS channel_pool_effective_from DATE;

-- Snapshot on partner earnings (metadata-backed columns)
ALTER TABLE partner_earnings_ledger
  ADD COLUMN IF NOT EXISTS channel_pool_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS channel_pool_version_id UUID,
  ADD COLUMN IF NOT EXISTS channel_pool_version_label TEXT;

-- Dedicated RBAC module (not the same as catalog commerce write)
INSERT INTO role_module_permissions (role, module_key, can_read, can_write) VALUES
  ('super_admin', 'channel_pool', true, true),
  ('admin', 'channel_pool', true, true),
  ('manager', 'channel_pool', true, true),
  ('operations', 'channel_pool', true, false),
  ('agronomist', 'channel_pool', true, false)
ON CONFLICT (role, module_key) DO UPDATE
SET can_read = EXCLUDED.can_read,
    can_write = EXCLUDED.can_write;
