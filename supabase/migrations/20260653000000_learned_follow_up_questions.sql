-- Expert-verified follow-up questions — saved on case review, reused as-is for similar farmer complaints.
-- Structured only: yes_no (2-choice), multiple_choice (2–10 options), photo request.

CREATE TABLE IF NOT EXISTS learned_follow_up_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  symptom_key TEXT NOT NULL,
  issue_label TEXT NOT NULL DEFAULT '',
  question_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('yes_no', 'multiple_choice', 'photo')),
  text_en TEXT NOT NULL,
  text_ml TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]',
  purpose TEXT,
  sequence_order INT NOT NULL DEFAULT 0,
  source_session_id UUID REFERENCES ai_advisory_sessions(id) ON DELETE SET NULL,
  source_recommendation_id UUID,
  verified_by TEXT,
  hit_count INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learned_follow_up_lookup
  ON learned_follow_up_questions (crop_type, district, symptom_key, active);

CREATE INDEX IF NOT EXISTS idx_learned_follow_up_crop_issue
  ON learned_follow_up_questions (crop_type, issue_label, active)
  WHERE active = true;

ALTER TABLE learned_follow_up_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learned_follow_up_questions_service ON learned_follow_up_questions;
CREATE POLICY learned_follow_up_questions_service
  ON learned_follow_up_questions FOR ALL USING (true) WITH CHECK (true);
