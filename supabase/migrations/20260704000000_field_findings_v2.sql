-- Field Findings v2: structured multi-issue visits, issue master, measurement templates

-- Extend visit root
ALTER TABLE crm_field_findings
  ADD COLUMN IF NOT EXISTS block_health TEXT CHECK (
    block_health IS NULL OR block_health IN ('good', 'average', 'need_assistance')
  ),
  ADD COLUMN IF NOT EXISTS crop_performance TEXT CHECK (
    crop_performance IS NULL OR crop_performance IN (
      'above_expectation', 'as_expected', 'below_expectation'
    )
  ),
  ADD COLUMN IF NOT EXISTS soil_moisture TEXT CHECK (
    soil_moisture IS NULL OR soil_moisture IN ('dry', 'optimal', 'wet', 'waterlogged')
  ),
  ADD COLUMN IF NOT EXISTS visit_session_id UUID REFERENCES agronomist_visit_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dap_at_visit INT,
  ADD COLUMN IF NOT EXISTS stage_at_visit TEXT;

CREATE INDEX IF NOT EXISTS idx_field_findings_visit_session
  ON crm_field_findings (visit_session_id)
  WHERE visit_session_id IS NOT NULL;

-- Issue master (admin-configurable)
CREATE TABLE IF NOT EXISTS issue_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (
    category IN ('disease', 'pest', 'nutrient_deficiency', 'water_stress', 'weed', 'other')
  ),
  issue_name TEXT NOT NULL,
  concept_code TEXT,
  crop_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_master_unique_name
  ON issue_master (category, issue_name, COALESCE(crop_type, '_all'));

CREATE INDEX IF NOT EXISTS idx_issue_master_category
  ON issue_master (category, active, sort_order);

-- Crop measurement templates (admin-configurable)
CREATE TABLE IF NOT EXISTS crop_measurement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type TEXT NOT NULL,
  measurement_key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ml TEXT,
  unit TEXT,
  input_type TEXT NOT NULL DEFAULT 'number' CHECK (
    input_type IN ('text', 'number', 'select', 'boolean')
  ),
  options JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_type, measurement_key)
);

CREATE INDEX IF NOT EXISTS idx_crop_measurement_templates_crop
  ON crop_measurement_templates (crop_type, sort_order)
  WHERE active = true;

-- Visit issues (1:N per field finding)
CREATE TABLE IF NOT EXISTS visit_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID NOT NULL REFERENCES crm_field_findings(id) ON DELETE CASCADE,
  issue_category TEXT NOT NULL CHECK (
    issue_category IN ('disease', 'pest', 'nutrient_deficiency', 'water_stress', 'weed', 'other')
  ),
  issue_master_id UUID REFERENCES issue_master(id) ON DELETE SET NULL,
  issue_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  observation TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'resolved')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_issues_finding
  ON visit_issues (field_finding_id, sort_order);

-- Issue photos
CREATE TABLE IF NOT EXISTS issue_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_issue_id UUID NOT NULL REFERENCES visit_issues(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_photos_visit_issue
  ON issue_photos (visit_issue_id, sort_order);

-- Visit measurements
CREATE TABLE IF NOT EXISTS visit_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID NOT NULL REFERENCES crm_field_findings(id) ON DELETE CASCADE,
  measurement_key TEXT NOT NULL,
  label_en TEXT,
  value TEXT NOT NULL,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_measurements_finding
  ON visit_measurements (field_finding_id);

-- Link recommendations to visit issues
ALTER TABLE recommendation_records
  ADD COLUMN IF NOT EXISTS visit_issue_id UUID REFERENCES visit_issues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recommendation_records_visit_issue
  ON recommendation_records (visit_issue_id)
  WHERE visit_issue_id IS NOT NULL;

-- Extend ai_learning_samples for issue-level training
ALTER TABLE ai_learning_samples
  ADD COLUMN IF NOT EXISTS visit_issue_id UUID REFERENCES visit_issues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL;

-- Farmer notes (general, not issue-linked)
CREATE TABLE IF NOT EXISTS farmer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  author_email TEXT,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_notes_farmer
  ON farmer_notes (farmer_id, created_at DESC);

ALTER TABLE issue_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_measurement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY issue_master_service ON issue_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY crop_measurement_templates_service ON crop_measurement_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY visit_issues_service ON visit_issues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY issue_photos_service ON issue_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY visit_measurements_service ON visit_measurements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_notes_service ON farmer_notes FOR ALL USING (true) WITH CHECK (true);

-- Seed issue master
INSERT INTO issue_master (category, issue_name, sort_order) VALUES
  ('disease', 'Leaf Spot', 10),
  ('disease', 'Rhizome Rot', 20),
  ('disease', 'Soft Rot', 30),
  ('pest', 'Thrips', 10),
  ('pest', 'Shoot Borer', 20),
  ('pest', 'Rhizome Scale', 30),
  ('nutrient_deficiency', 'Magnesium', 10),
  ('nutrient_deficiency', 'Zinc', 20),
  ('nutrient_deficiency', 'Nitrogen', 30),
  ('water_stress', 'Drought stress', 10),
  ('water_stress', 'Waterlogging', 20),
  ('weed', 'Broadleaf weeds', 10),
  ('other', 'General observation', 99)
ON CONFLICT DO NOTHING;

-- Seed measurement templates
INSERT INTO crop_measurement_templates (crop_type, measurement_key, label_en, unit, input_type, sort_order) VALUES
  ('ginger', 'shoot_count', 'Shoot Count', 'No', 'number', 10),
  ('ginger', 'shoot_diameter', 'Shoot Diameter', 'mm', 'number', 20),
  ('ginger', 'spad', 'SPAD', 'SPAD', 'number', 30),
  ('banana', 'plant_height', 'Plant Height', 'cm', 'number', 10),
  ('banana', 'pseudostem_girth', 'Pseudostem Girth', 'cm', 'number', 20),
  ('banana', 'leaf_count', 'Leaf Count', 'No', 'number', 30),
  ('coffee', 'berry_load', 'Berry Load', '%', 'number', 10),
  ('coffee', 'flowering_pct', 'Flowering %', '%', 'number', 20),
  ('coffee', 'branch_count', 'Branch Count', 'No', 'number', 30),
  ('_default', 'spad', 'SPAD reading', 'SPAD', 'number', 10),
  ('_default', 'canopy_cover', 'Canopy cover', '%', 'number', 20)
ON CONFLICT (crop_type, measurement_key) DO NOTHING;
