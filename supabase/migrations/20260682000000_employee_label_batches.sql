-- Employee-wise label batches + QR verification for pick/pack

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_oms_status_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_oms_status_check
  CHECK (oms_status IN (
    'pending', 'assigned', 'confirmed', 'awb_generated', 'picking', 'packing',
    'awaiting_label_verification', 'packed', 'ready_dispatch', 'shipped',
    'delivered', 'completed', 'cancelled', 'returned'
  ));

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS assigned_employee_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_batch_id UUID,
  ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_assigned_batch
  ON commerce_orders(assigned_batch_id)
  WHERE assigned_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_assigned_employee
  ON commerce_orders(assigned_employee_id)
  WHERE assigned_employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS warehouse_label_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  assigned_employee_id TEXT NOT NULL,
  assigned_employee_name TEXT NOT NULL,
  batch_status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (batch_status IN ('draft', 'assigned', 'printed', 'picking', 'completed', 'cancelled')),
  total_orders INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  printed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_label_batches_employee
  ON warehouse_label_batches(assigned_employee_id, batch_status);

CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  label_batch_id UUID NOT NULL REFERENCES warehouse_label_batches(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL UNIQUE,
  assigned_employee_id TEXT NOT NULL,
  assigned_employee_name TEXT NOT NULL,
  print_sequence INTEGER NOT NULL DEFAULT 1 CHECK (print_sequence >= 1),
  label_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  awb TEXT,
  shiprocket_label_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (label_batch_id, commerce_order_id)
);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_order ON shipping_labels(commerce_order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_batch_seq
  ON shipping_labels(label_batch_id, print_sequence);

ALTER TABLE commerce_orders
  DROP CONSTRAINT IF EXISTS commerce_orders_assigned_batch_fk;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_assigned_batch_fk
  FOREIGN KEY (assigned_batch_id) REFERENCES warehouse_label_batches(id) ON DELETE SET NULL;
