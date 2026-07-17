-- WhatsApp Farm Activity Assistant — Phase 1 database foundation
-- Additive + idempotent. No destructive drops of existing data/columns.
-- Conversation draft/clarify/confirm flow uses free-text conversation_sessions.state
-- values plus conversation_sessions.context JSON (no new state enum).

-- ---------------------------------------------------------------------------
-- Draft spine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS farm_activity_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  conversation_session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open',
      'clarifying',
      'awaiting_confirm',
      'confirmed',
      'cancelled',
      'expired',
      'superseded'
    )),
  revision INT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  contract_version TEXT NOT NULL DEFAULT 'farm-activity-assistant/v1',
  draft_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  unresolved_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_message_ids TEXT[] NOT NULL DEFAULT '{}',
  source_provider TEXT NOT NULL DEFAULT 'whatsapp',
  primary_message_id TEXT,
  transcript TEXT,
  detected_language TEXT,
  preferred_language_hint TEXT,
  input_modalities TEXT[] NOT NULL DEFAULT '{}',
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  commit_command_id UUID REFERENCES operation_commands(id) ON DELETE SET NULL,
  committed_activity_ids UUID[] NOT NULL DEFAULT '{}',
  committed_roi_entry_ids UUID[] NOT NULL DEFAULT '{}',
  committed_harvest_ids UUID[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_activity_drafts_active_farmer_channel
  ON farm_activity_drafts (farmer_id, channel)
  WHERE status IN ('open', 'clarifying', 'awaiting_confirm');

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_activity_drafts_primary_message
  ON farm_activity_drafts (source_provider, primary_message_id)
  WHERE primary_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farm_activity_drafts_farmer_status
  ON farm_activity_drafts (farmer_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_farm_activity_drafts_session
  ON farm_activity_drafts (conversation_session_id, updated_at DESC)
  WHERE conversation_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farm_activity_drafts_lease
  ON farm_activity_drafts (lease_expires_at, id)
  WHERE lease_token IS NOT NULL AND status IN ('open', 'clarifying', 'awaiting_confirm');

CREATE INDEX IF NOT EXISTS idx_farm_activity_drafts_expires
  ON farm_activity_drafts (expires_at, id)
  WHERE expires_at IS NOT NULL AND status IN ('open', 'clarifying', 'awaiting_confirm');

COMMENT ON TABLE farm_activity_drafts IS
  'WhatsApp Farm Activity Assistant drafts; Confirm/Edit/Cancel before canonical writes.';
COMMENT ON COLUMN farm_activity_drafts.draft_json IS
  'farm-activity-assistant/v1 draft payload (sub-events, clarifications, source).';
COMMENT ON COLUMN farm_activity_drafts.source_message_ids IS
  'Provider message IDs contributing to this draft revision.';

CREATE TABLE IF NOT EXISTS farm_activity_draft_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES farm_activity_drafts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created',
      'extracted',
      'clarification_asked',
      'clarification_answered',
      'edited',
      'revision_bumped',
      'confirm_requested',
      'confirmed',
      'cancelled',
      'expired',
      'commit_started',
      'commit_succeeded',
      'commit_failed',
      'superseded'
    )),
  revision INT NOT NULL CHECK (revision >= 1),
  actor TEXT NOT NULL DEFAULT 'system',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farm_activity_draft_events_draft
  ON farm_activity_draft_events (draft_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_farm_activity_draft_events_type
  ON farm_activity_draft_events (event_type, created_at DESC);

COMMENT ON TABLE farm_activity_draft_events IS
  'Append-only clarification/edit/confirm audit trail for farm activity drafts.';

-- ---------------------------------------------------------------------------
-- Farmer terminology overrides + governed product/unit aliases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS farmer_terminology_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  resolved_meaning TEXT NOT NULL,
  standard_term TEXT,
  crop_type TEXT,
  district TEXT,
  crop_key TEXT GENERATED ALWAYS AS (COALESCE(crop_type, '')) STORED,
  district_key TEXT GENERATED ALWAYS AS (COALESCE(district, '')) STORED,
  source_draft_id UUID REFERENCES farm_activity_drafts(id) ON DELETE SET NULL,
  source_message_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (farmer_id, term, language, crop_key, district_key)
);

CREATE INDEX IF NOT EXISTS idx_farmer_terminology_overrides_lookup
  ON farmer_terminology_overrides (farmer_id, language, lower(term))
  WHERE active = true;

COMMENT ON TABLE farmer_terminology_overrides IS
  'Farmer-scoped terminology memory (personal lexicon before regional promotion).';

CREATE TABLE IF NOT EXISTS farm_activity_product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  district TEXT,
  crop_type TEXT,
  district_key TEXT GENERATED ALWAYS AS (COALESCE(district, '')) STORED,
  crop_key TEXT GENERATED ALWAYS AS (COALESCE(crop_type, '')) STORED,
  canonical_product_key TEXT NOT NULL,
  shopify_product_id TEXT,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'retired')),
  proposed_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  review_task_id UUID REFERENCES terminology_review_tasks(id) ON DELETE SET NULL,
  source_draft_id UUID REFERENCES farm_activity_drafts(id) ON DELETE SET NULL,
  source_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_activity_product_aliases_scope
  ON farm_activity_product_aliases (
    lower(alias), language, district_key, crop_key, COALESCE(farmer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_farm_activity_product_aliases_lookup
  ON farm_activity_product_aliases (language, lower(alias), status);

CREATE INDEX IF NOT EXISTS idx_farm_activity_product_aliases_canonical
  ON farm_activity_product_aliases (canonical_product_key, status);

COMMENT ON TABLE farm_activity_product_aliases IS
  'Governed product nickname/alias mapping for farm activity extraction.';

CREATE TABLE IF NOT EXISTS farm_activity_unit_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  district TEXT,
  crop_type TEXT,
  district_key TEXT GENERATED ALWAYS AS (COALESCE(district, '')) STORED,
  crop_key TEXT GENERATED ALWAYS AS (COALESCE(crop_type, '')) STORED,
  canonical_unit TEXT NOT NULL
    CHECK (canonical_unit IN (
      'kg', 'g', 'litre', 'ml', 'quintal', 'tonne', 'bag', 'piece',
      'hour', 'day', 'acre', 'other'
    )),
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'retired')),
  proposed_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  review_task_id UUID REFERENCES terminology_review_tasks(id) ON DELETE SET NULL,
  source_draft_id UUID REFERENCES farm_activity_drafts(id) ON DELETE SET NULL,
  source_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_activity_unit_aliases_scope
  ON farm_activity_unit_aliases (
    lower(alias), language, district_key, crop_key, COALESCE(farmer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_farm_activity_unit_aliases_lookup
  ON farm_activity_unit_aliases (language, lower(alias), status);

COMMENT ON TABLE farm_activity_unit_aliases IS
  'Governed unit alias mapping aligned to farm-activity-assistant/v1 units.';

-- ---------------------------------------------------------------------------
-- Provenance / idempotency / soft-void on canonical fact tables
-- ---------------------------------------------------------------------------

ALTER TABLE cultivation_activities
  ADD COLUMN IF NOT EXISTS farm_activity_draft_id UUID REFERENCES farm_activity_drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farm_activity_draft_revision INT,
  ADD COLUMN IF NOT EXISTS source_message_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source_command_id UUID REFERENCES operation_commands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS detected_language TEXT,
  ADD COLUMN IF NOT EXISTS input_modality TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_of_id UUID REFERENCES cultivation_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES cultivation_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS harvest_record_id UUID REFERENCES harvest_records(id) ON DELETE SET NULL;

DO $ca_modality$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cultivation_activities'::regclass
      AND conname = 'cultivation_activities_input_modality_check'
  ) THEN
    ALTER TABLE cultivation_activities
      ADD CONSTRAINT cultivation_activities_input_modality_check
      CHECK (
        input_modality IS NULL OR input_modality IN (
          'text', 'voice', 'image', 'invoice', 'mixed', 'button', 'staff'
        )
      ) NOT VALID;
  END IF;
END;
$ca_modality$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cultivation_activities_source_idempotency
  ON cultivation_activities (source_idempotency_key)
  WHERE source_idempotency_key IS NOT NULL AND voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cultivation_activities_source_command
  ON cultivation_activities (source_command_id)
  WHERE source_command_id IS NOT NULL AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_draft
  ON cultivation_activities (farm_activity_draft_id)
  WHERE farm_activity_draft_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_voided
  ON cultivation_activities (farmer_id, voided_at DESC)
  WHERE voided_at IS NOT NULL;

ALTER TABLE farmer_roi_entries
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES cultivation_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS harvest_record_id UUID REFERENCES harvest_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farm_activity_draft_id UUID REFERENCES farm_activity_drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farm_activity_draft_revision INT,
  ADD COLUMN IF NOT EXISTS source_message_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source_command_id UUID REFERENCES operation_commands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS detected_language TEXT,
  ADD COLUMN IF NOT EXISTS input_modality TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_of_id UUID REFERENCES farmer_roi_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES farmer_roi_entries(id) ON DELETE SET NULL;

DO $roi_modality$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.farmer_roi_entries'::regclass
      AND conname = 'farmer_roi_entries_input_modality_check'
  ) THEN
    ALTER TABLE farmer_roi_entries
      ADD CONSTRAINT farmer_roi_entries_input_modality_check
      CHECK (
        input_modality IS NULL OR input_modality IN (
          'text', 'voice', 'image', 'invoice', 'mixed', 'button', 'staff'
        )
      ) NOT VALID;
  END IF;
END;
$roi_modality$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_farmer_roi_entries_source_idempotency
  ON farmer_roi_entries (source_idempotency_key)
  WHERE source_idempotency_key IS NOT NULL AND voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_farmer_roi_entries_source_command
  ON farmer_roi_entries (source_command_id)
  WHERE source_command_id IS NOT NULL AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_roi_entries_activity
  ON farmer_roi_entries (activity_id)
  WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_roi_entries_draft
  ON farmer_roi_entries (farm_activity_draft_id)
  WHERE farm_activity_draft_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_roi_entries_voided
  ON farmer_roi_entries (farmer_id, voided_at DESC)
  WHERE voided_at IS NOT NULL;

ALTER TABLE harvest_records
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES cultivation_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farm_activity_draft_id UUID REFERENCES farm_activity_drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farm_activity_draft_revision INT,
  ADD COLUMN IF NOT EXISTS source_message_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source_command_id UUID REFERENCES operation_commands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS detected_language TEXT,
  ADD COLUMN IF NOT EXISTS input_modality TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_of_id UUID REFERENCES harvest_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES harvest_records(id) ON DELETE SET NULL;

DO $hr_modality$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.harvest_records'::regclass
      AND conname = 'harvest_records_input_modality_check'
  ) THEN
    ALTER TABLE harvest_records
      ADD CONSTRAINT harvest_records_input_modality_check
      CHECK (
        input_modality IS NULL OR input_modality IN (
          'text', 'voice', 'image', 'invoice', 'mixed', 'button', 'staff'
        )
      ) NOT VALID;
  END IF;
END;
$hr_modality$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_harvest_records_source_idempotency
  ON harvest_records (source_idempotency_key)
  WHERE source_idempotency_key IS NOT NULL AND voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_harvest_records_source_command
  ON harvest_records (source_command_id)
  WHERE source_command_id IS NOT NULL AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_harvest_records_activity
  ON harvest_records (activity_id)
  WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_harvest_records_draft
  ON harvest_records (farm_activity_draft_id)
  WHERE farm_activity_draft_id IS NOT NULL;

-- Keep existing cultivation_activities.source CHECK values unchanged
-- (whatsapp/admin/telecaller/system/mobile). Assistant writes still use
-- source='whatsapp' with input_modality/provenance for voice/text/invoice.

COMMENT ON COLUMN cultivation_activities.farm_activity_draft_id IS
  'Draft that produced this confirmed field activity (WhatsApp Farm Activity Assistant).';
COMMENT ON COLUMN farmer_roi_entries.activity_id IS
  'Explicit link to cultivation_activities when this ledger row is activity-derived.';
COMMENT ON COLUMN harvest_records.activity_id IS
  'Optional explicit link to the cultivation activity that recorded this harvest.';

-- ---------------------------------------------------------------------------
-- RLS + service_role policies
-- ---------------------------------------------------------------------------

ALTER TABLE farm_activity_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_activity_draft_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_terminology_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_activity_product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_activity_unit_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_activity_drafts_service ON farm_activity_drafts;
CREATE POLICY farm_activity_drafts_service
  ON farm_activity_drafts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS farm_activity_draft_events_service ON farm_activity_draft_events;
CREATE POLICY farm_activity_draft_events_service
  ON farm_activity_draft_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS farmer_terminology_overrides_service ON farmer_terminology_overrides;
CREATE POLICY farmer_terminology_overrides_service
  ON farmer_terminology_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS farm_activity_product_aliases_service ON farm_activity_product_aliases;
CREATE POLICY farm_activity_product_aliases_service
  ON farm_activity_product_aliases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS farm_activity_unit_aliases_service ON farm_activity_unit_aliases;
CREATE POLICY farm_activity_unit_aliases_service
  ON farm_activity_unit_aliases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON
  farm_activity_drafts,
  farm_activity_draft_events,
  farmer_terminology_overrides,
  farm_activity_product_aliases,
  farm_activity_unit_aliases
FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Append-only protections for draft events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION farm_activity_prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_farm_activity_draft_events_immutable
  ON farm_activity_draft_events;
CREATE TRIGGER trg_farm_activity_draft_events_immutable
  BEFORE UPDATE OR DELETE ON farm_activity_draft_events
  FOR EACH ROW EXECUTE FUNCTION farm_activity_prevent_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Transactional commit RPC skeleton (idempotent; ledger writes deferred)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION farm_activity_commit_draft(
  p_draft_id UUID,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_expected_revision INT,
  p_actor TEXT DEFAULT 'whatsapp:farmer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_command operation_commands%ROWTYPE;
  v_draft farm_activity_drafts%ROWTYPE;
  v_response JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required' USING ERRCODE = '22023';
  END IF;
  IF p_request_hash IS NULL OR length(trim(p_request_hash)) = 0 THEN
    RAISE EXCEPTION 'request hash is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO operation_commands (
    scope, idempotency_key, request_hash, actor_email, actor_role,
    aggregate_type, aggregate_id
  ) VALUES (
    'farm_activity.commit', p_idempotency_key, p_request_hash,
    p_actor, 'farmer', 'farm_activity_draft', p_draft_id
  )
  ON CONFLICT (scope, idempotency_key) DO NOTHING;

  SELECT * INTO v_command
  FROM operation_commands
  WHERE scope = 'farm_activity.commit'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_command.request_hash <> p_request_hash
     OR v_command.aggregate_id IS DISTINCT FROM p_draft_id THEN
    RAISE EXCEPTION 'idempotency key reused with a different request'
      USING ERRCODE = '22000';
  END IF;

  IF v_command.status IN ('succeeded', 'replayed') THEN
    RETURN COALESCE(v_command.response_json, '{}'::jsonb);
  END IF;

  -- Skeleton already claimed this command; replay without duplicate events.
  IF v_command.response_json IS NOT NULL THEN
    RETURN v_command.response_json;
  END IF;

  SELECT * INTO v_draft
  FROM farm_activity_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'farm activity draft % not found', p_draft_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_draft.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'stale draft revision: expected %, actual %',
      p_expected_revision, v_draft.revision
      USING ERRCODE = '40001';
  END IF;

  IF v_draft.status NOT IN ('awaiting_confirm', 'clarifying', 'open', 'confirmed') THEN
    RAISE EXCEPTION 'draft status % cannot be committed', v_draft.status
      USING ERRCODE = '55000';
  END IF;

  IF v_draft.expires_at IS NOT NULL AND v_draft.expires_at <= now()
     AND v_draft.status <> 'confirmed' THEN
    UPDATE farm_activity_drafts
    SET status = 'expired', updated_at = now()
    WHERE id = p_draft_id;
    RAISE EXCEPTION 'draft has expired' USING ERRCODE = '55000';
  END IF;

  -- Skeleton only: claim the idempotent command, bind it to the draft, and
  -- append commit_started. Leave command status='accepted' so Phase 2 can
  -- complete ledger writes and then mark succeeded on the same command row.
  UPDATE farm_activity_drafts
  SET commit_command_id = COALESCE(commit_command_id, v_command.id),
      updated_at = now()
  WHERE id = p_draft_id
  RETURNING * INTO v_draft;

  INSERT INTO farm_activity_draft_events (
    draft_id, event_type, revision, actor, payload
  ) VALUES (
    p_draft_id,
    'commit_started',
    v_draft.revision,
    p_actor,
    jsonb_build_object(
      'command_id', v_command.id,
      'ledger_writes', 'deferred',
      'draft_status', v_draft.status
    )
  );

  v_response := jsonb_build_object(
    'draft_id', v_draft.id,
    'revision', v_draft.revision,
    'status', v_draft.status,
    'commit_command_id', v_command.id,
    'farmer_id', v_draft.farmer_id,
    'ledger_writes', 'deferred'
  );

  UPDATE operation_commands
  SET response_json = v_response
  WHERE id = v_command.id;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION farm_activity_commit_draft(UUID, TEXT, TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION farm_activity_commit_draft(UUID, TEXT, TEXT, INT, TEXT)
  TO service_role;

COMMENT ON FUNCTION farm_activity_commit_draft(UUID, TEXT, TEXT, INT, TEXT) IS
  'Idempotent Farm Activity Assistant commit skeleton: claims operation_commands (left accepted), locks draft by revision, records commit_started; Phase 2 completes ledger writes on the same command.';

COMMENT ON COLUMN conversation_sessions.context IS
  'JSON session bag. Farm Activity Assistant may store draft pointers under farmActivityAssistant while state uses free-text values farm_activity_draft / farm_activity_clarify / farm_activity_confirm.';
