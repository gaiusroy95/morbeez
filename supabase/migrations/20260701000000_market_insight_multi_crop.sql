-- Multi-crop Market Insight: dynamic crops, mandi master, historical aggregates

CREATE TABLE IF NOT EXISTS crop_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name TEXT NOT NULL UNIQUE,
  icon TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_markets_active
  ON crop_markets (active_status, display_order, crop_name);

CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name TEXT NOT NULL,
  district TEXT,
  state TEXT,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  active_status BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market_name, district)
);

CREATE INDEX IF NOT EXISTS idx_markets_active
  ON markets (active_status, display_order, market_name);

CREATE TABLE IF NOT EXISTS market_historical_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop TEXT NOT NULL,
  market_name TEXT NOT NULL,
  year INT NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  average_price NUMERIC(12, 2) NOT NULL CHECK (average_price >= 0),
  sample_count INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop, market_name, year, month)
);

CREATE INDEX IF NOT EXISTS idx_market_historical_crop_market
  ON market_historical_prices (crop, market_name, year DESC, month DESC);

ALTER TABLE crop_daily_prices
  ADD COLUMN IF NOT EXISTS price_change_inr NUMERIC(10, 2);

-- Seed dynamic crops
INSERT INTO crop_markets (crop_name, icon, display_order) VALUES
  ('ginger', '🫚', 10),
  ('pepper', '🌶️', 20),
  ('banana', '🍌', 30),
  ('turmeric', '🟡', 40),
  ('cardamom', '🟢', 50)
ON CONFLICT (crop_name) DO NOTHING;

-- Seed common mandis (align with crop_daily_prices seed markets)
INSERT INTO markets (market_name, district, state, is_preferred, display_order) VALUES
  ('Kochi', 'Ernakulam', 'Kerala', true, 10),
  ('Bangalore', 'Bengaluru Urban', 'Karnataka', false, 20),
  ('Mysore', 'Mysuru', 'Karnataka', false, 30),
  ('Wayanad', 'Wayanad', 'Kerala', false, 40),
  ('Idukki', 'Idukki', 'Kerala', false, 50)
ON CONFLICT (market_name, district) DO NOTHING;

ALTER TABLE crop_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_historical_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY crop_markets_service ON crop_markets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY markets_service ON markets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY market_historical_prices_service ON market_historical_prices FOR ALL USING (true) WITH CHECK (true);
