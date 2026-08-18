-- Morbeez AI Farmer Calling System V2
-- One engine, many agronomist identities. Outcomes are snapshotted; never rewrite history.

-- ─── Consent / language / DND ────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_call_preferences (
  farmer_id UUID PRIMARY KEY REFERENCES farmers(id) ON DELETE CASCADE,
  preferred_language TEXT NOT NULL DEFAULT 'en'
    CHECK (preferred_language IN ('en', 'ml', 'ta', 'kn', 'hi')),
  language_source TEXT NOT NULL DEFAULT 'farmer_profile'
    CHECK (language_source IN ('first_speech', 'staff', 'farmer_profile', 'whatsapp')),
  language_locked_at TIMESTAMPTZ,
  consent_outbound_call BOOLEAN NOT NULL DEFAULT FALSE,
  consent_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  dnd BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  opted_out_reason TEXT,
  best_time_start TIME,
  best_time_end TIME,
  assigned_identity_id UUID,
  last_call_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_call_prefs_dnd
  ON farmer_call_preferences (dnd)
  WHERE dnd = TRUE;

-- ─── Agronomist DID identities (scale 3–4 → 10 without redesign) ──
CREATE TABLE IF NOT EXISTS agronomist_call_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 10),
  agronomist_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  agronomist_email TEXT,
  display_name TEXT NOT NULL DEFAULT 'Morbeez crop specialist',
  did_number TEXT,
  backup_identity_id UUID REFERENCES agronomist_call_identities(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  last_assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_number)
);

ALTER TABLE farmer_call_preferences
  DROP CONSTRAINT IF EXISTS farmer_call_preferences_assigned_identity_id_fkey;
ALTER TABLE farmer_call_preferences
  ADD CONSTRAINT farmer_call_preferences_assigned_identity_id_fkey
  FOREIGN KEY (assigned_identity_id) REFERENCES agronomist_call_identities(id) ON DELETE SET NULL;

INSERT INTO agronomist_call_identities (slot_number, display_name, is_active, notes)
VALUES
  (1, 'Morbeez crop specialist', FALSE, 'Map agronomist 1 — DID + email'),
  (2, 'Morbeez crop specialist', FALSE, 'Map agronomist 2 — DID + email'),
  (3, 'Morbeez crop specialist', FALSE, 'Map agronomist 3 — DID + email'),
  (4, 'Morbeez crop specialist', FALSE, 'Map agronomist 4 — DID + email')
ON CONFLICT (slot_number) DO NOTHING;

-- ─── Crop application / health protocols (rule engine, not LLM) ──
CREATE TABLE IF NOT EXISTS crop_call_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  dap_from INTEGER NOT NULL CHECK (dap_from >= 0),
  dap_to INTEGER NOT NULL CHECK (dap_to >= dap_from),
  prompt_kind TEXT NOT NULL DEFAULT 'application'
    CHECK (prompt_kind IN ('application', 'health', 'reminder')),
  question_en TEXT NOT NULL,
  follow_up_hours_if_no INTEGER NOT NULL DEFAULT 24,
  health_follow_up_days INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 7],
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_type, stage_key, version)
);

INSERT INTO crop_call_protocols (
  crop_type, stage_key, stage_label, dap_from, dap_to, prompt_kind, question_en, follow_up_hours_if_no
) VALUES
  ('ginger', 'sprouting', 'Sprouting', 0, 30, 'application',
   'Has the recommended application for this sprouting stage been completed?', 24),
  ('ginger', 'vegetative', 'Vegetative', 31, 90, 'application',
   'Has the recommended application for this vegetative stage been completed?', 24),
  ('ginger', 'tillering', 'Tillering', 91, 150, 'application',
   'Has the recommended application for this tillering stage been completed?', 24),
  ('ginger', 'bulking', 'Bulking', 151, 210, 'application',
   'Has the recommended application for this bulking stage been completed?', 24),
  ('ginger', 'maturity', 'Maturity', 211, 270, 'application',
   'Has the recommended application for this maturity stage been completed?', 48)
ON CONFLICT (crop_type, stage_key, version) DO NOTHING;

-- ─── Jobs (task engine) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_call_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  call_type TEXT NOT NULL
    CHECK (call_type IN ('qualification', 'reminder', 'crop_application', 'health_follow_up', 'escalation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'calling', 'awaiting_reply', 'queued_for_agent',
      'completed', 'failed', 'cancelled', 'skipped_dnd', 'skipped_window'
    )),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_identity_id UUID REFERENCES agronomist_call_identities(id) ON DELETE SET NULL,
  assigned_agronomist_email TEXT,
  language TEXT CHECK (language IN ('en', 'ml', 'ta', 'kn', 'hi')),
  payload JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_jobs_due
  ON ai_call_jobs (scheduled_at)
  WHERE status IN ('pending', 'skipped_window');

CREATE INDEX IF NOT EXISTS idx_ai_call_jobs_farmer
  ON ai_call_jobs (farmer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_call_jobs_open
  ON ai_call_jobs (
    farmer_id,
    call_type,
    COALESCE(payload->>'dedupeKey', '')
  )
  WHERE status IN ('pending', 'calling', 'awaiting_reply', 'queued_for_agent');

-- ─── Sessions (recording / transcript / frozen outcome) ──────
CREATE TABLE IF NOT EXISTS ai_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ai_call_jobs(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL,
  channel TEXT NOT NULL
    CHECK (channel IN ('voice', 'whatsapp', 'staff_script')),
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'awaiting_reply', 'completed', 'failed')),
  identity_id UUID REFERENCES agronomist_call_identities(id) ON DELETE SET NULL,
  did_number TEXT,
  language_detected TEXT CHECK (language_detected IN ('en', 'ml', 'ta', 'kn', 'hi')),
  language_used TEXT CHECK (language_used IN ('en', 'ml', 'ta', 'kn', 'hi')),
  transcript TEXT,
  summary TEXT,
  farmer_intent TEXT,
  outcome TEXT,
  recording_url TEXT,
  provider_call_id TEXT,
  crm_call_log_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  outcome_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_sessions_farmer
  ON ai_call_sessions (farmer_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_call_sessions_awaiting
  ON ai_call_sessions (farmer_id)
  WHERE status = 'awaiting_reply';

-- ─── Qualification scores (HOT / WARM / COLD) ────────────────
CREATE TABLE IF NOT EXISTS farmer_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_call_sessions(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  band TEXT NOT NULL CHECK (band IN ('HOT', 'WARM', 'COLD')),
  answers JSONB NOT NULL DEFAULT '{}',
  assigned_agronomist_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_qualifications_farmer
  ON farmer_qualifications (farmer_id, created_at DESC);

-- ─── Escalations from calling (assigned → backup → queue) ────
CREATE TABLE IF NOT EXISTS ai_call_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_call_sessions(id) ON DELETE SET NULL,
  job_id UUID REFERENCES ai_call_jobs(id) ON DELETE SET NULL,
  assigned_agronomist_email TEXT,
  backup_identity_id UUID REFERENCES agronomist_call_identities(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'callback_queue', 'resolved')),
  reason TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'high'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_call_escalations_open
  ON ai_call_escalations (status, created_at DESC)
  WHERE status IN ('open', 'assigned', 'callback_queue');

COMMENT ON TABLE ai_call_jobs IS
  'AI calling task engine. Voice is never faked: without TTS+telephony the job is WhatsApp or queued for a human agronomist.';
COMMENT ON TABLE ai_call_sessions IS
  'Immutable call attempt + frozen outcome_snapshot. Do not mutate outcome after completed.';
COMMENT ON TABLE agronomist_call_identities IS
  'One AI engine, many DIDs. AI discloses it is Morbeez assistance — it does not impersonate a named agronomist.';

ALTER TABLE farmer_call_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agronomist_call_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_call_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmer_call_preferences_all ON farmer_call_preferences;
CREATE POLICY farmer_call_preferences_all ON farmer_call_preferences FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS agronomist_call_identities_all ON agronomist_call_identities;
CREATE POLICY agronomist_call_identities_all ON agronomist_call_identities FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS crop_call_protocols_all ON crop_call_protocols;
CREATE POLICY crop_call_protocols_all ON crop_call_protocols FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ai_call_jobs_all ON ai_call_jobs;
CREATE POLICY ai_call_jobs_all ON ai_call_jobs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ai_call_sessions_all ON ai_call_sessions;
CREATE POLICY ai_call_sessions_all ON ai_call_sessions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS farmer_qualifications_all ON farmer_qualifications;
CREATE POLICY farmer_qualifications_all ON farmer_qualifications FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ai_call_escalations_all ON ai_call_escalations;
CREATE POLICY ai_call_escalations_all ON ai_call_escalations FOR ALL USING (true) WITH CHECK (true);

INSERT INTO role_module_permissions (role, module_key, can_read, can_write) VALUES
  ('super_admin', 'ai_calling', true, true),
  ('admin', 'ai_calling', true, true),
  ('manager', 'ai_calling', true, true),
  ('operations', 'ai_calling', true, false),
  ('agronomist', 'ai_calling', true, true),
  ('telecaller', 'ai_calling', true, true)
ON CONFLICT (role, module_key) DO UPDATE
SET can_read = EXCLUDED.can_read,
    can_write = EXCLUDED.can_write;
