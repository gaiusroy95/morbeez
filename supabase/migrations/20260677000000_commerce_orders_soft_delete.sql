-- Soft-delete for commerce orders and checkout sessions (admin delete hides from list)

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_deleted_at
  ON commerce_orders(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_deleted_at
  ON checkout_sessions(deleted_at)
  WHERE deleted_at IS NULL;

-- Hide orders previously "deleted" via admin cancel-only path
UPDATE commerce_orders
SET deleted_at = updated_at
WHERE deleted_at IS NULL
  AND financial_status = 'voided'
  AND payment_status = 'cancelled'
  AND fulfillment_status = 'cancelled';

-- Expire checkout sessions tied to admin-deleted commerce orders
UPDATE checkout_sessions cs
SET
  status = 'expired',
  deleted_at = COALESCE(cs.deleted_at, co.deleted_at, NOW()),
  updated_at = NOW()
FROM commerce_orders co
WHERE cs.shopify_order_id = co.shopify_order_id
  AND co.deleted_at IS NOT NULL
  AND cs.deleted_at IS NULL
  AND cs.status IN ('paid', 'pending', 'failed');
