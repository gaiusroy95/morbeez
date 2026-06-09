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

UPDATE checkout_sessions
SET deleted_at = updated_at
WHERE deleted_at IS NULL
  AND status = 'cancelled';
