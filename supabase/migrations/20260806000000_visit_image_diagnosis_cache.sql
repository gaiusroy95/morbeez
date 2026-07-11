-- Cache vision / Plant.id results per image bytes + crop so repeat uploads get the same diagnosis.

CREATE TABLE IF NOT EXISTS visit_image_diagnosis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  crop_type TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('plant_id', 'vision', 'fusion')),
  provider_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_hash, crop_type)
);

CREATE INDEX IF NOT EXISTS idx_visit_image_diagnosis_cache_lookup
  ON visit_image_diagnosis_cache(content_hash, crop_type);

ALTER TABLE visit_image_diagnosis_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visit_image_diagnosis_cache_service ON visit_image_diagnosis_cache;
CREATE POLICY visit_image_diagnosis_cache_service
  ON visit_image_diagnosis_cache FOR ALL USING (true) WITH CHECK (true);
