-- Company profile defaults for invoices, website, and printed materials

CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_name TEXT NOT NULL DEFAULT '',
  address_line TEXT,
  district TEXT,
  state TEXT DEFAULT 'Karnataka',
  country TEXT NOT NULL DEFAULT 'India',
  pincode TEXT,
  cin TEXT,
  gstin TEXT,
  licence_number TEXT,
  customer_care_number TEXT,
  whatsapp_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_settings_all ON company_settings FOR ALL USING (true);

INSERT INTO company_settings (
  id,
  company_name,
  state,
  country
)
VALUES ('default', 'Morbeez Agri Sciences', 'Karnataka', 'India')
ON CONFLICT (id) DO NOTHING;
