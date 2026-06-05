-- SEO Control Panel: content pages, FAQs, keywords, health, GSC, sitemaps, regional intelligence

-- ─── Dynamic SEO content pages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL CHECK (page_type IN (
    'crop_problem', 'advisory', 'comparison', 'crop_stage', 'article', 'disease'
  )),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  focus_keywords TEXT[] DEFAULT '{}',
  crop TEXT,
  problem TEXT,
  stage TEXT,
  region TEXT,
  body_html TEXT,
  faq_json JSONB NOT NULL DEFAULT '[]',
  schema_json JSONB NOT NULL DEFAULT '{}',
  related_product_ids TEXT[] DEFAULT '{}',
  internal_links JSONB NOT NULL DEFAULT '[]',
  ai_visibility_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  canonical_url TEXT,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_content_pages_type ON seo_content_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_seo_content_pages_crop ON seo_content_pages(crop);
CREATE INDEX IF NOT EXISTS idx_seo_content_pages_status ON seo_content_pages(status);
CREATE INDEX IF NOT EXISTS idx_seo_content_pages_region ON seo_content_pages(region);

-- ─── Standalone FAQs (product or page scoped) ────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES seo_content_pages(id) ON DELETE CASCADE,
  shopify_product_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  schema_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_faqs_page ON seo_faqs(page_id);
CREATE INDEX IF NOT EXISTS idx_seo_faqs_product ON seo_faqs(shopify_product_id);

-- ─── Internal linking graph ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_internal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('page', 'product', 'collection', 'article')),
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('page', 'product', 'collection', 'article')),
  target_id TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  context TEXT,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id, anchor_text)
);

CREATE INDEX IF NOT EXISTS idx_seo_internal_links_source ON seo_internal_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_seo_internal_links_target ON seo_internal_links(target_type, target_id);

-- ─── Keyword tracking ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  target_type TEXT CHECK (target_type IN ('page', 'product', 'collection')),
  target_id TEXT,
  region TEXT,
  position NUMERIC(6,2),
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  ctr NUMERIC(7,4),
  organic_traffic INT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_keywords_unique_target
  ON seo_keywords (keyword, COALESCE(target_type, ''), COALESCE(target_id, ''), COALESCE(region, ''));

CREATE INDEX IF NOT EXISTS idx_seo_keywords_keyword ON seo_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_region ON seo_keywords(region);

-- ─── SEO health issues ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_health_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'missing_meta', 'duplicate_content', 'broken_link', 'slow_page',
    'thin_content', 'schema_error', 'missing_alt', 'missing_canonical'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  url TEXT,
  entity_type TEXT,
  entity_id TEXT,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seo_health_open ON seo_health_issues(resolved) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_seo_health_type ON seo_health_issues(issue_type);

-- ─── Google Search Console config & snapshots ─────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_gsc_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url TEXT NOT NULL UNIQUE,
  refresh_token TEXT,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_gsc_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  indexed_pages INT NOT NULL DEFAULT 0,
  total_clicks INT NOT NULL DEFAULT 0,
  total_impressions INT NOT NULL DEFAULT 0,
  avg_ctr NUMERIC(7,4),
  avg_position NUMERIC(6,2),
  top_pages JSONB NOT NULL DEFAULT '[]',
  top_queries JSONB NOT NULL DEFAULT '[]',
  errors JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Sitemap registry ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_sitemaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitemap_type TEXT NOT NULL CHECK (sitemap_type IN (
    'product', 'blog', 'category', 'image', 'custom', 'content'
  )),
  url TEXT NOT NULL,
  url_count INT NOT NULL DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'submitted', 'error')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sitemap_type)
);

-- ─── Image SEO metadata ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_image_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id TEXT,
  shopify_image_id TEXT NOT NULL UNIQUE,
  original_url TEXT,
  alt_text TEXT,
  webp_url TEXT,
  compressed BOOLEAN NOT NULL DEFAULT false,
  lazy_load BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_image_meta_product ON seo_image_meta(shopify_product_id);

-- ─── Regional SEO intelligence ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_regional_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  keyword TEXT NOT NULL,
  trend_score INT NOT NULL DEFAULT 0,
  search_volume_estimate INT,
  notes TEXT,
  suggested_page_slug TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region, keyword)
);

CREATE INDEX IF NOT EXISTS idx_seo_regional_region ON seo_regional_trends(region);

-- ─── AI generation job log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input_json JSONB NOT NULL DEFAULT '{}',
  output_json JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── RLS (service role pattern) ───────────────────────────────────────────────
ALTER TABLE seo_content_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_internal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_health_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_gsc_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_gsc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_sitemaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_image_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_regional_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY seo_content_pages_all ON seo_content_pages FOR ALL USING (true);
CREATE POLICY seo_faqs_all ON seo_faqs FOR ALL USING (true);
CREATE POLICY seo_internal_links_all ON seo_internal_links FOR ALL USING (true);
CREATE POLICY seo_keywords_all ON seo_keywords FOR ALL USING (true);
CREATE POLICY seo_health_issues_all ON seo_health_issues FOR ALL USING (true);
CREATE POLICY seo_gsc_config_all ON seo_gsc_config FOR ALL USING (true);
CREATE POLICY seo_gsc_snapshots_all ON seo_gsc_snapshots FOR ALL USING (true);
CREATE POLICY seo_sitemaps_all ON seo_sitemaps FOR ALL USING (true);
CREATE POLICY seo_image_meta_all ON seo_image_meta FOR ALL USING (true);
CREATE POLICY seo_regional_trends_all ON seo_regional_trends FOR ALL USING (true);
CREATE POLICY seo_ai_jobs_all ON seo_ai_jobs FOR ALL USING (true);

-- ─── RBAC: seo module ─────────────────────────────────────────────────────────
INSERT INTO role_module_permissions (role, module_key, can_read, can_write)
VALUES
  ('super_admin', 'seo', true, true),
  ('admin', 'seo', true, true),
  ('manager', 'seo', true, true),
  ('operations', 'seo', true, false),
  ('viewer', 'seo', true, false)
ON CONFLICT (role, module_key) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write;

-- ─── Seed example crop-problem pages (draft) ──────────────────────────────────
INSERT INTO seo_content_pages (
  page_type, slug, title, meta_title, meta_description, crop, problem, focus_keywords, status
)
SELECT * FROM (VALUES
  (
    'crop_problem',
    'ginger-leaf-yellowing',
    'Ginger Leaf Yellowing — Causes & Treatment',
    'Ginger Leaf Yellowing: Causes, Symptoms & Organic Fix | Morbeez',
    'Why are ginger leaves turning yellow? Learn nutrient deficiency, water stress, and disease causes with Morbeez agronomy recommendations.',
    'Ginger',
    'Yellowing',
    ARRAY['ginger leaf yellowing', 'ginger yellow leaves', 'ginger nutrient deficiency'],
    'draft'
  ),
  (
    'crop_problem',
    'pyricularia-treatment-ginger',
    'Pyricularia Leaf Spot in Ginger — Treatment Guide',
    'Pyricularia Treatment in Ginger | Morbeez Agri Sciences',
    'Identify Pyricularia leaf spot symptoms in ginger and follow integrated fungicide + nutrition treatment steps for Indian farms.',
    'Ginger',
    'Pyricularia',
    ARRAY['pyricularia treatment', 'ginger leaf spot', 'ginger fungal disease'],
    'draft'
  ),
  (
    'advisory',
    'high-soil-ph-correction',
    'High Soil pH Correction for Horticulture Crops',
    'High Soil pH Correction — Micronutrient Availability | Morbeez',
    'Step-by-step guide to correct high soil pH, unlock zinc and iron uptake, and improve crop vigour in alkaline soils.',
    NULL,
    'High pH',
    ARRAY['high soil ph correction', 'alkaline soil treatment', 'soil ph ginger'],
    'draft'
  )
) AS v(page_type, slug, title, meta_title, meta_description, crop, problem, focus_keywords, status)
WHERE NOT EXISTS (SELECT 1 FROM seo_content_pages LIMIT 1);

-- ─── Seed regional trends ─────────────────────────────────────────────────────
INSERT INTO seo_regional_trends (region, keyword, trend_score, search_volume_estimate, notes)
VALUES
  ('Karnataka', 'ginger leaf spot', 85, 1200, 'Peak before monsoon — create Kannada variant'),
  ('Kerala', 'ginger yellowing', 72, 890, 'High humidity related queries'),
  ('Tamil Nadu', 'zinc deficiency ginger', 68, 650, 'Link to EDTA Zn product page')
ON CONFLICT (region, keyword) DO NOTHING;
