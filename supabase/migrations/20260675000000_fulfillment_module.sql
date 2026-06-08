-- Unified fulfillment: Shiprocket on confirm, scan verification, dispatch racks

-- Extend OMS status flow
ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_oms_status_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_oms_status_check
  CHECK (oms_status IN (
    'pending', 'confirmed', 'awb_generated', 'picking', 'packed',
    'ready_dispatch', 'shipped', 'delivered', 'completed', 'cancelled', 'returned'
  ));

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS shiprocket_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shiprocket_shipment_id TEXT,
  ADD COLUMN IF NOT EXISTS label_url TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_rack TEXT,
  ADD COLUMN IF NOT EXISTS awb_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_dispatch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shiprocket_error TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (fulfillment_priority IN ('low', 'normal', 'high'));

CREATE INDEX IF NOT EXISTS idx_commerce_orders_fulfillment_priority
  ON commerce_orders(fulfillment_priority, oms_status);

-- Pack session scan state (rack → product → qty)
ALTER TABLE pack_sessions
  ADD COLUMN IF NOT EXISTS verified_rack TEXT,
  ADD COLUMN IF NOT EXISTS line_scan_counts JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scan_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Allow rack scan results in pack_scan_logs
ALTER TABLE pack_scan_logs DROP CONSTRAINT IF EXISTS pack_scan_logs_result_check;
ALTER TABLE pack_scan_logs
  ADD CONSTRAINT pack_scan_logs_result_check
  CHECK (result IN (
    'ok', 'wrong_product', 'wrong_batch', 'qty_mismatch', 'unknown',
    'rack_ok', 'rack_mismatch'
  ));
