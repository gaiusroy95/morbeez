-- Telecaller call intelligence: recording, STT, AI summary, QC

ALTER TABLE crm_call_logs
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS recording_provider TEXT
    CHECK (recording_provider IS NULL OR recording_provider IN ('app_upload', 'voice_note', 'exotel', 'manual')),
  ADD COLUMN IF NOT EXISTS provider_call_id TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status TEXT NOT NULL DEFAULT 'none'
    CHECK (transcript_status IN ('none', 'pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suggested_stage TEXT,
  ADD COLUMN IF NOT EXISTS suggested_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_whatsapp_reply TEXT,
  ADD COLUMN IF NOT EXISTS qc_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS qc_rubric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS qc_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qc_flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'confirmed')),
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS interaction_log_id UUID REFERENCES interaction_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_session_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_agent_created
  ON crm_call_logs(agent_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_lead_created
  ON crm_call_logs(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_processing
  ON crm_call_logs(processing_status, created_at DESC);

ALTER TABLE terminology_review_tasks
  ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (source_channel IN ('whatsapp', 'call', 'field', 'other'));

CREATE TABLE IF NOT EXISTS call_qc_rubric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_name TEXT NOT NULL DEFAULT 'Default',
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO call_qc_rubric (rubric_name, criteria, is_active)
SELECT 'Default', '[
  {"key":"greeting","label":"Greeting","maxPoints":20},
  {"key":"problem_discovery","label":"Problem Discovery","maxPoints":20},
  {"key":"need_identification","label":"Need Identification","maxPoints":20},
  {"key":"solution_explanation","label":"Solution Explanation","maxPoints":20},
  {"key":"next_action","label":"Next Action","maxPoints":20}
]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM call_qc_rubric WHERE is_active = true);

ALTER TABLE call_qc_rubric ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_qc_rubric_all ON call_qc_rubric FOR ALL USING (true);

COMMENT ON COLUMN crm_call_logs.processing_status IS 'pending→processing→completed; confirmed after telecaller accepts AI summary';
