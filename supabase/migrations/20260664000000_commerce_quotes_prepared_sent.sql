-- Quote prepared-by and send tracking (WhatsApp / email)

ALTER TABLE commerce_quotes
  ADD COLUMN IF NOT EXISTS prepared_by_name TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
