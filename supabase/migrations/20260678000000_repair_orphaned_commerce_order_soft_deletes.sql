-- Orders hidden from Commerce (deleted_at) but still in Warehouse (active oms_status)

UPDATE commerce_orders
SET
  deleted_at = NULL,
  updated_at = NOW()
WHERE deleted_at IS NOT NULL
  AND oms_status IN ('confirmed', 'awb_generated', 'picking', 'packed', 'ready_dispatch', 'shipped', 'delivered');

-- Legacy backfill: voided rows should not stay in warehouse queue
UPDATE commerce_orders
SET
  oms_status = 'cancelled',
  updated_at = NOW()
WHERE deleted_at IS NOT NULL
  AND oms_status IN ('pending', 'confirmed', 'awb_generated', 'picking', 'packed', 'ready_dispatch')
  AND financial_status = 'voided'
  AND payment_status = 'cancelled'
  AND fulfillment_status = 'cancelled';
