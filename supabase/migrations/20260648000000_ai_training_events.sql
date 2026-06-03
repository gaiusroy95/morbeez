-- Stage 2 — Unified AI training correction spine
-- Single table for prediction → human correction events from all review surfaces.

CREATE TABLE IF NOT EXISTS ai_training_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  ai_session_id UUID REFERENCES ai_advisory_sessions(id) ON DELETE SET NULL,
  escalation_id UUID REFERENCES agronomist_escalations(id) ON DELETE SET NULL,
  recommendation_record_id UUID REFERENCES recommendation_records(id) ON DELETE SET NULL,
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  farmer_feedback_id UUID REFERENCES farmer_advisory_feedback(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'field_visit', 'crm', 'api')),
  review_surface TEXT NOT NULL CHECK (review_surface IN (
    'case_review', 'farmer_feedback', 'telecaller_escalation', 'field_finding'
  )),
  ai_prediction TEXT,
  ai_confidence DECIMAL(5, 4),
  ai_top_k JSONB NOT NULL DEFAULT '[]',
  human_action TEXT CHECK (human_action IN (
    'approve_ai', 'correct_ai', 'partial_match', 'escalate_urgent',
    'approved', 'rejected', 'partial'
  )),
  human_final_label TEXT,
  correction_reason TEXT,
  confidence_before DECIMAL(5, 4),
  confidence_after DECIMAL(5, 4),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_training_events_farmer
  ON ai_training_events (farmer_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_training_events_session
  ON ai_training_events (ai_session_id)
  WHERE ai_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_training_events_surface
  ON ai_training_events (review_surface, human_action, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_training_events_label
  ON ai_training_events (human_final_label, ai_prediction)
  WHERE human_final_label IS NOT NULL;

ALTER TABLE ai_training_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_training_events_service ON ai_training_events FOR ALL USING (true) WITH CHECK (true);
