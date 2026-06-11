-- Staff mobile OTP (warehouse / field apps)
CREATE TABLE IF NOT EXISTS staff_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_otp_phone_created
  ON staff_otp_challenges (phone, created_at DESC);

ALTER TABLE staff_otp_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_otp_challenges_service ON staff_otp_challenges FOR ALL USING (true) WITH CHECK (true);
