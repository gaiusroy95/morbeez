-- Farmer preferred market mapping for daily market-price targeting / personalization.

CREATE TABLE IF NOT EXISTS farmer_market_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  crop_type TEXT,
  market_name TEXT NOT NULL,
  district TEXT,
  priority INT NOT NULL DEFAULT 1 CHECK (priority >= 1),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_market_preferences_farmer
  ON farmer_market_preferences (farmer_id, crop_type, active, priority);

ALTER TABLE farmer_market_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY farmer_market_preferences_service
  ON farmer_market_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);
