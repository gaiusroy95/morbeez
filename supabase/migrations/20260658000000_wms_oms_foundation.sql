-- WMS + OMS foundation: warehouse, batches, pick/pack, GST invoices, NDR/RTO, COD reconciliation

-- ─── Extend commerce orders for OMS workflow ───────────────────────────────
ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS oms_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (oms_status IN (
      'pending', 'confirmed', 'picking', 'packed', 'shipped', 'delivered', 'completed', 'cancelled', 'returned'
    )),
  ADD COLUMN IF NOT EXISTS customer_state TEXT,
  ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_oms_status ON commerce_orders(oms_status);

-- ─── Warehouses & locations ────────────────────────────────────────────────
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address_line TEXT,
  city TEXT,
  state TEXT NOT NULL,
  pincode TEXT,
  gstin TEXT,
  shiprocket_pickup_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone TEXT NOT NULL DEFAULT 'A',
  rack TEXT NOT NULL,
  shelf TEXT,
  bin TEXT,
  location_code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, location_code)
);

CREATE INDEX idx_warehouse_locations_wh ON warehouse_locations(warehouse_id);

-- ─── Suppliers & catalog ───────────────────────────────────────────────────
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  gstin TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  shopify_variant_id TEXT,
  product_title TEXT NOT NULL,
  barcode TEXT,
  hsn_code TEXT,
  gst_percent DECIMAL(5, 2) NOT NULL DEFAULT 18,
  unit TEXT NOT NULL DEFAULT 'pcs',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_items_variant ON inventory_items(shopify_variant_id);
CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode) WHERE barcode IS NOT NULL;

-- ─── Purchase orders & goods receipt ───────────────────────────────────────
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled')),
  notes TEXT,
  ordered_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  qty_ordered INTEGER NOT NULL CHECK (qty_ordered > 0),
  qty_received INTEGER NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
  unit_cost DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT NOT NULL UNIQUE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  received_by TEXT,
  notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Batch-wise stock ──────────────────────────────────────────────────────
CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code TEXT NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  goods_receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
  mfg_date DATE,
  expiry_date DATE,
  qty_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_reserved INTEGER NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  qty_damaged INTEGER NOT NULL DEFAULT 0 CHECK (qty_damaged >= 0),
  qty_returned INTEGER NOT NULL DEFAULT 0 CHECK (qty_returned >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'quarantine', 'expired', 'depleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_item_id, batch_code, warehouse_id)
);

CREATE INDEX idx_inventory_batches_item ON inventory_batches(inventory_item_id);
CREATE INDEX idx_inventory_batches_expiry ON inventory_batches(expiry_date) WHERE status = 'active';

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN (
      'grn', 'reserve', 'pick', 'pack', 'adjust', 'transfer', 'damage', 'return_restock', 'return_writeoff', 'release'
    )),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX idx_stock_movements_ref ON stock_movements(ref_type, ref_id);

-- ─── Order lines & allocation ──────────────────────────────────────────────
CREATE TABLE commerce_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  shopify_line_id TEXT,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  sku TEXT,
  product_title TEXT NOT NULL,
  variant_title TEXT,
  qty_ordered INTEGER NOT NULL CHECK (qty_ordered > 0),
  qty_allocated INTEGER NOT NULL DEFAULT 0,
  qty_picked INTEGER NOT NULL DEFAULT 0,
  qty_packed INTEGER NOT NULL DEFAULT 0,
  qty_shipped INTEGER NOT NULL DEFAULT 0,
  qty_cancelled INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  hsn_code TEXT,
  gst_percent DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commerce_order_lines_order ON commerce_order_lines(commerce_order_id);
CREATE UNIQUE INDEX idx_commerce_order_lines_shopify_line
  ON commerce_order_lines(commerce_order_id, shopify_line_id)
  WHERE shopify_line_id IS NOT NULL;

CREATE TABLE order_line_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID NOT NULL REFERENCES commerce_order_lines(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES inventory_batches(id),
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  qty_allocated INTEGER NOT NULL CHECK (qty_allocated > 0),
  qty_picked INTEGER NOT NULL DEFAULT 0,
  qty_packed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Pick / pack workflow ────────────────────────────────────────────────────
CREATE TABLE pick_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_number TEXT NOT NULL UNIQUE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'picking', 'completed', 'cancelled')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE pick_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_wave_id UUID REFERENCES pick_waves(id) ON DELETE SET NULL,
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'picking', 'picked', 'verified', 'packed', 'cancelled')),
  picker_id TEXT,
  picked_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commerce_order_id)
);

CREATE TABLE pick_list_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES commerce_order_lines(id) ON DELETE SET NULL,
  allocation_id UUID REFERENCES order_line_allocations(id) ON DELETE SET NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  sku TEXT,
  batch_code TEXT,
  rack_location TEXT,
  qty_required INTEGER NOT NULL CHECK (qty_required > 0),
  qty_picked INTEGER NOT NULL DEFAULT 0,
  manually_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pack_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verified', 'failed')),
  verification_mode TEXT NOT NULL DEFAULT 'manual' CHECK (verification_mode IN ('barcode', 'manual')),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pack_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_session_id UUID NOT NULL REFERENCES pack_sessions(id) ON DELETE CASCADE,
  scanned_code TEXT NOT NULL,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  result TEXT NOT NULL CHECK (result IN ('ok', 'wrong_product', 'wrong_batch', 'qty_mismatch', 'unknown')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Invoicing & quotations ────────────────────────────────────────────────
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID REFERENCES commerce_orders(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'tax_invoice'
    CHECK (document_type IN ('tax_invoice', 'quotation', 'delivery_challan', 'credit_note')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  customer_name TEXT,
  customer_gstin TEXT,
  customer_state TEXT,
  place_of_supply TEXT,
  company_gstin TEXT,
  company_state TEXT,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  cgst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sgst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  igst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  freight DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  validity_date DATE,
  razorpay_payment_link_id TEXT,
  razorpay_payment_link_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hsn_code TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  taxable_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  gst_percent DECIMAL(5, 2) NOT NULL DEFAULT 18,
  cgst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sgst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  igst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  batch_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── NDR / RTO & COD reconciliation ────────────────────────────────────────
CREATE TABLE shipment_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id TEXT NOT NULL,
  commerce_order_id UUID REFERENCES commerce_orders(id) ON DELETE SET NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('ndr', 'rto', 'delay', 'lost')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reattempt', 'resolved', 'rto_received', 'restocked', 'written_off')),
  courier_payload JSONB,
  customer_verified BOOLEAN NOT NULL DEFAULT FALSE,
  qc_status TEXT CHECK (qc_status IN ('pending', 'pass', 'damage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipment_exceptions_order ON shipment_exceptions(shopify_order_id);

CREATE TABLE cod_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  cod_amount DECIMAL(12, 2) NOT NULL,
  courier_remittance DECIMAL(12, 2),
  remittance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (remittance_status IN ('pending', 'partial', 'cleared', 'mismatch')),
  courier_name TEXT,
  remittance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commerce_order_id)
);

-- ─── Finance snapshot (daily rollup) ───────────────────────────────────────
CREATE TABLE finance_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  gross_sales DECIMAL(14, 2) NOT NULL DEFAULT 0,
  gst_liability DECIMAL(14, 2) NOT NULL DEFAULT 0,
  pending_cod DECIMAL(14, 2) NOT NULL DEFAULT 0,
  refunds DECIMAL(14, 2) NOT NULL DEFAULT 0,
  outstanding_payments DECIMAL(14, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RBAC: warehouse module ────────────────────────────────────────────────
INSERT INTO role_module_permissions (role, module_key, can_read, can_write)
VALUES
  ('super_admin', 'warehouse', true, true),
  ('admin', 'warehouse', true, true),
  ('operations', 'warehouse', true, true),
  ('manager', 'warehouse', true, false),
  ('viewer', 'warehouse', true, false)
ON CONFLICT (role, module_key) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write;

-- ─── Seed default warehouse ────────────────────────────────────────────────
INSERT INTO warehouses (code, name, state, shiprocket_pickup_name, is_default)
VALUES ('WH-A', 'Warehouse A', 'Karnataka', 'Primary', TRUE)
ON CONFLICT (code) DO NOTHING;
