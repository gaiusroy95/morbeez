-- Terminology Learning & Localization Module (final spec)

-- ─── Concept codes (DIS001, NUT001, …) ───────────────────────────
ALTER TABLE agronomy_concepts
  ADD COLUMN IF NOT EXISTS concept_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agronomy_concepts_code
  ON agronomy_concepts(concept_code)
  WHERE concept_code IS NOT NULL;

-- Backfill codes from category prefix + row number
WITH numbered AS (
  SELECT
    id,
    category,
    ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at, name) AS rn
  FROM agronomy_concepts
  WHERE concept_code IS NULL
)
UPDATE agronomy_concepts ac
SET concept_code = CASE n.category
  WHEN 'disease' THEN 'DIS' || LPAD(n.rn::text, 3, '0')
  WHEN 'pest' THEN 'PST' || LPAD(n.rn::text, 3, '0')
  WHEN 'nutrient_deficiency' THEN 'NUT' || LPAD(n.rn::text, 3, '0')
  WHEN 'growth_issue' THEN 'GRW' || LPAD(n.rn::text, 3, '0')
  WHEN 'weather_impact' THEN 'WTH' || LPAD(n.rn::text, 3, '0')
  ELSE 'GEN' || LPAD(n.rn::text, 3, '0')
END
FROM numbered n
WHERE ac.id = n.id;

-- ─── Regional term status ──────────────────────────────────────────
ALTER TABLE agronomy_terms
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agronomy_terms_status_check'
  ) THEN
    ALTER TABLE agronomy_terms
      ADD CONSTRAINT agronomy_terms_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agronomy_terms_status
  ON agronomy_terms(status, language, district);

-- ─── AI learning queue fields ──────────────────────────────────────
ALTER TABLE terminology_review_tasks
  ADD COLUMN IF NOT EXISTS ai_suggested_concept_id UUID REFERENCES agronomy_concepts(id) ON DELETE SET NULL;

ALTER TABLE terminology_review_tasks
  ADD COLUMN IF NOT EXISTS ai_suggested_concept_name TEXT;

ALTER TABLE terminology_review_tasks
  ADD COLUMN IF NOT EXISTS confidence_score REAL;

ALTER TABLE terminology_review_tasks
  DROP CONSTRAINT IF EXISTS terminology_review_tasks_status_check;

ALTER TABLE terminology_review_tasks
  ADD CONSTRAINT terminology_review_tasks_status_check
  CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed', 'rejected'));

-- ─── Term aliases / synonyms ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminology_term_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES agronomy_terms(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (term_id, alias, language)
);

CREATE INDEX IF NOT EXISTS idx_terminology_term_aliases_lookup
  ON terminology_term_aliases(language, alias);

-- ─── Localization profiles by region ───────────────────────────────
CREATE TABLE IF NOT EXISTS terminology_localization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  district TEXT,
  state TEXT,
  preferred_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_style TEXT NOT NULL DEFAULT 'simple_farmer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_terminology_localization_profiles_lang_district
  ON terminology_localization_profiles(language, COALESCE(district, ''));

-- Upsert-friendly unique constraint (district null → empty string)
ALTER TABLE terminology_localization_profiles
  ADD COLUMN IF NOT EXISTS district_key TEXT GENERATED ALWAYS AS (COALESCE(district, '')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_terminology_localization_profiles_lang_district_key
  ON terminology_localization_profiles(language, district_key);

ALTER TABLE terminology_term_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminology_localization_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY terminology_term_aliases_service ON terminology_term_aliases
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY terminology_localization_profiles_service ON terminology_localization_profiles
  FOR ALL USING (true) WITH CHECK (true);
