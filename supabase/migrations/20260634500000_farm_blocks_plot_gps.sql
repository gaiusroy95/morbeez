-- Plot-level GPS on farm_blocks (field visit / telecaller capture).

ALTER TABLE farm_blocks
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_source TEXT CHECK (
    location_source IS NULL OR location_source IN ('field_pwa', 'telecaller', 'whatsapp', 'api')
  );

CREATE INDEX IF NOT EXISTS idx_farm_blocks_has_gps
  ON farm_blocks (farmer_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND archived_at IS NULL;

COMMENT ON COLUMN farm_blocks.latitude IS 'Plot GPS latitude (WGS84); preferred over pincode for weather/AI context';
COMMENT ON COLUMN farm_blocks.longitude IS 'Plot GPS longitude (WGS84)';
