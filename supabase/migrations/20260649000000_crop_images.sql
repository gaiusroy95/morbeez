-- Stage 3 — Labeled crop image dataset for visual disease AI training

CREATE TABLE IF NOT EXISTS crop_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  ai_session_id UUID REFERENCES ai_advisory_sessions(id) ON DELETE SET NULL,
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  interaction_log_id UUID REFERENCES interaction_logs(id) ON DELETE SET NULL,
  storage_path TEXT,
  external_url TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'field_visit', 'crm', 'api')),
  crop TEXT,
  dap INT CHECK (dap IS NULL OR dap >= 0),
  symptoms JSONB NOT NULL DEFAULT '[]',
  gps_region TEXT,
  weather_snapshot_id UUID REFERENCES weather_snapshots(id) ON DELETE SET NULL,
  ai_prediction TEXT,
  ai_confidence DECIMAL(5, 4),
  agronomist_label TEXT,
  severity TEXT CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN (
    'pending', 'reviewed', 'skipped', 'excluded'
  )),
  review_action TEXT CHECK (review_action IS NULL OR review_action IN (
    'confirm_ai', 'correct_ai', 'skip', 'exclude'
  )),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crop_images_has_source_ref CHECK (
    storage_path IS NOT NULL OR external_url IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crop_images_storage_path
  ON crop_images (storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crop_images_review_queue
  ON crop_images (review_status, created_at DESC)
  WHERE review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_crop_images_crop
  ON crop_images (crop, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crop_images_farmer
  ON crop_images (farmer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crop_images_session
  ON crop_images (ai_session_id)
  WHERE ai_session_id IS NOT NULL;

ALTER TABLE crop_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY crop_images_service ON crop_images FOR ALL USING (true) WITH CHECK (true);

-- Extend training spine to include image review surface
ALTER TABLE ai_training_events DROP CONSTRAINT IF EXISTS ai_training_events_review_surface_check;
ALTER TABLE ai_training_events ADD CONSTRAINT ai_training_events_review_surface_check
  CHECK (review_surface IN (
    'case_review', 'farmer_feedback', 'telecaller_escalation', 'field_finding', 'image_review'
  ));

ALTER TABLE ai_training_events DROP CONSTRAINT IF EXISTS ai_training_events_human_action_check;
ALTER TABLE ai_training_events ADD CONSTRAINT ai_training_events_human_action_check
  CHECK (human_action IS NULL OR human_action IN (
    'approve_ai', 'correct_ai', 'partial_match', 'escalate_urgent',
    'approved', 'rejected', 'partial',
    'confirm_ai', 'skip', 'exclude'
  ));
