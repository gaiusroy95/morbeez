-- Track when customer accepts a quotation before checkout

ALTER TABLE commerce_quotes
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
