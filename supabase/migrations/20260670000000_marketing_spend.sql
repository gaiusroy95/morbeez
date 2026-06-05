-- Marketing / ad spend tracking for super admin cash flow

CREATE TABLE IF NOT EXISTS marketing_spend_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'general'
    CHECK (channel IN ('meta', 'google', 'whatsapp', 'field', 'general', 'other')),
  amount_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  recorded_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_spend_month_year
  ON marketing_spend_entries(month_year, created_at DESC);

ALTER TABLE marketing_spend_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_spend_entries_all ON marketing_spend_entries FOR ALL USING (true);
