-- Shiprocket vs manual logistics (GRL, ST Courier, bus, etc.)

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT 'shiprocket',
  ADD COLUMN IF NOT EXISTS tracking_status TEXT;

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_shipping_method_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_shipping_method_check
  CHECK (shipping_method IN ('shiprocket', 'manual'));

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_oms_status_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_oms_status_check
  CHECK (oms_status IN (
    'pending', 'assigned', 'confirmed', 'awb_generated', 'picking', 'packing',
    'awaiting_label_verification', 'awaiting_tracking', 'packed', 'ready_dispatch', 'shipped',
    'delivered', 'completed', 'cancelled', 'returned'
  ));

CREATE INDEX IF NOT EXISTS idx_commerce_orders_awaiting_tracking
  ON commerce_orders(oms_status, shipping_method)
  WHERE oms_status = 'awaiting_tracking';
