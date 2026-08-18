-- Phase D: fraud flags block payout, disputes write adjustment rows,
-- marketing CAC uses eligible delivered sales. Original earnings are never deleted.

CREATE TABLE IF NOT EXISTS earning_fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type TEXT NOT NULL CHECK (party_type IN ('partner', 'employee')),
  party_id UUID NOT NULL,
  earning_source TEXT CHECK (earning_source IN ('partner_ledger', 'agronomist_ledger', 'order', 'introduction')),
  earning_id UUID,
  order_id UUID,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'duplicate_claim',
    'gps_missing',
    'fake_visit',
    'fake_km',
    'introduction_fraud',
    'order_fraud',
    'manual'
  )),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'confirmed', 'cleared')),
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  opened_by TEXT,
  resolved_by TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earning_fraud_party
  ON earning_fraud_flags (party_type, party_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_earning_fraud_open_unique
  ON earning_fraud_flags (
    party_type,
    party_id,
    flag_type,
    COALESCE(earning_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('open', 'confirmed');

ALTER TABLE earning_fraud_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS earning_fraud_flags_all ON earning_fraud_flags;
CREATE POLICY earning_fraud_flags_all
  ON earning_fraud_flags FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS earning_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type TEXT NOT NULL CHECK (party_type IN ('partner', 'employee')),
  party_id UUID NOT NULL,
  earning_source TEXT NOT NULL CHECK (earning_source IN ('partner_ledger', 'agronomist_ledger')),
  earning_id UUID NOT NULL,
  order_id UUID,
  amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'upheld', 'rejected')),
  adjustment_earning_id UUID,
  opened_by TEXT,
  resolved_by TEXT,
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earning_disputes_party
  ON earning_disputes (party_type, party_id, status);

ALTER TABLE earning_disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS earning_disputes_all ON earning_disputes;
CREATE POLICY earning_disputes_all
  ON earning_disputes FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE earning_fraud_flags IS
  'Open or confirmed fraud holds unpaid settlements. Original earning rows are never deleted.';
COMMENT ON TABLE earning_disputes IS
  'Upheld disputes insert an adjustment earning and recover from unpaid 80/20 tranches.';
