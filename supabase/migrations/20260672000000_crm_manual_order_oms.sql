-- Link CRM manual orders to commerce_orders for WMS/OMS fulfillment

ALTER TABLE crm_manual_orders
  ADD COLUMN IF NOT EXISTS commerce_order_id UUID REFERENCES commerce_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_manual_orders_commerce
  ON crm_manual_orders(commerce_order_id)
  WHERE commerce_order_id IS NOT NULL;
