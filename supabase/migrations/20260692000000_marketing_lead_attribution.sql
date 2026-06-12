-- Marketing lead attribution, spend ROI columns, incentive rules

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_channel TEXT
    CHECK (lead_channel IS NULL OR lead_channel IN (
      'meta', 'instagram', 'google', 'referral', 'organic', 'whatsapp', 'field', 'other'
    )),
  ADD COLUMN IF NOT EXISTS marketing_owner_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketing_owner_name TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_marketing_channel
  ON leads(lead_channel, campaign_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_marketing_owner
  ON leads(marketing_owner_id, created_at DESC);

UPDATE leads
SET lead_channel = 'whatsapp'
WHERE source = 'whatsapp' AND lead_channel IS NULL;

ALTER TABLE marketing_spend_entries
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS marketing_owner_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spend_date DATE;

CREATE INDEX IF NOT EXISTS idx_marketing_spend_campaign
  ON marketing_spend_entries(channel, campaign_name, spend_date DESC);

CREATE TABLE IF NOT EXISTS marketing_incentive_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL DEFAULT 'Default',
  flat_connected_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  flat_booked_inr NUMERIC(12, 2) NOT NULL DEFAULT 100,
  flat_paid_inr NUMERIC(12, 2) NOT NULL DEFAULT 300,
  monthly_cap_inr NUMERIC(14, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO marketing_incentive_rules (rule_name, flat_connected_inr, flat_booked_inr, flat_paid_inr, is_active)
SELECT 'Default', 0, 100, 300, true
WHERE NOT EXISTS (SELECT 1 FROM marketing_incentive_rules WHERE is_active = true);

ALTER TABLE marketing_incentive_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_incentive_rules_all ON marketing_incentive_rules FOR ALL USING (true);

COMMENT ON COLUMN leads.lead_channel IS 'Marketing intake channel (meta, whatsapp, field, etc.)';
COMMENT ON COLUMN leads.campaign_source IS 'Campaign name — reused as campaign_name in marketing dashboards';
