-- Dynamic packaging intelligence engine (categories, rules, order packages, courier audit)

-- ─── Packaging categories (fully dynamic classification) ─────────────────────
CREATE TABLE IF NOT EXISTS packaging_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO packaging_categories (name, description, priority)
VALUES
  ('General', 'Default fallback category', 0),
  ('Powder', 'Powder and granular products', 10),
  ('Small Packet', 'Small lightweight packets', 20),
  ('Fragile', 'Fragile items requiring careful packing', 30),
  ('Liquid', 'Liquids and bottles', 40),
  ('Heavy Item', 'Heavy bulk shipments', 50)
ON CONFLICT (name) DO NOTHING;

-- ─── Packaging settings (weight rules, volumetric divisor — no hardcoding) ───
CREATE TABLE IF NOT EXISTS packaging_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO packaging_settings (key, value, description)
VALUES
  ('default_unit_weight_kg', to_jsonb(0.15::numeric), 'Fallback dead weight per unit when product weight is unset'),
  ('volumetric_divisor_cm', to_jsonb(5000::numeric), 'L×W×H ÷ divisor for volumetric billing weight (cm/kg)'),
  ('min_billing_weight_kg', to_jsonb(0.2::numeric), 'Minimum chargeable weight sent to couriers')
ON CONFLICT (key) DO NOTHING;

-- ─── Extend box types (shipping_boxes) ───────────────────────────────────────
ALTER TABLE shipping_boxes
  ADD COLUMN IF NOT EXISTS packaging_type TEXT;

UPDATE shipping_boxes SET packaging_type = 'liquid_safe' WHERE liquid_friendly = TRUE AND packaging_type IS NULL;
UPDATE shipping_boxes SET packaging_type = 'standard' WHERE packaging_type IS NULL;

INSERT INTO shipping_boxes (code, name, length_cm, breadth_cm, height_cm, max_weight_kg, tare_weight_kg, liquid_friendly, packaging_type, sort_order)
VALUES ('LQ-S1', 'Liquid small LQ-S1', 24, 18, 12, 5, 0.15, TRUE, 'liquid_safe', 15)
ON CONFLICT (code) DO NOTHING;

INSERT INTO shipping_boxes (code, name, length_cm, breadth_cm, height_cm, max_weight_kg, tare_weight_kg, liquid_friendly, packaging_type, sort_order)
VALUES ('FR-M1', 'Fragile medium FR-M1', 28, 20, 14, 6, 0.2, FALSE, 'fragile', 35)
ON CONFLICT (code) DO NOTHING;

-- ─── Product packaging intelligence (inventory_items FKs) ────────────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS packaging_category_id UUID REFERENCES packaging_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_box_id UUID REFERENCES shipping_boxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stackable BOOLEAN NOT NULL DEFAULT TRUE;

-- Migrate legacy text categories to dynamic FK
UPDATE inventory_items ii
SET packaging_category_id = pc.id
FROM packaging_categories pc
WHERE ii.packaging_category_id IS NULL
  AND ii.packaging_category IS NOT NULL
  AND lower(pc.name) = lower(ii.packaging_category);

UPDATE inventory_items ii
SET packaging_category_id = pc.id
FROM packaging_categories pc
WHERE ii.packaging_category_id IS NULL
  AND ii.is_liquid = TRUE
  AND pc.name = 'Liquid';

UPDATE inventory_items ii
SET preferred_box_id = sb.id
FROM shipping_boxes sb
WHERE ii.preferred_box_id IS NULL
  AND ii.preferred_box_code IS NOT NULL
  AND sb.code = ii.preferred_box_code;

CREATE INDEX IF NOT EXISTS idx_inventory_items_packaging_category
  ON inventory_items(packaging_category_id)
  WHERE packaging_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_preferred_box_id
  ON inventory_items(preferred_box_id)
  WHERE preferred_box_id IS NOT NULL;

-- ─── Package rules (dynamic decision engine) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS package_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_category_id UUID NOT NULL REFERENCES packaging_categories(id) ON DELETE CASCADE,
  min_weight_kg DECIMAL(8, 3) NOT NULL DEFAULT 0 CHECK (min_weight_kg >= 0),
  max_weight_kg DECIMAL(8, 3) NOT NULL CHECK (max_weight_kg > min_weight_kg),
  preferred_box_id UUID NOT NULL REFERENCES shipping_boxes(id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_rules_category_active
  ON package_rules(packaging_category_id, active, priority DESC);

-- Seed rules from category + box codes (idempotent via NOT EXISTS)
INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 0, 2, sb.id, 100
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'Powder' AND sb.code = 'S1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r
    WHERE r.packaging_category_id = pc.id AND r.min_weight_kg = 0 AND r.max_weight_kg = 2
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 0, 5, sb.id, 100
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'Liquid' AND sb.code = 'LQ-S1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r
    WHERE r.packaging_category_id = pc.id AND r.min_weight_kg = 0 AND r.max_weight_kg = 5
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 5, 10, sb.id, 90
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'Liquid' AND sb.code = 'LQ-M1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r
    WHERE r.packaging_category_id = pc.id AND r.min_weight_kg = 5 AND r.max_weight_kg = 10
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 0, 2, sb.id, 100
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'Small Packet' AND sb.code = 'S1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r WHERE r.packaging_category_id = pc.id AND r.max_weight_kg = 2 AND sb.code = 'S1'
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 0, 6, sb.id, 100
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'Fragile' AND sb.code = 'FR-M1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r WHERE r.packaging_category_id = pc.id AND sb.code = 'FR-M1'
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 10, 15, sb.id, 100
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'Heavy Item' AND sb.code = 'L1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r WHERE r.packaging_category_id = pc.id AND sb.code = 'L1'
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 0, 5, sb.id, 50
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'General' AND sb.code = 'S2'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r WHERE r.packaging_category_id = pc.id AND r.max_weight_kg = 5 AND sb.code = 'S2'
  );

INSERT INTO package_rules (packaging_category_id, min_weight_kg, max_weight_kg, preferred_box_id, priority)
SELECT pc.id, 5, 15, sb.id, 40
FROM packaging_categories pc, shipping_boxes sb
WHERE pc.name = 'General' AND sb.code = 'L1'
  AND NOT EXISTS (
    SELECT 1 FROM package_rules r WHERE r.packaging_category_id = pc.id AND r.max_weight_kg = 15 AND sb.code = 'L1'
  );

-- ─── Order package output (generated by engine) ──────────────────────────────
CREATE TABLE IF NOT EXISTS order_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE CASCADE,
  packaging_category_id UUID REFERENCES packaging_categories(id) ON DELETE SET NULL,
  suggested_box_id UUID REFERENCES shipping_boxes(id) ON DELETE SET NULL,
  selected_box_id UUID REFERENCES shipping_boxes(id) ON DELETE SET NULL,
  matched_rule_id UUID REFERENCES package_rules(id) ON DELETE SET NULL,
  estimated_weight_kg DECIMAL(8, 3),
  volumetric_weight_kg DECIMAL(8, 3),
  billing_weight_kg DECIMAL(8, 3),
  length_cm DECIMAL(8, 2),
  breadth_cm DECIMAL(8, 2),
  height_cm DECIMAL(8, 2),
  override_used BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'estimated'
    CHECK (status IN ('pending', 'estimated', 'confirmed', 'label_generated')),
  estimate_meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_packages_status ON order_packages(status);

-- ─── Courier payload audit trail ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courier_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  courier_name TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}',
  awb_number TEXT,
  label_url TEXT,
  api_response JSONB,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_payloads_order ON courier_payloads(commerce_order_id, created_at DESC);
