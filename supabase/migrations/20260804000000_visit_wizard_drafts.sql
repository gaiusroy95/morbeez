-- Server-side visit wizard drafts (v12 flow)

CREATE TABLE IF NOT EXISTS visit_wizard_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agronomist_visit_sessions(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  agronomist_email TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'intakeTriage',
  wizard_version TEXT NOT NULL DEFAULT 'v12',
  payload JSONB NOT NULL DEFAULT '{}',
  photo_refs JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'abandoned')),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_visit_wizard_drafts_agent
  ON visit_wizard_drafts (agronomist_email, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_visit_wizard_drafts_farmer
  ON visit_wizard_drafts (farmer_id, updated_at DESC);

ALTER TABLE visit_wizard_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_wizard_drafts_service ON visit_wizard_drafts FOR ALL USING (true) WITH CHECK (true);
