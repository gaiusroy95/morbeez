-- Storefront banner registry (console-managed; theme sync is a follow-up)

CREATE TABLE IF NOT EXISTS commerce_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  badge TEXT,
  description TEXT,
  image_url TEXT,
  cta_label TEXT DEFAULT 'Shop now',
  cta_url TEXT,
  placement TEXT NOT NULL DEFAULT 'home_hero'
    CHECK (placement IN ('home_hero', 'collection_top', 'promo_strip')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_banners_dates ON commerce_banners (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_commerce_banners_placement ON commerce_banners (placement, active);

ALTER TABLE commerce_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY commerce_banners_service_role ON commerce_banners FOR ALL USING (true) WITH CHECK (true);
