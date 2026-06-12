-- Terminology Learning: concepts, examples, regional term extensions

CREATE TABLE IF NOT EXISTS agronomy_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general' CHECK (
    category IN (
      'general',
      'disease',
      'pest',
      'nutrient_deficiency',
      'growth_issue',
      'weather_impact'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agronomy_concepts_category ON agronomy_concepts(category);

ALTER TABLE agronomy_terms
  ADD COLUMN IF NOT EXISTS concept_id UUID REFERENCES agronomy_concepts(id) ON DELETE SET NULL;

ALTER TABLE agronomy_terms
  ADD COLUMN IF NOT EXISTS reply_preferred BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE agronomy_terms
  ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0;

ALTER TABLE agronomy_terms
  ADD COLUMN IF NOT EXISTS state TEXT;

CREATE TABLE IF NOT EXISTS terminology_term_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES agronomy_terms(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  farmer_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminology_term_examples_term
  ON terminology_term_examples(term_id, created_at DESC);

-- Backfill concepts from distinct standard_term / meaning
INSERT INTO agronomy_concepts (name, category)
SELECT DISTINCT
  COALESCE(NULLIF(TRIM(standard_term), ''), NULLIF(TRIM(meaning), ''), term) AS name,
  'general'
FROM agronomy_terms
WHERE COALESCE(NULLIF(TRIM(standard_term), ''), NULLIF(TRIM(meaning), '')) IS NOT NULL
ON CONFLICT (name) DO NOTHING;

UPDATE agronomy_terms at
SET concept_id = ac.id
FROM agronomy_concepts ac
WHERE at.concept_id IS NULL
  AND ac.name = COALESCE(NULLIF(TRIM(at.standard_term), ''), NULLIF(TRIM(at.meaning), ''), at.term);

ALTER TABLE agronomy_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminology_term_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY agronomy_concepts_service ON agronomy_concepts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY terminology_term_examples_service ON terminology_term_examples FOR ALL USING (true) WITH CHECK (true);
