-- Bulk margin owner review + payroll ledger linkage

CREATE TABLE IF NOT EXISTS bulk_margin_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_quote_id UUID NOT NULL REFERENCES commerce_quotes(id) ON DELETE CASCADE,
  lead_id UUID,
  employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  order_value_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gross_profit_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gross_margin_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  min_required_pct NUMERIC(8, 4) NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by_name TEXT,
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commerce_quote_id)
);

CREATE INDEX IF NOT EXISTS idx_bulk_margin_reviews_status
  ON bulk_margin_review_requests(status, created_at DESC);

ALTER TABLE employee_sales_ledger
  ADD COLUMN IF NOT EXISTS farmer_id UUID;

ALTER TABLE commerce_quotes
  ADD COLUMN IF NOT EXISTS bulk_margin_review_status TEXT
    CHECK (bulk_margin_review_status IS NULL OR bulk_margin_review_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE bulk_margin_review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY bulk_margin_review_requests_all ON bulk_margin_review_requests FOR ALL USING (true);

-- Default ₹30k salary / ₹6L target for telecallers missing compensation
INSERT INTO employee_compensation (
  employee_profile_id,
  fixed_salary,
  monthly_sales_target,
  km_allowance_enabled,
  created_at,
  updated_at
)
SELECT
  ep.id,
  30000,
  600000,
  false,
  NOW(),
  NOW()
FROM employee_profiles ep
LEFT JOIN employee_compensation ec ON ec.employee_profile_id = ep.id
WHERE ec.id IS NULL
  AND ep.status = 'active';
