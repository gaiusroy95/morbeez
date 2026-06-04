-- Daily Market Insights image broadcast (WhatsApp Cloud)

CREATE TABLE IF NOT EXISTS market_insight_district_profiles (
  district_key TEXT PRIMARY KEY,
  market_display_label TEXT NOT NULL,
  market_name TEXT NOT NULL,
  district TEXT,
  chart_crop TEXT NOT NULL DEFAULT 'ginger',
  crop_cards JSONB NOT NULL DEFAULT '["ginger","pepper","coffee","cardamom"]'::jsonb,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO market_insight_district_profiles (
  district_key,
  market_display_label,
  market_name,
  district,
  chart_crop,
  crop_cards,
  latitude,
  longitude
)
VALUES (
  'wayanad',
  'Sulthan Bathery Market, Wayanad',
  'Wayanad',
  'Wayanad',
  'ginger',
  '["ginger","pepper","coffee","cardamom"]'::jsonb,
  11.6854,
  76.132
)
ON CONFLICT (district_key) DO UPDATE SET
  market_display_label = EXCLUDED.market_display_label,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS market_insight_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  insight_date DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  image_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending_build',
  failure_reason TEXT,
  wa_message_id TEXT,
  built_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farmer_id, insight_date)
);

CREATE INDEX IF NOT EXISTS idx_market_insight_snapshots_date_status
  ON market_insight_snapshots (insight_date, status);

ALTER TABLE market_insight_district_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_insight_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_insight_district_profiles_service
  ON market_insight_district_profiles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY market_insight_snapshots_service
  ON market_insight_snapshots FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'market-insights',
  'market-insights',
  true,
  5242880,
  ARRAY['image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY market_insights_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'market-insights');

CREATE POLICY market_insights_service_write ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'market-insights');

CREATE POLICY market_insights_service_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'market-insights');

CREATE POLICY market_insights_service_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'market-insights');
