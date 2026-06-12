-- Translation dictionary — admin-managed UI/content strings for mobile apps.
-- Approved entries are published as downloadable language packs.

CREATE TABLE IF NOT EXISTS translation_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dict_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ui_labels' CHECK (
    category IN ('ui_labels', 'advisory_text', 'notification_text', 'error_messages', 'content')
  ),
  app_scope TEXT NOT NULL DEFAULT 'all' CHECK (
    app_scope IN ('all', 'farmer', 'agronomist', 'warehouse')
  ),
  value_en TEXT NOT NULL,
  value_hi TEXT,
  value_ml TEXT,
  value_ta TEXT,
  value_kn TEXT,
  translate BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT translation_dictionary_key_scope_unique UNIQUE (dict_key, app_scope)
);

CREATE INDEX IF NOT EXISTS idx_translation_dictionary_lookup
  ON translation_dictionary (app_scope, category, status, dict_key);

CREATE TABLE IF NOT EXISTS i18n_pack_meta (
  locale TEXT NOT NULL CHECK (locale IN ('en', 'hi', 'ml', 'ta', 'kn')),
  app_scope TEXT NOT NULL DEFAULT 'all' CHECK (
    app_scope IN ('all', 'farmer', 'agronomist', 'warehouse')
  ),
  version BIGINT NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (locale, app_scope)
);

-- Seed core UI labels (farmer app). Technical terms: translate = false.
INSERT INTO translation_dictionary (dict_key, category, app_scope, value_en, value_hi, value_ta, value_kn, translate, status)
SELECT * FROM (VALUES
  ('dashboard', 'ui_labels', 'all', 'Dashboard', 'डैशबोर्ड', 'டாஷ்போர்டு', 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', true, 'approved'),
  ('soilReports', 'ui_labels', 'farmer', 'Soil Test', 'मिट्टी परीक्षण', 'மண் பரிசோதனை', 'ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ', true, 'approved'),
  ('recommendations', 'content', 'all', 'Advisory', 'सलाह', 'ஆலோசனை', 'ಸಲಹೆ', true, 'approved'),
  ('reminder', 'notification_text', 'all', 'Reminder', 'रिमाइंडर', 'நினைவூட்டல்', 'ಜ್ಞಾಪನೆ', true, 'approved'),
  ('home', 'ui_labels', 'all', 'Home', 'होम', 'முகப்பு', 'ಮುಖಪುಟ', true, 'approved'),
  ('profile', 'ui_labels', 'all', 'Profile', 'प्रोफ़ाइल', 'சுயவிவரம்', 'ಪ್ರೊಫೈಲ್', true, 'approved'),
  ('orders', 'ui_labels', 'farmer', 'Orders', 'ऑर्डर', 'ஆர்டர்கள்', 'ಆರ್ಡರ್‌ಗಳು', true, 'approved'),
  ('myBlocks', 'ui_labels', 'farmer', 'My blocks', 'मेरे ब्लॉक', 'என் தொகுதிகள்', 'ನನ್ನ ಬ್ಲಾಕ್‌ಗಳು', true, 'approved'),
  ('notifications', 'ui_labels', 'all', 'Notifications', 'सूचनाएं', 'அறிவிப்புகள்', 'ಅಧಿಸೂಚನೆಗಳು', true, 'approved'),
  ('overview', 'ui_labels', 'farmer', 'Overview', 'सारांश', 'சுருக்கம்', 'ಸಾರಾಂಶ', true, 'approved'),
  ('ph', 'content', 'all', 'pH', 'pH', 'pH', 'pH', false, 'approved'),
  ('ec', 'content', 'all', 'EC', 'EC', 'EC', 'EC', false, 'approved'),
  ('spad', 'content', 'all', 'SPAD', 'SPAD', 'SPAD', 'SPAD', false, 'approved'),
  ('npk', 'content', 'all', 'NPK', 'NPK', 'NPK', 'NPK', false, 'approved'),
  ('gps', 'content', 'all', 'GPS', 'GPS', 'GPS', 'GPS', false, 'approved'),
  ('whatsapp', 'ui_labels', 'all', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', false, 'approved'),
  ('roi', 'ui_labels', 'all', 'ROI', 'ROI', 'ROI', 'ROI', false, 'approved')
) AS v(dict_key, category, app_scope, value_en, value_hi, value_ta, value_kn, translate, status)
WHERE NOT EXISTS (SELECT 1 FROM translation_dictionary LIMIT 1);

-- Initial pack versions (unix ms)
INSERT INTO i18n_pack_meta (locale, app_scope, version, published_at)
SELECT locale, app_scope, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, NOW()
FROM (
  VALUES
    ('en', 'all'),
    ('hi', 'all'),
    ('ml', 'all'),
    ('ta', 'all'),
    ('kn', 'all'),
    ('en', 'farmer'),
    ('hi', 'farmer'),
    ('ml', 'farmer'),
    ('ta', 'farmer'),
    ('kn', 'farmer')
) AS t(locale, app_scope)
ON CONFLICT (locale, app_scope) DO NOTHING;

ALTER TABLE translation_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE i18n_pack_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY translation_dictionary_service ON translation_dictionary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY i18n_pack_meta_service ON i18n_pack_meta FOR ALL USING (true) WITH CHECK (true);
