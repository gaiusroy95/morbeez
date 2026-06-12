-- Link console banners to Shopify theme sections for import/sync

ALTER TABLE commerce_banners
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_banners_source_ref
  ON commerce_banners (source_ref)
  WHERE source_ref IS NOT NULL;

-- Default banners from theme/templates/index.json (hero carousel + seasonal strip)
INSERT INTO commerce_banners (
  title,
  badge,
  description,
  cta_label,
  cta_url,
  placement,
  starts_at,
  ends_at,
  sort_order,
  active,
  source_ref
)
VALUES
  (
    'Science-backed CROP CARE for every Indian farmer',
    'Morbeez — Grow with Experts',
    'Homepage hero slide 1',
    'Shop products',
    '/collections/all',
    'home_hero',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '365 days',
    0,
    TRUE,
    'theme:hero:slide_1'
  ),
  (
    'MORBEEZ Trusted agri inputs',
    'Bio fertilizers · Bio pesticides · Advisory',
    'Homepage hero slide 2',
    'Talk on WhatsApp',
    '/pages/contact',
    'home_hero',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '365 days',
    1,
    TRUE,
    'theme:hero:slide_2'
  ),
  (
    'Monsoon crop protection essentials',
    'Season alert',
    'Prepare fields before heavy rains.',
    'Shop monsoon essentials',
    '/collections/all',
    'promo_strip',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '365 days',
    0,
    TRUE,
    'theme:seasonal:seasonal'
  )
ON CONFLICT (source_ref) WHERE (source_ref IS NOT NULL) DO NOTHING;
