-- Link SEO content pages to Shopify Online Store pages

ALTER TABLE seo_content_pages
  ADD COLUMN IF NOT EXISTS shopify_page_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_seo_content_pages_shopify_page
  ON seo_content_pages(shopify_page_id)
  WHERE shopify_page_id IS NOT NULL;
