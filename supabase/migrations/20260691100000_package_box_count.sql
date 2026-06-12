-- Multi-box packaging: units per shipping box on products, box count on orders

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS units_per_box DECIMAL(12, 3);

COMMENT ON COLUMN inventory_items.units_per_box IS
  'How many product units (L, kg, pcs) fit in one shipping box. Used to compute courier box count.';

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS package_box_count INTEGER;

COMMENT ON COLUMN commerce_orders.package_box_count IS
  'Number of physical shipping boxes for this order (shown to courier / customer).';
