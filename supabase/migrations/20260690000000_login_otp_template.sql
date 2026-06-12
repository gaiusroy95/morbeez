-- Login OTP WhatsApp template (Meta authentication / copy_code)

INSERT INTO whatsapp_template_definitions (
  template_key,
  display_name,
  category,
  channel,
  meta_template_name,
  status,
  variable_schema,
  workflow_json,
  master_language
)
VALUES (
  'login_otp',
  'Login OTP',
  'notification',
  'meta_template',
  'morbeez_otp_verification',
  'approved',
  '["OTP"]'::jsonb,
  jsonb_build_object('purpose', 'mobile_app_login'),
  'en'
)
ON CONFLICT (template_key) DO UPDATE SET
  channel = EXCLUDED.channel,
  meta_template_name = COALESCE(whatsapp_template_definitions.meta_template_name, EXCLUDED.meta_template_name),
  category = EXCLUDED.category,
  updated_at = NOW();
