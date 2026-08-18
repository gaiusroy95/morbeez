-- Phase A: eligible net delivered sale, Channel Pool agro/partner split,
-- versioned KPI factor + agronomist slabs, 80/20 settlement, adjustment rows.

-- ─── Channel Pool split (never overwrite history; new version instead) ───
ALTER TABLE product_channel_pool_versions
  ADD COLUMN IF NOT EXISTS agronomist_max_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS partner_max_pct NUMERIC(6, 2);

ALTER TABLE commerce_order_lines
  ADD COLUMN IF NOT EXISTS channel_pool_agronomist_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS channel_pool_partner_pct NUMERIC(6, 2);

ALTER TABLE employee_sales_ledger
  ADD COLUMN IF NOT EXISTS channel_pool_agronomist_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS channel_pool_partner_pct NUMERIC(6, 2);

ALTER TABLE partner_earnings_ledger
  ADD COLUMN IF NOT EXISTS channel_pool_agronomist_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS channel_pool_partner_pct NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS earning_kind TEXT NOT NULL DEFAULT 'sales_incentive',
  ADD COLUMN IF NOT EXISTS parent_earning_id UUID REFERENCES partner_earnings_ledger(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kpi_factor NUMERIC(6, 4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attributed_agronomist_email TEXT;

-- ─── Frozen attribution + eligibility on the order ───
ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS attributed_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributed_agronomist_email TEXT,
  ADD COLUMN IF NOT EXISTS incentive_eligibility TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (incentive_eligibility IN (
      'pending_payment',
      'pending_delivery',
      'pending_return_window',
      'eligible',
      'excluded',
      'adjusted'
    )),
  ADD COLUMN IF NOT EXISTS incentive_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS incentive_excluded_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_incentive_eligibility
  ON commerce_orders (incentive_eligibility, incentive_eligible_at)
  WHERE incentive_eligibility IN ('pending_delivery', 'pending_return_window');

-- ─── Agronomist sales incentive event types ───
ALTER TABLE agronomist_earnings_ledger
  DROP CONSTRAINT IF EXISTS agronomist_earnings_ledger_event_type_check;

ALTER TABLE agronomist_earnings_ledger
  ADD CONSTRAINT agronomist_earnings_ledger_event_type_check
  CHECK (event_type IN (
    'field_visit',
    'km_allowance',
    'recommendation_success',
    'escalation_resolved',
    'retention',
    'sales_incentive',
    'sales_adjustment'
  ));

ALTER TABLE agronomist_earnings_ledger
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS parent_earning_id UUID REFERENCES agronomist_earnings_ledger(id) ON DELETE SET NULL;

-- ─── Versioned earning rules ───
CREATE TABLE IF NOT EXISTS earning_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'partner_kpi_factor',
    'agronomist_sales_slab',
    'settlement_80_20',
    'eligible_sale'
  )),
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'submitted', 'approved', 'scheduled', 'active', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}',
  change_reason TEXT NOT NULL DEFAULT 'initial',
  created_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rule_type, version_number),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_earning_rule_lookup
  ON earning_rule_versions (rule_type, effective_from, effective_to);

ALTER TABLE earning_rule_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS earning_rule_versions_all ON earning_rule_versions;
CREATE POLICY earning_rule_versions_all
  ON earning_rule_versions FOR ALL USING (true) WITH CHECK (true);

INSERT INTO earning_rule_versions (rule_type, version_number, effective_from, status, payload, change_reason)
SELECT * FROM (VALUES
  (
    'partner_kpi_factor',
    1,
    DATE '2026-08-01',
    'active',
    '{"bands":[{"maxExclusive":60,"factor":0.70},{"maxExclusive":70,"factor":0.80},{"maxExclusive":80,"factor":0.90},{"maxExclusive":90,"factor":0.95},{"maxExclusive":101,"factor":1.00}]}'::jsonb,
    'Phase A default KPI factor'
  ),
  (
    'agronomist_sales_slab',
    1,
    DATE '2026-08-01',
    'active',
    '{"slabs":[{"maxExclusive":300000,"unlockPct":0},{"maxExclusive":500000,"unlockPct":50},{"maxExclusive":800000,"unlockPct":75},{"maxExclusive":null,"unlockPct":100}]}'::jsonb,
    'Phase A default agronomist sales slabs'
  ),
  (
    'settlement_80_20',
    1,
    DATE '2026-08-01',
    'active',
    '{"firstPct":80,"holdPct":20,"firstDelayMonths":2,"holdDelayMonths":3}'::jsonb,
    'Phase A default 80/20 settlement'
  ),
  (
    'eligible_sale',
    1,
    DATE '2026-08-01',
    'active',
    '{"returnWindowDays":7}'::jsonb,
    'Phase A default return window'
  )
) AS v(rule_type, version_number, effective_from, status, payload, change_reason)
WHERE NOT EXISTS (
  SELECT 1 FROM earning_rule_versions e
  WHERE e.rule_type = v.rule_type AND e.version_number = v.version_number
);

-- ─── 80/20 settlements ───
CREATE TABLE IF NOT EXISTS earning_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type TEXT NOT NULL CHECK (party_type IN ('partner', 'employee')),
  party_id UUID NOT NULL,
  earning_source TEXT NOT NULL CHECK (earning_source IN ('partner_ledger', 'agronomist_ledger')),
  earning_id UUID NOT NULL,
  earning_month TEXT NOT NULL,
  earning_type TEXT NOT NULL,
  gross_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tranche TEXT NOT NULL CHECK (tranche IN ('eighty', 'twenty')),
  amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payable_on DATE NOT NULL,
  return_adjustment_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fraud_hold BOOLEAN NOT NULL DEFAULT false,
  recovery_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_payable_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'held', 'cancelled')),
  payout_batch_id UUID,
  payroll_entry_id UUID,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (earning_source, earning_id, tranche)
);

CREATE INDEX IF NOT EXISTS idx_earning_settlements_due
  ON earning_settlements (party_type, party_id, payable_on, status);

ALTER TABLE earning_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS earning_settlements_all ON earning_settlements;
CREATE POLICY earning_settlements_all
  ON earning_settlements FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE earning_settlements IS
  '80/20 settlement of approved incentives. Original earning rows are never deleted; returns add adjustment earnings.';
COMMENT ON TABLE earning_rule_versions IS
  'Versioned KPI factor, agronomist slabs, settlement lag, and eligible-sale window. Never overwrite an active row.';
