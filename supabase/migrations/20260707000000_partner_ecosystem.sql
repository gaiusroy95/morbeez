-- Morbeez Partner Ecosystem — sales opportunities, commission, events, territory, onboarding

-- ─── Sales opportunities ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  product TEXT NOT NULL,
  expected_quantity TEXT,
  urgency TEXT,
  interest_level TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'hot_lead', 'ready_to_order', 'follow_up_required', 'converted', 'closed')),
  assigned_telecaller_email TEXT,
  converted_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_partner ON sales_opportunities(partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_telecaller ON sales_opportunities(assigned_telecaller_email, status, created_at DESC);

-- ─── Commission master ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('fixed_pct', 'fixed_inr', 'lead_bonus_only', 'none')),
  rate_pct NUMERIC(6, 3),
  fixed_inr NUMERIC(12, 2),
  min_inr NUMERIC(12, 2),
  max_inr NUMERIC(12, 2),
  requires_ownership BOOLEAN NOT NULL DEFAULT true,
  requires_reliability_min NUMERIC(5, 2) NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO commission_master (category_key, label, rule_type, fixed_inr, rate_pct, requires_reliability_min)
VALUES
  ('soil_testing', 'Soil Testing', 'fixed_inr', 300, NULL, 50),
  ('water_testing', 'Water Testing', 'fixed_inr', 200, NULL, 50),
  ('monitoring_package', 'Monitoring Package', 'fixed_pct', NULL, 20, 70),
  ('advisory_package', 'Advisory Package', 'fixed_pct', NULL, 25, 70),
  ('high_margin_specialty', 'High Margin Specialty', 'fixed_pct', NULL, 8, 70),
  ('biologicals', 'Biologicals', 'fixed_pct', NULL, 6, 70),
  ('generic_fertilizers', 'Generic Fertilizers', 'fixed_pct', NULL, 2, 70),
  ('commodity_fertilizers', 'Commodity Fertilizers', 'fixed_pct', NULL, 1, 70),
  ('commercial_order', 'Commercial Orders (>30k)', 'lead_bonus_only', 500, NULL, 85),
  ('dealer_order', 'Dealer Orders', 'none', NULL, NULL, 100),
  ('fpo_order', 'FPO Orders', 'lead_bonus_only', 1000, NULL, 85)
ON CONFLICT (category_key) DO NOTHING;

-- ─── Partner earnings ledger ───────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  order_id UUID,
  sales_opportunity_id UUID REFERENCES sales_opportunities(id) ON DELETE SET NULL,
  category_key TEXT NOT NULL,
  gross_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reliability_hold_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'held', 'approved', 'paid', 'reversed')),
  period_month TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_earnings_partner ON partner_earnings_ledger(partner_id, period_month, status);

CREATE TABLE IF NOT EXISTS partner_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  total_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_by TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Partner events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  name TEXT NOT NULL,
  crop TEXT,
  district TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_events_code ON partner_events(partner_id, event_code);

-- enrollment_event_id FK deferred until events backfilled

-- ─── Territory pincode clusters ────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_territory_pincodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  pincode TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, pincode)
);

CREATE INDEX IF NOT EXISTS idx_partner_territory_pincode ON partner_territory_pincodes(pincode);

-- ─── Onboarding / training ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  content_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO partner_training_modules (module_key, title, sort_order) VALUES
  ('platform', 'Morbeez Platform', 1),
  ('field_findings', 'Field Findings', 2),
  ('soil_testing', 'Soil Testing', 3),
  ('customer_experience', 'Customer Experience', 4),
  ('data_quality', 'Data Quality', 5),
  ('fraud_policy', 'Fraud Policy', 6)
ON CONFLICT (module_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS partner_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES partner_training_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score NUMERIC(5, 2),
  completed_at TIMESTAMPTZ,
  UNIQUE (partner_id, module_id)
);

CREATE TABLE IF NOT EXISTS partner_certification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('online', 'field')),
  score NUMERIC(5, 2),
  passed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  assessed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT NOT NULL DEFAULT 'application'
    CHECK (onboarding_stage IN ('application', 'screening', 'interview', 'training', 'certification', 'trial', 'active'));

ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_role TEXT;

-- RLS service policies
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_earnings_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_territory_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_certification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_opportunities_service ON sales_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY commission_master_service ON commission_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_earnings_ledger_service ON partner_earnings_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_payout_batches_service ON partner_payout_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_events_service ON partner_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_territory_pincodes_service ON partner_territory_pincodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_training_modules_service ON partner_training_modules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_training_progress_service ON partner_training_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_certification_attempts_service ON partner_certification_attempts FOR ALL USING (true) WITH CHECK (true);
