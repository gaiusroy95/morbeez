-- visit_ai_questions.updated_at: required by visit AI Q&A sync (syncQuestions)

ALTER TABLE visit_ai_questions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Keep updated_at fresh when agronomists edit questions or answers
CREATE OR REPLACE FUNCTION visit_ai_questions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_visit_ai_questions_updated_at ON visit_ai_questions;
CREATE TRIGGER trg_visit_ai_questions_updated_at
  BEFORE UPDATE ON visit_ai_questions
  FOR EACH ROW
  EXECUTE FUNCTION visit_ai_questions_set_updated_at();
