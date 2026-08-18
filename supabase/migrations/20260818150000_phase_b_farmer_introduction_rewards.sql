-- Phase B: farmer introduction rewards — ₹100 cash + ₹400 product wallet.
-- Separate from partner sales incentive. Never convert leftover product value to cash.

ALTER TABLE earning_rule_versions
  DROP CONSTRAINT IF EXISTS earning_rule_versions_rule_type_check;

ALTER TABLE earning_rule_versions
  ADD CONSTRAINT earning_rule_versions_rule_type_check
  CHECK (rule_type IN (
    'partner_kpi_factor',
    'agronomist_sales_slab',
    'settlement_80_20',
    'eligible_sale',
    'farmer_introduction'
  ));

INSERT INTO earning_rule_versions (rule_type, version_number, effective_from, status, payload, change_reason)
SELECT
  'farmer_introduction',
  1,
  DATE '2026-08-01',
  'active',
  '{"minAcreage":2,"cashRewardInr":100,"productRewardInr":400,"requireNewFarmer":true,"requireFarmerVerified":true,"requireFieldVerified":true,"requireEvidence":true,"requireAgronomistEngagement":true,"existingFarmerHours":24}'::jsonb,
  'Phase B default farmer introduction rewards'
WHERE NOT EXISTS (
  SELECT 1 FROM earning_rule_versions e
  WHERE e.rule_type = 'farmer_introduction' AND e.version_number = 1
);

CREATE TABLE IF NOT EXISTS farmer_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  introduction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  registration_date DATE,
  farmer_mobile TEXT,
  location TEXT,
  crop TEXT,
  acreage NUMERIC(10, 2) NOT NULL DEFAULT 0,
  existing_farmer BOOLEAN NOT NULL DEFAULT false,
  duplicate_mobile BOOLEAN NOT NULL DEFAULT false,
  duplicate_claim BOOLEAN NOT NULL DEFAULT false,
  farmer_verified BOOLEAN NOT NULL DEFAULT false,
  field_verified BOOLEAN NOT NULL DEFAULT false,
  evidence_verified BOOLEAN NOT NULL DEFAULT false,
  agronomist_email TEXT,
  agronomist_engagement_status TEXT NOT NULL DEFAULT 'none'
    CHECK (agronomist_engagement_status IN ('none', 'assigned', 'engaged')),
  trust_score NUMERIC(6, 2),
  qualification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (qualification_status IN ('pending', 'review', 'eligible', 'rejected', 'fraud_hold')),
  pending_reasons JSONB NOT NULL DEFAULT '[]',
  cash_reward_eligible BOOLEAN NOT NULL DEFAULT false,
  cash_reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_rewarded_at TIMESTAMPTZ,
  product_reward_eligible BOOLEAN NOT NULL DEFAULT false,
  product_reward_max NUMERIC(12, 2) NOT NULL DEFAULT 0,
  product_reward_used NUMERIC(12, 2) NOT NULL DEFAULT 0,
  product_reward_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fraud_status TEXT NOT NULL DEFAULT 'clean'
    CHECK (fraud_status IN ('clean', 'review', 'hold', 'rejected', 'confirmed_fraud')),
  reward_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (reward_status IN ('pending', 'eligible', 'partial', 'settled', 'blocked')),
  settlement_status TEXT NOT NULL DEFAULT 'none'
    CHECK (settlement_status IN ('none', 'pending', 'partial', 'paid')),
  rule_version_id UUID REFERENCES earning_rule_versions(id) ON DELETE SET NULL,
  partner_earning_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, farmer_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_introductions_status
  ON farmer_introductions (qualification_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmer_introductions_partner
  ON farmer_introductions (partner_id, qualification_status);
CREATE INDEX IF NOT EXISTS idx_farmer_introductions_farmer
  ON farmer_introductions (farmer_id);

ALTER TABLE farmer_introductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farmer_introductions_all ON farmer_introductions;
CREATE POLICY farmer_introductions_all
  ON farmer_introductions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS farmer_product_reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  introduction_id UUID NOT NULL REFERENCES farmer_introductions(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  commerce_order_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('use', 'restore')),
  amount_inr NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (introduction_id, commerce_order_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_product_reward_order
  ON farmer_product_reward_ledger (commerce_order_id)
  WHERE commerce_order_id IS NOT NULL;

ALTER TABLE farmer_product_reward_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farmer_product_reward_ledger_all ON farmer_product_reward_ledger;
CREATE POLICY farmer_product_reward_ledger_all
  ON farmer_product_reward_ledger FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE partner_earnings_ledger
  ADD COLUMN IF NOT EXISTS introduction_id UUID REFERENCES farmer_introductions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_intro_cash
  ON partner_earnings_ledger (partner_id, introduction_id)
  WHERE earning_kind = 'intro_cash' AND introduction_id IS NOT NULL;

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS product_reward_applied_inr NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON TABLE farmer_introductions IS
  'One introduction per partner+farmer. ₹100 cash and ₹400 product wallet are separate from sales incentive.';
COMMENT ON TABLE farmer_product_reward_ledger IS
  'Product-wallet usage and return restores. Leftover product value is never paid as cash.';
