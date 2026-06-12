-- WhatsApp Broadcast Management Module: campaigns, templates, delivery tracking

CREATE TABLE IF NOT EXISTS whatsapp_broadcast_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom_message',
  crop_type TEXT,
  target_dap INT,
  title TEXT,
  body TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  variables_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
  version INT NOT NULL DEFAULT 1,
  created_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_templates_status ON whatsapp_broadcast_templates(status, category);

CREATE TABLE IF NOT EXISTS whatsapp_broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom_message',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_approval', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')
  ),
  audience_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_title TEXT,
  message_body TEXT NOT NULL DEFAULT '',
  language_mode TEXT NOT NULL DEFAULT 'auto',
  media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_id UUID REFERENCES whatsapp_broadcast_templates(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by TEXT,
  approved_by TEXT,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON whatsapp_broadcast_campaigns(status, scheduled_at);

ALTER TABLE whatsapp_broadcast_deliveries
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES whatsapp_broadcast_campaigns(id) ON DELETE SET NULL;

ALTER TABLE whatsapp_broadcast_deliveries
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

ALTER TABLE whatsapp_broadcast_deliveries
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE whatsapp_broadcast_deliveries
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE whatsapp_broadcast_deliveries
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign
  ON whatsapp_broadcast_deliveries(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_broadcast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES whatsapp_broadcast_deliveries(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES whatsapp_broadcast_campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_events_delivery ON whatsapp_broadcast_events(delivery_id, created_at DESC);

CREATE TABLE IF NOT EXISTS farmer_broadcast_preferences (
  farmer_id UUID PRIMARY KEY REFERENCES farmers(id) ON DELETE CASCADE,
  opted_out_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  opted_out_all BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow custom campaign kind in delivery log
ALTER TABLE whatsapp_broadcast_deliveries DROP CONSTRAINT IF EXISTS whatsapp_broadcast_deliveries_broadcast_kind_check;
