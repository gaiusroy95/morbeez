-- Visit AI reject recommendation workflow

ALTER TABLE visit_ai_cases DROP CONSTRAINT IF EXISTS visit_ai_cases_status_check;
ALTER TABLE visit_ai_cases ADD CONSTRAINT visit_ai_cases_status_check CHECK (
  status IN (
    'draft', 'analyzed', 'qa_complete', 'recommended', 'reviewed', 'submitted',
    'ai_suggested', 'under_review', 'need_more_evidence', 'waiting_farmer_response',
    'diagnosis_confirmed', 'recommendation_confirmed', 'closed'
  )
);

ALTER TABLE visit_ai_recommendations
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommendation_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS ai_diagnosis_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence_snapshot NUMERIC(5, 4);

ALTER TABLE visit_ai_recommendations DROP CONSTRAINT IF EXISTS visit_ai_recommendations_review_action_check;
ALTER TABLE visit_ai_recommendations ADD CONSTRAINT visit_ai_recommendations_review_action_check
  CHECK (
    review_action IS NULL OR review_action IN (
      'approve_ai', 'correct_ai', 'partial_match', 'escalate_urgent', 'reject_recommendation'
    )
  );

CREATE TABLE IF NOT EXISTS visit_ai_evidence_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_ai_case_id UUID NOT NULL REFERENCES visit_ai_cases(id) ON DELETE CASCADE,
  photo_types JSONB NOT NULL DEFAULT '[]',
  questions JSONB NOT NULL DEFAULT '[]',
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'responded', 'cancelled')
  ),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_ai_evidence_requests_case
  ON visit_ai_evidence_requests (visit_ai_case_id, created_at DESC);

ALTER TABLE visit_ai_evidence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_ai_evidence_requests_service ON visit_ai_evidence_requests
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ai_training_events DROP CONSTRAINT IF EXISTS ai_training_events_human_action_check;
ALTER TABLE ai_training_events ADD CONSTRAINT ai_training_events_human_action_check
  CHECK (human_action IS NULL OR human_action IN (
    'approve_ai', 'correct_ai', 'partial_match', 'escalate_urgent', 'reject_recommendation',
    'approved', 'rejected', 'partial',
    'confirm_ai', 'skip', 'exclude'
  ));
