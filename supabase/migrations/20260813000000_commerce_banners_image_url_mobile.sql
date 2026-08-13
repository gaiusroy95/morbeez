-- Separate mobile hero art so desktop banners are never squeezed on phones.

ALTER TABLE commerce_banners
  ADD COLUMN IF NOT EXISTS image_url_mobile TEXT;
