-- Package rule engine: product packaging data, shipping box master, order shipment dimensions

-- ─── Standard shipping boxes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  length_cm DECIMAL(8, 2) NOT NULL CHECK (length_cm > 0),
  breadth_cm DECIMAL(8, 2) NOT NULL CHECK (breadth_cm > 0),
  height_cm DECIMAL(8, 2) NOT NULL CHECK (height_cm > 0),
  max_weight_kg DECIMAL(8, 3) NOT NULL CHECK (max_weight_kg > 0),
  tare_weight_kg DECIMAL(8, 3) NOT NULL DEFAULT 0.1 CHECK (tare_weight_kg >= 0),
  liquid_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_boxes (code, name, length_cm, breadth_cm, height_cm, max_weight_kg, tare_weight_kg, liquid_friendly, sort_order)
VALUES
  ('S1', 'Small box S1', 20, 15, 10, 2, 0.1, FALSE, 10),
  ('S2', 'Medium box S2', 24, 18, 12, 5, 0.15, FALSE, 20),
  ('M1', 'Medium box M1', 24, 18, 12, 5, 0.15, FALSE, 25),
  ('LQ-M1', 'Liquid-safe M1', 30, 22, 15, 8, 0.2, TRUE, 30),
  ('L1', 'Large box L1', 40, 30, 20, 15, 0.25, TRUE, 40)
ON CONFLICT (code) DO NOTHING;

-- ─── Product packaging attributes ────────────────────────────────────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS item_weight_kg DECIMAL(8, 3),
  ADD COLUMN IF NOT EXISTS packaging_category TEXT,
  ADD COLUMN IF NOT EXISTS preferred_box_code TEXT,
  ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_packaging_category_check;
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_packaging_category_check
  CHECK (packaging_category IS NULL OR packaging_category IN ('general', 'powder', 'granular', 'liquid', 'bottle'));

CREATE INDEX IF NOT EXISTS idx_inventory_items_preferred_box
  ON inventory_items(preferred_box_code)
  WHERE preferred_box_code IS NOT NULL;

-- ─── Order shipment package (auto-generated + confirmed) ─────────────────────
ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS package_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS suggested_box_id UUID REFERENCES shipping_boxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_box_id UUID REFERENCES shipping_boxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_length_cm DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS package_breadth_cm DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS package_height_cm DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS estimated_weight_kg DECIMAL(8, 3),
  ADD COLUMN IF NOT EXISTS package_weight_kg DECIMAL(8, 3),
  ADD COLUMN IF NOT EXISTS billing_weight_kg DECIMAL(8, 3),
  ADD COLUMN IF NOT EXISTS package_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS package_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS package_confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS package_estimate_meta JSONB NOT NULL DEFAULT '{}';

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_package_status_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_package_status_check
  CHECK (package_status IN ('pending', 'estimated', 'confirmed', 'label_generated'));

-- Extend OMS status for packaging automation flow
ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_oms_status_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_oms_status_check
  CHECK (oms_status IN (
    'pending', 'assigned', 'confirmed', 'packaging_estimated', 'ready_for_courier',
    'awb_generated', 'label_generated', 'picking', 'packing',
    'awaiting_label_verification', 'awaiting_tracking', 'packed', 'ready_dispatch', 'shipped',
    'delivered', 'completed', 'cancelled', 'returned'
  ));

CREATE INDEX IF NOT EXISTS idx_commerce_orders_package_status
  ON commerce_orders(package_status, oms_status);
