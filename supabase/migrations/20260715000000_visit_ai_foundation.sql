-- Visit AI foundation: expanded issue categories, visit_ai_* tables, photo types

-- Expand issue category CHECK constraints (6 → 11 categories)
ALTER TABLE issue_master DROP CONSTRAINT IF EXISTS issue_master_category_check;
ALTER TABLE issue_master ADD CONSTRAINT issue_master_category_check CHECK (
  category IN (
    'disease', 'pest', 'nutrient_deficiency', 'nutrient_toxicity', 'water_stress',
    'environmental_stress', 'soil_problem', 'growth_issue', 'chemical_injury',
    'mechanical_damage', 'weed', 'other'
  )
);

ALTER TABLE visit_issues DROP CONSTRAINT IF EXISTS visit_issues_issue_category_check;
ALTER TABLE visit_issues ADD CONSTRAINT visit_issues_issue_category_check CHECK (
  issue_category IN (
    'disease', 'pest', 'nutrient_deficiency', 'nutrient_toxicity', 'water_stress',
    'environmental_stress', 'soil_problem', 'growth_issue', 'chemical_injury',
    'mechanical_damage', 'weed', 'other'
  )
);

-- Visit-level photos (Photos wizard step)
CREATE TABLE IF NOT EXISTS visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agronomist_visit_sessions(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  photo_type TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_photos_finding
  ON visit_photos (field_finding_id, sort_order)
  WHERE field_finding_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visit_photos_session
  ON visit_photos (session_id, sort_order)
  WHERE session_id IS NOT NULL;

ALTER TABLE visit_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_photos_service ON visit_photos FOR ALL USING (true) WITH CHECK (true);

-- Photo type on issue photos
ALTER TABLE issue_photos
  ADD COLUMN IF NOT EXISTS photo_type TEXT;

-- Visit-scoped AI case model
CREATE TABLE IF NOT EXISTS visit_ai_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE CASCADE,
  visit_issue_id UUID REFERENCES visit_issues(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agronomist_visit_sessions(id) ON DELETE SET NULL,
  ai_advisory_session_id UUID REFERENCES ai_advisory_sessions(id) ON DELETE SET NULL,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES farm_blocks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  issue_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'analyzed', 'qa_complete', 'recommended', 'reviewed', 'submitted')
  ),
  selected_hypothesis_label TEXT,
  final_diagnosis TEXT,
  final_confidence NUMERIC(5, 4),
  confidence_action TEXT CHECK (
    confidence_action IS NULL OR confidence_action IN ('auto_send', 'employee_review', 'escalate')
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_ai_cases_finding ON visit_ai_cases (field_finding_id);
CREATE INDEX IF NOT EXISTS idx_visit_ai_cases_session ON visit_ai_cases (session_id);
CREATE INDEX IF NOT EXISTS idx_visit_ai_cases_issue ON visit_ai_cases (visit_issue_id);

CREATE TABLE IF NOT EXISTS visit_ai_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_ai_case_id UUID NOT NULL REFERENCES visit_ai_cases(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  rationale TEXT,
  selected BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  image_prediction TEXT,
  image_confidence NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_ai_hypotheses_case
  ON visit_ai_hypotheses (visit_ai_case_id, sort_order);

CREATE TABLE IF NOT EXISTS visit_ai_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_ai_case_id UUID NOT NULL REFERENCES visit_ai_cases(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'yes_no_unknown' CHECK (
    answer_type IN ('yes_no_unknown', 'text', 'number')
  ),
  answer TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_visit_ai_questions_case
  ON visit_ai_questions (visit_ai_case_id, sort_order);

CREATE TABLE IF NOT EXISTS visit_ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_ai_case_id UUID NOT NULL REFERENCES visit_ai_cases(id) ON DELETE CASCADE,
  recommendation_record_id UUID REFERENCES recommendation_records(id) ON DELETE SET NULL,
  ai_text TEXT NOT NULL,
  human_text TEXT,
  dosage TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('normal', 'high', 'critical')),
  review_after_days INT,
  review_date TIMESTAMPTZ,
  review_action TEXT CHECK (
    review_action IS NULL OR review_action IN (
      'approve_ai', 'correct_ai', 'partial_match', 'escalate_urgent'
    )
  ),
  modification_reason TEXT,
  agronomist_confidence NUMERIC(5, 4),
  yield_risk TEXT,
  training_event_id UUID REFERENCES ai_training_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_ai_recommendations_case
  ON visit_ai_recommendations (visit_ai_case_id);

ALTER TABLE visit_ai_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_ai_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_ai_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY visit_ai_cases_service ON visit_ai_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY visit_ai_hypotheses_service ON visit_ai_hypotheses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY visit_ai_questions_service ON visit_ai_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY visit_ai_recommendations_service ON visit_ai_recommendations FOR ALL USING (true) WITH CHECK (true);

-- Seed expanded issue master rows
INSERT INTO issue_master (category, issue_name, sort_order) VALUES
  ('nutrient_toxicity', 'Boron toxicity', 10),
  ('nutrient_toxicity', 'Salt injury', 20),
  ('environmental_stress', 'Heat stress', 10),
  ('environmental_stress', 'Cold injury', 20),
  ('environmental_stress', 'Sun scald', 30),
  ('soil_problem', 'Poor drainage', 10),
  ('soil_problem', 'Compaction', 20),
  ('soil_problem', 'Low organic matter', 30),
  ('growth_issue', 'Stunted growth', 10),
  ('growth_issue', 'Poor tillering', 20),
  ('chemical_injury', 'Herbicide drift', 10),
  ('chemical_injury', 'Fertilizer burn', 20),
  ('mechanical_damage', 'Tractor damage', 10),
  ('mechanical_damage', 'Harvest injury', 20)
ON CONFLICT DO NOTHING;
