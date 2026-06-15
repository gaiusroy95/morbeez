-- Visit AI perfection: question library linkage, case metadata

ALTER TABLE visit_ai_questions
  ADD COLUMN IF NOT EXISTS source_library_id UUID REFERENCES learned_follow_up_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_visit_ai_questions_library
  ON visit_ai_questions (source_library_id)
  WHERE source_library_id IS NOT NULL;
