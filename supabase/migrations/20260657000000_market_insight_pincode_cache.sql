-- Daily AI-fetched market + weather snapshot per farmer pincode (shared by all farmers in same PIN)

CREATE TABLE IF NOT EXISTS market_insight_pincode_cache (
  pincode CHAR(6) NOT NULL,
  insight_date DATE NOT NULL,
  district TEXT,
  payload JSONB NOT NULL,
  model TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pincode, insight_date)
);

CREATE INDEX IF NOT EXISTS idx_market_insight_pincode_cache_date
  ON market_insight_pincode_cache (insight_date DESC);

ALTER TABLE market_insight_pincode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_insight_pincode_cache_service
  ON market_insight_pincode_cache FOR ALL USING (true) WITH CHECK (true);
