-- Commerce inventory batches (Shopify variant stock receipts)

CREATE TABLE commerce_stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  batch_code TEXT NOT NULL,
  mfg_date DATE,
  expiry_date DATE,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shopify_variant_id, batch_code)
);

CREATE INDEX idx_commerce_stock_batches_variant ON commerce_stock_batches(shopify_variant_id);
CREATE INDEX idx_commerce_stock_batches_product ON commerce_stock_batches(shopify_product_id);
