-- Farmer mobile OTP challenges + mobile activity source
CREATE TABLE IF NOT EXISTS farmer_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_otp_phone_created
  ON farmer_otp_challenges (phone, created_at DESC);

ALTER TABLE farmer_otp_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY farmer_otp_challenges_service ON farmer_otp_challenges FOR ALL USING (true) WITH CHECK (true);

-- Allow mobile as cultivation activity source
ALTER TABLE cultivation_activities DROP CONSTRAINT IF EXISTS cultivation_activities_source_check;
ALTER TABLE cultivation_activities
  ADD CONSTRAINT cultivation_activities_source_check
  CHECK (source IN ('whatsapp', 'admin', 'telecaller', 'system', 'mobile'));
