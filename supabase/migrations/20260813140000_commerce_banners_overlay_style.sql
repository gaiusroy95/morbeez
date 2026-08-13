-- Per-banner overlay style so offer art can match headline color/size.

ALTER TABLE commerce_banners
  ADD COLUMN IF NOT EXISTS image_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heading_color TEXT,
  ADD COLUMN IF NOT EXISTS highlight_color TEXT,
  ADD COLUMN IF NOT EXISTS text_size TEXT NOT NULL DEFAULT 'md';
