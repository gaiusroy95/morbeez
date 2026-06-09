-- Farmer product reviews after delivery (farmer portal + future PDP aggregate)

CREATE TABLE IF NOT EXISTS farmer_product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  order_source TEXT NOT NULL CHECK (order_source IN ('commerce', 'crm_manual')),
  order_id UUID NOT NULL,
  product_key TEXT NOT NULL,
  product_title TEXT NOT NULL,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  sku TEXT,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT farmer_product_reviews_unique_line UNIQUE (farmer_id, order_source, order_id, product_key)
);

CREATE INDEX IF NOT EXISTS idx_farmer_product_reviews_farmer
  ON farmer_product_reviews (farmer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farmer_product_reviews_product
  ON farmer_product_reviews (shopify_product_id)
  WHERE shopify_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_product_reviews_variant
  ON farmer_product_reviews (shopify_variant_id)
  WHERE shopify_variant_id IS NOT NULL;
