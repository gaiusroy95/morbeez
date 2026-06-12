-- Language Template Management: grouped definitions + per-language bodies

CREATE TABLE IF NOT EXISTS whatsapp_template_definitions (
  template_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (
    category IN ('general', 'onboarding', 'advisory', 'orders', 'broadcast', 'notification')
  ),
  channel TEXT NOT NULL DEFAULT 'session' CHECK (channel IN ('session', 'meta_template')),
  meta_template_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'in_translation', 'under_review', 'approved', 'archived')
  ),
  variable_schema JSONB NOT NULL DEFAULT '["FarmerName","CropName","Village","DAP","AdvisorName","MobileNumber"]'::jsonb,
  workflow_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  master_language TEXT NOT NULL DEFAULT 'en' CHECK (master_language IN ('en', 'ml', 'ta', 'kn', 'hi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_template_definitions_status
  ON whatsapp_template_definitions(status, category);

-- Backfill definitions from existing language rows
INSERT INTO whatsapp_template_definitions (
  template_key,
  display_name,
  category,
  channel,
  meta_template_name,
  status,
  workflow_json,
  master_language
)
SELECT DISTINCT ON (t.template_key)
  t.template_key,
  INITCAP(REPLACE(t.template_key, '_', ' ')),
  CASE t.template_key
    WHEN 'welcome_farmer' THEN 'onboarding'
    WHEN 'session_follow_up' THEN 'advisory'
    ELSE 'general'
  END,
  t.channel,
  t.meta_template_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM whatsapp_language_templates x
      WHERE x.template_key = t.template_key AND x.status = 'approved'
    ) THEN 'approved'
    ELSE 'draft'
  END,
  jsonb_build_object('created', NOW()),
  'en'
FROM whatsapp_language_templates t
ORDER BY t.template_key, t.updated_at DESC
ON CONFLICT (template_key) DO NOTHING;

-- FK from language rows to definitions (nullable during rollout)
ALTER TABLE whatsapp_language_templates
  DROP CONSTRAINT IF EXISTS whatsapp_language_templates_template_key_fkey;

ALTER TABLE whatsapp_language_templates
  ADD CONSTRAINT whatsapp_language_templates_template_key_fkey
  FOREIGN KEY (template_key) REFERENCES whatsapp_template_definitions(template_key)
  ON DELETE CASCADE;

ALTER TABLE whatsapp_template_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_template_definitions_service ON whatsapp_template_definitions
  FOR ALL USING (true) WITH CHECK (true);
