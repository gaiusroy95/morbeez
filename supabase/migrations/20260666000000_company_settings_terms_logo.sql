-- Terms & conditions + quotation/invoice logo on company settings

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
  ADD COLUMN IF NOT EXISTS quotation_logo_url TEXT;
