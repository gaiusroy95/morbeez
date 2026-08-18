-- Agronomist work-based remuneration + partner payout batch link.
-- Amounts are snapshotted on the event; never rewrite a paid/included row.

CREATE TABLE IF NOT EXISTS agronomist_earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  agronomist_email TEXT NOT NULL,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'field_visit',
    'km_allowance',
    'recommendation_success',
    'escalation_resolved',
    'retention'
  )),
  source_id TEXT NOT NULL,
  amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  km NUMERIC(10, 2),
  rate_snapshot JSONB NOT NULL DEFAULT '{}',
  period_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'included_in_payroll', 'reversed')),
  payroll_entry_id UUID REFERENCES payroll_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agronomist_earnings_source
  ON agronomist_earnings_ledger (event_type, source_id);

CREATE INDEX IF NOT EXISTS idx_agronomist_earnings_employee_month
  ON agronomist_earnings_ledger (employee_profile_id, period_month, status);

ALTER TABLE agronomist_earnings_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agronomist_earnings_ledger_all ON agronomist_earnings_ledger;
CREATE POLICY agronomist_earnings_ledger_all
  ON agronomist_earnings_ledger FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE partner_earnings_ledger
  ADD COLUMN IF NOT EXISTS payout_batch_id UUID REFERENCES partner_payout_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_earnings_batch
  ON partner_earnings_ledger (payout_batch_id)
  WHERE payout_batch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_payout_batches_month
  ON partner_payout_batches (partner_id, period_month)
  WHERE status IN ('pending', 'approved');

COMMENT ON TABLE agronomist_earnings_ledger IS
  'Work-event agronomist pay. Unique per event+source so visits/recs are never double-paid.';
