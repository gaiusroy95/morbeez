-- Link commerce quotes (estimates) to telecaller leads / farmers

ALTER TABLE commerce_quotes
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_quotes_lead ON commerce_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_commerce_quotes_farmer ON commerce_quotes(farmer_id);
