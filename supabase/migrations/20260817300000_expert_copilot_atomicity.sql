-- Expert Copilot: atomic ownership, queue, commands, governance, and outbox.
-- Additive migration. Mutations exposed below are transaction boundaries and
-- deliberately use SECURITY DEFINER with a fixed search_path.

-- ---------------------------------------------------------------------------
-- Supporting indexes and invariants
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expert_cases_expired_lease
  ON expert_cases (lease_expires_at, id)
  WHERE owner_employee_id IS NOT NULL
    AND assignment_status IN ('offered', 'accepted', 'working', 'waiting_external');

CREATE INDEX IF NOT EXISTS idx_event_outbox_claim
  ON event_outbox (available_at, created_at, id)
  WHERE processed_at IS NULL AND dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_domain_event_command
  ON domain_event_ledger (command_id)
  WHERE command_id IS NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expert_capacity_state'::regclass
      AND conname = 'expert_capacity_nonnegative'
  ) THEN
    ALTER TABLE expert_capacity_state
      ADD CONSTRAINT expert_capacity_nonnegative
      CHECK (
        active_case_count >= 0
        AND active_weight >= 0
        AND max_active_cases >= 0
        AND max_active_weight >= 0
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expert_cases'::regclass
      AND conname = 'expert_case_owner_lease_consistent'
  ) THEN
    ALTER TABLE expert_cases
      ADD CONSTRAINT expert_case_owner_lease_consistent
      CHECK (
        (owner_employee_id IS NULL AND owner_email IS NULL
          AND lease_token IS NULL AND lease_expires_at IS NULL)
        OR
        (owner_employee_id IS NOT NULL AND owner_email IS NOT NULL
          AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
      ) NOT VALID;
  END IF;
END;
$constraints$;

-- ---------------------------------------------------------------------------
-- Capabilities and governed release registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS governance_actor_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_key TEXT NOT NULL,
  capability TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_key TEXT NOT NULL DEFAULT '*',
  granted_by TEXT NOT NULL,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  UNIQUE (actor_key, capability, scope_type, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_governance_capability_lookup
  ON governance_actor_capabilities
    (lower(actor_key), capability, scope_type, scope_key)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS governance_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  owner_actor_key TEXT NOT NULL,
  data_classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (data_classification IN ('public', 'internal', 'restricted', 'sensitive')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'frozen', 'retired')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance_dataset_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES governance_datasets(id) ON DELETE RESTRICT,
  release_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  manifest JSONB NOT NULL DEFAULT '{}',
  proposed_by TEXT NOT NULL,
  risk_class TEXT NOT NULL DEFAULT 'standard'
    CHECK (risk_class IN ('standard', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, release_version),
  UNIQUE (dataset_id, content_hash)
);

CREATE TABLE IF NOT EXISTS governance_dataset_release_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES governance_dataset_releases(id) ON DELETE RESTRICT,
  reviewer_actor_key TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected', 'needs_changes')),
  reason TEXT,
  evidence JSONB NOT NULL DEFAULT '{}',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (release_id, reviewer_actor_key)
);

CREATE TABLE IF NOT EXISTS governance_channel_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES governance_datasets(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL,
  scope_key TEXT NOT NULL DEFAULT '*',
  active_release_id UUID REFERENCES governance_dataset_releases(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('active', 'disabled', 'withdrawn')),
  bound_by TEXT NOT NULL,
  reason TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, channel, scope_key)
);

ALTER TABLE governance_actor_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_dataset_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_dataset_release_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_channel_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS governance_actor_capabilities_service ON governance_actor_capabilities;
CREATE POLICY governance_actor_capabilities_service
  ON governance_actor_capabilities FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS governance_datasets_service ON governance_datasets;
CREATE POLICY governance_datasets_service
  ON governance_datasets FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS governance_dataset_releases_service ON governance_dataset_releases;
CREATE POLICY governance_dataset_releases_service
  ON governance_dataset_releases FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS governance_dataset_release_reviews_service ON governance_dataset_release_reviews;
CREATE POLICY governance_dataset_release_reviews_service
  ON governance_dataset_release_reviews FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS governance_channel_bindings_service ON governance_channel_bindings;
CREATE POLICY governance_channel_bindings_service
  ON governance_channel_bindings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION governance_actor_has_capability(
  p_actor_key TEXT,
  p_capability TEXT,
  p_scope_type TEXT DEFAULT 'global',
  p_scope_key TEXT DEFAULT '*'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM governance_actor_capabilities c
    WHERE lower(c.actor_key) = lower(p_actor_key)
      AND c.capability = p_capability
      AND c.active
      AND c.valid_from <= now()
      AND (c.valid_until IS NULL OR c.valid_until > now())
      AND (
        (c.scope_type = p_scope_type AND c.scope_key IN (p_scope_key, '*'))
        OR (c.scope_type = 'global' AND c.scope_key = '*')
      )
  );
$$;

CREATE OR REPLACE FUNCTION governance_require_capability(
  p_actor_key TEXT,
  p_capability TEXT,
  p_scope_type TEXT DEFAULT 'global',
  p_scope_key TEXT DEFAULT '*'
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT governance_actor_has_capability(
    p_actor_key, p_capability, p_scope_type, p_scope_key
  ) THEN
    RAISE EXCEPTION 'actor % lacks capability % for %:%',
      p_actor_key, p_capability, p_scope_type, p_scope_key
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Append-only and actor-independence protections
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expert_prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION governance_enforce_independent_release_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposer TEXT;
BEGIN
  SELECT proposed_by INTO v_proposer
  FROM governance_dataset_releases
  WHERE id = NEW.release_id;

  IF lower(v_proposer) = lower(NEW.reviewer_actor_key) THEN
    RAISE EXCEPTION 'release proposer cannot review their own release'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION governance_enforce_independent_candidate_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposer TEXT;
BEGIN
  SELECT proposed_by INTO v_proposer
  FROM knowledge_candidates
  WHERE id = NEW.candidate_id;

  IF lower(v_proposer) = lower(NEW.reviewer_email) THEN
    RAISE EXCEPTION 'knowledge proposer cannot review their own candidate'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION governance_validate_channel_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release_dataset_id UUID;
BEGIN
  IF NEW.active_release_id IS NULL THEN
    IF NEW.status = 'active' THEN
      RAISE EXCEPTION 'an active channel binding requires a release'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT dataset_id INTO v_release_dataset_id
  FROM governance_dataset_releases
  WHERE id = NEW.active_release_id;
  IF v_release_dataset_id IS DISTINCT FROM NEW.dataset_id THEN
    RAISE EXCEPTION 'channel binding release belongs to another dataset'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'active' AND NOT EXISTS (
    SELECT 1
    FROM governance_dataset_release_reviews r
    WHERE r.release_id = NEW.active_release_id
      AND r.verdict = 'approved'
  ) THEN
    RAISE EXCEPTION 'an active channel binding requires an approved release'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_governance_release_review_independent
  ON governance_dataset_release_reviews;
CREATE TRIGGER trg_governance_release_review_independent
  BEFORE INSERT OR UPDATE ON governance_dataset_release_reviews
  FOR EACH ROW EXECUTE FUNCTION governance_enforce_independent_release_review();

DROP TRIGGER IF EXISTS trg_knowledge_candidate_review_independent
  ON knowledge_candidate_reviews;
CREATE TRIGGER trg_knowledge_candidate_review_independent
  BEFORE INSERT OR UPDATE ON knowledge_candidate_reviews
  FOR EACH ROW EXECUTE FUNCTION governance_enforce_independent_candidate_review();

DROP TRIGGER IF EXISTS trg_governance_channel_binding_valid
  ON governance_channel_bindings;
CREATE TRIGGER trg_governance_channel_binding_valid
  BEFORE INSERT OR UPDATE ON governance_channel_bindings
  FOR EACH ROW EXECUTE FUNCTION governance_validate_channel_binding();

DROP TRIGGER IF EXISTS trg_domain_event_ledger_immutable ON domain_event_ledger;
CREATE TRIGGER trg_domain_event_ledger_immutable
  BEFORE UPDATE OR DELETE ON domain_event_ledger
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_ownership_events_immutable ON expert_case_ownership_events;
CREATE TRIGGER trg_ownership_events_immutable
  BEFORE UPDATE OR DELETE ON expert_case_ownership_events
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_assignment_events_immutable ON expert_assignment_events;
CREATE TRIGGER trg_assignment_events_immutable
  BEFORE UPDATE OR DELETE ON expert_assignment_events
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_publication_events_immutable ON knowledge_publication_events;
CREATE TRIGGER trg_publication_events_immutable
  BEFORE UPDATE OR DELETE ON knowledge_publication_events
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_learning_evidence_immutable ON learning_evidence_events;
CREATE TRIGGER trg_learning_evidence_immutable
  BEFORE UPDATE OR DELETE ON learning_evidence_events
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_safety_decisions_immutable ON safety_gate_decisions;
CREATE TRIGGER trg_safety_decisions_immutable
  BEFORE UPDATE OR DELETE ON safety_gate_decisions
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_communication_attempts_immutable ON communication_attempts;
CREATE TRIGGER trg_communication_attempts_immutable
  BEFORE UPDATE OR DELETE ON communication_attempts
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_knowledge_versions_immutable ON knowledge_versions;
CREATE TRIGGER trg_knowledge_versions_immutable
  BEFORE UPDATE OR DELETE ON knowledge_versions
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_dataset_releases_immutable ON governance_dataset_releases;
CREATE TRIGGER trg_dataset_releases_immutable
  BEFORE UPDATE OR DELETE ON governance_dataset_releases
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();
DROP TRIGGER IF EXISTS trg_dataset_release_reviews_immutable ON governance_dataset_release_reviews;
CREATE TRIGGER trg_dataset_release_reviews_immutable
  BEFORE UPDATE OR DELETE ON governance_dataset_release_reviews
  FOR EACH ROW EXECUTE FUNCTION expert_prevent_ledger_mutation();

-- Preserve the identity and request of a command while allowing status/result updates.
CREATE OR REPLACE FUNCTION expert_protect_operation_command_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.scope, NEW.idempotency_key, NEW.request_hash, NEW.actor_id,
      NEW.actor_email, NEW.aggregate_type, NEW.aggregate_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.scope, OLD.idempotency_key, OLD.request_hash, OLD.actor_id,
      OLD.actor_email, OLD.aggregate_type, OLD.aggregate_id, OLD.created_at) THEN
    RAISE EXCEPTION 'operation command identity is immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operation_command_identity ON operation_commands;
CREATE TRIGGER trg_operation_command_identity
  BEFORE UPDATE ON operation_commands
  FOR EACH ROW EXECUTE FUNCTION expert_protect_operation_command_identity();

-- Governed records and append-only evidence are mutated only through trusted
-- server code/RPCs. Existing service_role policies remain compatible.
REVOKE INSERT, UPDATE, DELETE ON
  expert_cases,
  expert_capacity_state,
  domain_event_ledger,
  expert_case_ownership_events,
  expert_assignment_events,
  operation_commands,
  safety_gate_decisions,
  communication_intents,
  communication_attempts,
  event_outbox,
  learning_evidence_events,
  knowledge_candidates,
  knowledge_candidate_reviews,
  knowledge_records,
  knowledge_versions,
  knowledge_publications,
  knowledge_publication_events,
  reuse_memory_index,
  governance_audit_events,
  governance_actor_capabilities,
  governance_datasets,
  governance_dataset_releases,
  governance_dataset_release_reviews,
  governance_channel_bindings
FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic ownership and queue RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expert_claim_case(
  p_case_id UUID,
  p_employee_profile_id UUID,
  p_employee_email TEXT,
  p_actor_email TEXT,
  p_expected_queue_version BIGINT DEFAULT NULL,
  p_lease_minutes INT DEFAULT NULL
)
RETURNS expert_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case expert_cases%ROWTYPE;
  v_capacity expert_capacity_state%ROWTYPE;
  v_from_employee_id UUID;
  v_from_email TEXT;
  v_max_interruptions INT;
  v_lease_minutes INT;
  v_token UUID := gen_random_uuid();
BEGIN
  SELECT * INTO v_case FROM expert_cases
  WHERE id = p_case_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'expert case % not found', p_case_id USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_queue_version IS NOT NULL
     AND v_case.queue_version <> p_expected_queue_version THEN
    RAISE EXCEPTION 'stale queue version: expected %, actual %',
      p_expected_queue_version, v_case.queue_version USING ERRCODE = '40001';
  END IF;
  IF v_case.review_flag <> 'open' OR v_case.merged_into_case_id IS NOT NULL THEN
    RAISE EXCEPTION 'case is not claimable' USING ERRCODE = '55000';
  END IF;
  IF v_case.next_assignment_at IS NOT NULL AND v_case.next_assignment_at > now() THEN
    RAISE EXCEPTION 'case is not ready for assignment' USING ERRCODE = '55000';
  END IF;
  IF v_case.owner_employee_id IS NOT NULL
     AND v_case.lease_expires_at > now() THEN
    RAISE EXCEPTION 'case already has a live owner' USING ERRCODE = '55P03';
  END IF;
  v_from_employee_id := v_case.owner_employee_id;
  v_from_email := v_case.owner_email;
  IF v_from_employee_id IS NOT NULL THEN
    SELECT COALESCE(q.max_interruptions, 2) INTO v_max_interruptions
    FROM (SELECT 1) seed
    LEFT JOIN expert_queue_policies q
      ON q.case_type = 'expert_review'
      AND q.priority = v_case.priority
      AND q.enabled;
    IF v_case.interruption_count + 1 >= v_max_interruptions THEN
      RAISE EXCEPTION 'expired case reached its interruption limit; reap for intervention'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  -- Lock all affected capacity rows in deterministic order.
  PERFORM 1 FROM expert_capacity_state
  WHERE employee_profile_id IN (v_case.owner_employee_id, p_employee_profile_id)
  ORDER BY employee_profile_id
  FOR UPDATE;

  IF v_case.owner_employee_id IS NOT NULL THEN
    UPDATE expert_capacity_state
    SET active_case_count = greatest(active_case_count - 1, 0),
        active_weight = greatest(active_weight - v_case.queue_weight, 0),
        version = version + 1,
        updated_by = p_actor_email,
        updated_at = now()
    WHERE employee_profile_id = v_case.owner_employee_id;
  END IF;

  SELECT * INTO v_capacity FROM expert_capacity_state
  WHERE employee_profile_id = p_employee_profile_id;
  IF NOT FOUND OR v_capacity.availability <> 'accepting'
     OR (v_capacity.paused_until IS NOT NULL AND v_capacity.paused_until > now())
     OR v_capacity.active_case_count + 1 > v_capacity.max_active_cases
     OR v_capacity.active_weight + v_case.queue_weight > v_capacity.max_active_weight THEN
    RAISE EXCEPTION 'expert is unavailable or at capacity' USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(
    p_lease_minutes,
    CASE WHEN v_case.queue_route = 'field' THEN q.field_lease_minutes
         ELSE q.desk_lease_minutes END,
    CASE WHEN v_case.queue_route = 'field' THEN 240 ELSE 30 END
  ) INTO v_lease_minutes
  FROM (SELECT 1) seed
  LEFT JOIN expert_queue_policies q
    ON q.case_type = 'expert_review' AND q.priority = v_case.priority AND q.enabled;
  v_lease_minutes := greatest(1, least(v_lease_minutes, 1440));

  UPDATE expert_capacity_state
  SET active_case_count = active_case_count + 1,
      active_weight = active_weight + v_case.queue_weight,
      last_assigned_at = now(),
      last_seen_at = now(),
      version = version + 1,
      updated_by = p_actor_email,
      updated_at = now()
  WHERE employee_profile_id = p_employee_profile_id;

  UPDATE expert_cases
  SET owner_employee_id = p_employee_profile_id,
      owner_email = lower(p_employee_email),
      lease_token = v_token,
      lease_expires_at = now() + make_interval(mins => v_lease_minutes),
      last_heartbeat_at = now(),
      assignment_status = 'working',
      status = 'under_review',
      first_assigned_at = COALESCE(first_assigned_at, now()),
      assigned_at = now(),
      accepted_at = COALESCE(accepted_at, now()),
      queue_version = queue_version + 1,
      interruption_count = interruption_count
        + CASE WHEN v_case.owner_employee_id IS NULL THEN 0 ELSE 1 END,
      last_interruption_reason = CASE
        WHEN v_case.owner_employee_id IS NULL THEN last_interruption_reason
        ELSE 'expired_lease_reclaimed'
      END,
      next_assignment_at = NULL,
      updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO expert_case_ownership_events (
    case_id, event_type, from_owner_email, to_owner_email,
    from_employee_id, to_employee_id, lease_token, reason, actor_email
  ) VALUES (
    p_case_id, 'claimed', v_from_email, lower(p_employee_email),
    v_from_employee_id, p_employee_profile_id, v_token,
    'atomic_claim', p_actor_email
  );
  INSERT INTO expert_assignment_events (
    case_id, assignment_version, event_type, to_employee_profile_id,
    to_owner_email, actor_type, actor_id, reason_code, capacity_snapshot
  ) VALUES (
    p_case_id, v_case.queue_version, 'claimed', p_employee_profile_id,
    lower(p_employee_email), 'staff', p_actor_email, 'atomic_claim',
    jsonb_build_object(
      'active_case_count', v_capacity.active_case_count + 1,
      'active_weight', v_capacity.active_weight + v_case.queue_weight
    )
  );
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION expert_heartbeat_case(
  p_case_id UUID,
  p_employee_profile_id UUID,
  p_lease_token UUID,
  p_extend_minutes INT DEFAULT 30
)
RETURNS expert_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case expert_cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM expert_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.owner_employee_id IS DISTINCT FROM p_employee_profile_id
     OR v_case.lease_token IS DISTINCT FROM p_lease_token
     OR v_case.lease_expires_at IS NULL
     OR v_case.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'lease is absent, expired, or owned by another actor'
      USING ERRCODE = '55000';
  END IF;

  UPDATE expert_cases
  SET last_heartbeat_at = now(),
      lease_expires_at = now() + make_interval(mins => greatest(1, least(p_extend_minutes, 1440))),
      queue_version = queue_version + 1,
      updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  UPDATE expert_capacity_state
  SET last_seen_at = now(), version = version + 1, updated_at = now()
  WHERE employee_profile_id = p_employee_profile_id;

  INSERT INTO expert_case_ownership_events (
    case_id, event_type, from_owner_email, to_owner_email,
    from_employee_id, to_employee_id, lease_token, reason
  ) VALUES (
    p_case_id, 'renewed', v_case.owner_email, v_case.owner_email,
    p_employee_profile_id, p_employee_profile_id, p_lease_token, 'heartbeat'
  );
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION expert_release_case(
  p_case_id UUID,
  p_employee_profile_id UUID,
  p_lease_token UUID,
  p_actor_email TEXT,
  p_reason TEXT,
  p_requeue_delay_seconds INT DEFAULT 0
)
RETURNS expert_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case expert_cases%ROWTYPE;
  v_from_email TEXT;
  v_max_interruptions INT;
  v_intervention BOOLEAN;
BEGIN
  SELECT * INTO v_case FROM expert_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.owner_employee_id IS DISTINCT FROM p_employee_profile_id
     OR v_case.lease_token IS DISTINCT FROM p_lease_token THEN
    RAISE EXCEPTION 'lease is not owned by the releasing actor'
      USING ERRCODE = '55000';
  END IF;
  v_from_email := v_case.owner_email;
  SELECT COALESCE(q.max_interruptions, 2) INTO v_max_interruptions
  FROM (SELECT 1) seed
  LEFT JOIN expert_queue_policies q
    ON q.case_type = 'expert_review' AND q.priority = v_case.priority AND q.enabled;
  v_intervention := v_case.interruption_count + 1 >= v_max_interruptions;

  PERFORM 1 FROM expert_capacity_state
  WHERE employee_profile_id = p_employee_profile_id FOR UPDATE;
  UPDATE expert_capacity_state
  SET active_case_count = greatest(active_case_count - 1, 0),
      active_weight = greatest(active_weight - v_case.queue_weight, 0),
      version = version + 1,
      updated_by = p_actor_email,
      updated_at = now()
  WHERE employee_profile_id = p_employee_profile_id;

  UPDATE expert_cases
  SET owner_employee_id = NULL, owner_email = NULL, lease_token = NULL,
      lease_expires_at = NULL, last_heartbeat_at = NULL,
      assignment_status = CASE WHEN v_intervention
        THEN 'intervention_required' ELSE 'queued' END,
      status = 'awaiting_capacity',
      queue_version = queue_version + 1,
      requeue_count = requeue_count + 1,
      interruption_count = interruption_count + 1,
      last_interruption_reason = p_reason,
      next_assignment_at = CASE WHEN v_intervention THEN NULL
        ELSE now() + make_interval(
          secs => greatest(0, p_requeue_delay_seconds)
        ) END,
      manual_intervention_at = CASE WHEN v_intervention
        THEN now() ELSE manual_intervention_at END,
      queued_at = CASE WHEN v_intervention THEN queued_at ELSE now() END,
      updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO expert_case_ownership_events (
    case_id, event_type, from_owner_email, from_employee_id,
    reason, actor_email
  ) VALUES (
    p_case_id, 'released', v_from_email, p_employee_profile_id,
    p_reason, p_actor_email
  );
  INSERT INTO expert_assignment_events (
    case_id, assignment_version, event_type, from_employee_profile_id,
    from_owner_email, actor_type, actor_id, reason_code
  ) VALUES (
    p_case_id, v_case.queue_version,
    CASE WHEN v_intervention THEN 'intervention_required' ELSE 'released' END,
    p_employee_profile_id,
    v_from_email, 'staff', p_actor_email, p_reason
  );
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION expert_transfer_case(
  p_case_id UUID,
  p_from_employee_profile_id UUID,
  p_lease_token UUID,
  p_to_employee_profile_id UUID,
  p_to_employee_email TEXT,
  p_actor_email TEXT,
  p_reason TEXT,
  p_lease_minutes INT DEFAULT 30
)
RETURNS expert_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case expert_cases%ROWTYPE;
  v_target expert_capacity_state%ROWTYPE;
  v_from_email TEXT;
  v_max_interruptions INT;
  v_token UUID := gen_random_uuid();
BEGIN
  IF p_from_employee_profile_id = p_to_employee_profile_id THEN
    RAISE EXCEPTION 'transfer target must differ from current owner'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_case FROM expert_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.owner_employee_id IS DISTINCT FROM p_from_employee_profile_id
     OR v_case.lease_token IS DISTINCT FROM p_lease_token
     OR v_case.lease_expires_at IS NULL
     OR v_case.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'source lease is invalid or expired' USING ERRCODE = '55000';
  END IF;
  v_from_email := v_case.owner_email;
  SELECT COALESCE(q.max_interruptions, 2) INTO v_max_interruptions
  FROM (SELECT 1) seed
  LEFT JOIN expert_queue_policies q
    ON q.case_type = 'expert_review' AND q.priority = v_case.priority AND q.enabled;
  IF v_case.interruption_count + 1 >= v_max_interruptions THEN
    RAISE EXCEPTION 'case has reached its interruption limit'
      USING ERRCODE = '55000';
  END IF;

  PERFORM 1 FROM expert_capacity_state
  WHERE employee_profile_id IN (p_from_employee_profile_id, p_to_employee_profile_id)
  ORDER BY employee_profile_id FOR UPDATE;
  SELECT * INTO v_target FROM expert_capacity_state
  WHERE employee_profile_id = p_to_employee_profile_id;
  IF NOT FOUND OR v_target.availability <> 'accepting'
     OR v_target.active_case_count + 1 > v_target.max_active_cases
     OR v_target.active_weight + v_case.queue_weight > v_target.max_active_weight THEN
    RAISE EXCEPTION 'transfer target is unavailable or at capacity'
      USING ERRCODE = '55000';
  END IF;

  UPDATE expert_capacity_state
  SET active_case_count = CASE
        WHEN employee_profile_id = p_to_employee_profile_id
          THEN active_case_count + 1
        ELSE greatest(active_case_count - 1, 0)
      END,
      active_weight = CASE
        WHEN employee_profile_id = p_to_employee_profile_id
          THEN active_weight + v_case.queue_weight
        ELSE greatest(active_weight - v_case.queue_weight, 0)
      END,
      last_assigned_at = CASE WHEN employee_profile_id = p_to_employee_profile_id
                              THEN now() ELSE last_assigned_at END,
      version = version + 1, updated_by = p_actor_email, updated_at = now()
  WHERE employee_profile_id IN (p_from_employee_profile_id, p_to_employee_profile_id);

  UPDATE expert_cases
  SET owner_employee_id = p_to_employee_profile_id,
      owner_email = lower(p_to_employee_email),
      lease_token = v_token,
      lease_expires_at = now() + make_interval(
        mins => greatest(1, least(p_lease_minutes, 1440))
      ),
      last_heartbeat_at = now(),
      assigned_at = now(),
      queue_version = queue_version + 1,
      interruption_count = interruption_count + 1,
      last_interruption_reason = p_reason,
      updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO expert_case_ownership_events (
    case_id, event_type, from_owner_email, to_owner_email,
    from_employee_id, to_employee_id, lease_token, reason, actor_email
  ) VALUES (
    p_case_id, 'transferred', v_from_email, lower(p_to_employee_email),
    p_from_employee_profile_id, p_to_employee_profile_id, v_token,
    p_reason, p_actor_email
  );
  INSERT INTO expert_assignment_events (
    case_id, assignment_version, event_type,
    from_employee_profile_id, to_employee_profile_id,
    from_owner_email, to_owner_email, actor_type, actor_id, reason_code
  ) VALUES (
    p_case_id, v_case.queue_version, 'transferred',
    p_from_employee_profile_id, p_to_employee_profile_id,
    v_from_email, lower(p_to_employee_email), 'staff', p_actor_email, p_reason
  );
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION expert_assign_next_case(
  p_employee_profile_id UUID,
  p_employee_email TEXT,
  p_actor_email TEXT,
  p_lease_minutes INT DEFAULT NULL
)
RETURNS expert_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case_id UUID;
  v_case expert_cases%ROWTYPE;
BEGIN
  -- The candidate row is skipped if another dispatcher already locked it.
  SELECT c.id INTO v_case_id
  FROM expert_cases c
  WHERE c.review_flag = 'open'
    AND c.merged_into_case_id IS NULL
    AND c.owner_employee_id IS NULL
    AND c.assignment_status = 'queued'
    AND (c.next_assignment_at IS NULL OR c.next_assignment_at <= now())
    AND NOT EXISTS (
      SELECT 1
      FROM expert_queue_requirements r
      WHERE r.case_id = c.id AND r.required
        AND NOT EXISTS (
          SELECT 1
          FROM expert_specialties s
          WHERE s.employee_profile_id = p_employee_profile_id
            AND s.active
            AND s.specialty_type = r.specialty_type
            AND s.specialty_key = r.specialty_key
            AND s.proficiency >= r.minimum_proficiency
        )
    )
  ORDER BY
    CASE c.priority_tier WHEN 'emergency' THEN 0 WHEN 'sla_risk' THEN 1 ELSE 2 END,
    c.sla_due_at NULLS LAST, c.priority_score DESC, c.queued_at, c.id
  FOR UPDATE OF c SKIP LOCKED
  LIMIT 1;

  IF v_case_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_case
  FROM expert_claim_case(
    v_case_id, p_employee_profile_id, p_employee_email, p_actor_email,
    NULL, p_lease_minutes
  );
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION expert_reap_expired_leases(
  p_actor_email TEXT DEFAULT 'system:lease-reaper',
  p_limit INT DEFAULT 100
)
RETURNS SETOF expert_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case expert_cases%ROWTYPE;
  v_result expert_cases%ROWTYPE;
  v_max_interruptions INT;
  v_intervention BOOLEAN;
BEGIN
  FOR v_case IN
    SELECT c.*
    FROM expert_cases c
    WHERE c.owner_employee_id IS NOT NULL
      AND c.lease_expires_at <= now()
      AND c.assignment_status IN ('offered', 'accepted', 'working', 'waiting_external')
    ORDER BY c.lease_expires_at, c.id
    FOR UPDATE OF c SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 1000))
  LOOP
    PERFORM 1 FROM expert_capacity_state
    WHERE employee_profile_id = v_case.owner_employee_id FOR UPDATE;
    UPDATE expert_capacity_state
    SET active_case_count = greatest(active_case_count - 1, 0),
        active_weight = greatest(active_weight - v_case.queue_weight, 0),
        version = version + 1, updated_by = p_actor_email, updated_at = now()
    WHERE employee_profile_id = v_case.owner_employee_id;

    SELECT COALESCE(q.max_interruptions, 2) INTO v_max_interruptions
    FROM (SELECT 1) seed
    LEFT JOIN expert_queue_policies q
      ON q.case_type = 'expert_review' AND q.priority = v_case.priority AND q.enabled;
    v_intervention := v_case.interruption_count + 1 >= v_max_interruptions;

    UPDATE expert_cases
    SET owner_employee_id = NULL, owner_email = NULL, lease_token = NULL,
        lease_expires_at = NULL, last_heartbeat_at = NULL,
        assignment_status = CASE WHEN v_intervention
          THEN 'intervention_required' ELSE 'queued' END,
        status = CASE WHEN v_intervention
          THEN 'awaiting_capacity' ELSE status END,
        queue_version = queue_version + 1,
        requeue_count = requeue_count + 1,
        interruption_count = interruption_count + 1,
        last_interruption_reason = 'lease_expired',
        next_assignment_at = CASE WHEN v_intervention THEN NULL ELSE now() END,
        manual_intervention_at = CASE WHEN v_intervention
          THEN now() ELSE manual_intervention_at END,
        queued_at = CASE WHEN v_intervention THEN queued_at ELSE now() END,
        updated_at = now()
    WHERE id = v_case.id
    RETURNING * INTO v_result;

    INSERT INTO expert_case_ownership_events (
      case_id, event_type, from_owner_email, from_employee_id, reason, actor_email
    ) VALUES (
      v_case.id, 'timed_out', v_case.owner_email, v_case.owner_employee_id,
      'lease_expired', p_actor_email
    );
    INSERT INTO expert_assignment_events (
      case_id, assignment_version, event_type, from_employee_profile_id,
      from_owner_email, actor_type, actor_id, reason_code
    ) VALUES (
      v_case.id, v_result.queue_version,
      CASE WHEN v_intervention THEN 'intervention_required' ELSE 'requeued' END,
      v_case.owner_employee_id, v_case.owner_email,
      'system', p_actor_email, 'lease_expired'
    );
    RETURN NEXT v_result;
  END LOOP;
  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent case review commit and close commands
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expert_commit_case_review(
  p_case_id UUID,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_actor_email TEXT,
  p_employee_profile_id UUID,
  p_lease_token UUID,
  p_expected_revision INT,
  p_revision_payload JSONB,
  p_communication JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_command operation_commands%ROWTYPE;
  v_case expert_cases%ROWTYPE;
  v_revision_id UUID;
  v_sequence BIGINT;
  v_response JSONB;
  v_intent_id UUID;
  v_content_hash TEXT;
  v_intent_payload JSONB;
BEGIN
  INSERT INTO operation_commands (
    scope, idempotency_key, request_hash, actor_email, actor_role,
    aggregate_type, aggregate_id
  ) VALUES (
    'expert_case.review_commit', p_idempotency_key, p_request_hash,
    p_actor_email, 'expert', 'expert_case', p_case_id
  )
  ON CONFLICT (scope, idempotency_key) DO NOTHING;

  SELECT * INTO v_command FROM operation_commands
  WHERE scope = 'expert_case.review_commit'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF v_command.request_hash <> p_request_hash
     OR v_command.aggregate_id IS DISTINCT FROM p_case_id THEN
    RAISE EXCEPTION 'idempotency key reused with a different request'
      USING ERRCODE = '22000';
  END IF;
  IF v_command.status IN ('succeeded', 'replayed') THEN
    RETURN v_command.response_json;
  END IF;

  SELECT * INTO v_case FROM expert_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.owner_employee_id IS DISTINCT FROM p_employee_profile_id
     OR v_case.lease_token IS DISTINCT FROM p_lease_token
     OR v_case.lease_expires_at IS NULL
     OR v_case.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'a live matching lease is required' USING ERRCODE = '55000';
  END IF;
  IF v_case.current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'stale revision: expected %, actual %',
      p_expected_revision, v_case.current_revision USING ERRCODE = '40001';
  END IF;

  INSERT INTO expert_case_revisions (
    case_id, revision, source, payload, created_by
  ) VALUES (
    p_case_id, p_expected_revision + 1, 'expert_draft',
    COALESCE(p_revision_payload, '{}'::jsonb), p_actor_email
  ) RETURNING id INTO v_revision_id;

  UPDATE expert_case_drafts
  SET status = 'approved', updated_at = now()
  WHERE case_id = p_case_id AND status = 'pending'
    AND base_revision = p_expected_revision;
  UPDATE expert_cases
  SET current_revision = p_expected_revision + 1,
      pending_draft_revision = NULL,
      status = 'ready_to_close',
      queue_version = queue_version + 1,
      updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  SELECT COALESCE(max(sequence), 0) + 1 INTO v_sequence
  FROM domain_event_ledger
  WHERE aggregate_type = 'expert_case' AND aggregate_id = p_case_id;
  INSERT INTO domain_event_ledger (
    command_id, aggregate_type, aggregate_id, sequence, event_type,
    actor_email, before_state, after_state, metadata
  ) VALUES (
    v_command.id, 'expert_case', p_case_id, v_sequence,
    'expert_case.review_committed', p_actor_email,
    jsonb_build_object('revision', p_expected_revision),
    jsonb_build_object('revision', v_case.current_revision, 'status', v_case.status),
    jsonb_build_object('revision_id', v_revision_id)
  );

  IF p_communication IS NOT NULL THEN
    v_intent_payload := COALESCE(p_communication->'payload', '{}'::jsonb);
    v_content_hash := COALESCE(
      NULLIF(p_communication->>'content_hash', ''),
      md5(v_intent_payload::text)
    );
    INSERT INTO communication_intents (
      aggregate_type, aggregate_id, case_id, channel, purpose,
      content_version, content_hash, recipient_snapshot, payload
    ) VALUES (
      'expert_case', p_case_id, p_case_id,
      COALESCE(p_communication->>'channel', 'whatsapp'),
      COALESCE(p_communication->>'purpose', 'recommendation'),
      v_case.current_revision, v_content_hash,
      COALESCE(p_communication->'recipient_snapshot', '{}'::jsonb),
      v_intent_payload
    )
    ON CONFLICT (aggregate_type, aggregate_id, channel, purpose, content_version)
    DO UPDATE SET updated_at = communication_intents.updated_at
    RETURNING id INTO v_intent_id;

    INSERT INTO event_outbox (
      id, event_type, source, payload, idempotency_key, status, available_at
    )
    SELECT gen_random_uuid(), 'communication.intent_queued', 'expert_copilot',
      jsonb_build_object('intent_id', v_intent_id, 'case_id', p_case_id),
      'communication-intent:' || v_intent_id::text, 'pending', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM event_outbox
      WHERE idempotency_key = 'communication-intent:' || v_intent_id::text
    );
  END IF;

  v_response := jsonb_build_object(
    'case_id', p_case_id,
    'revision', v_case.current_revision,
    'revision_id', v_revision_id,
    'communication_intent_id', v_intent_id,
    'queue_version', v_case.queue_version
  );
  UPDATE operation_commands
  SET status = 'succeeded', response_json = v_response, completed_at = now()
  WHERE id = v_command.id;
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION expert_close_case(
  p_case_id UUID,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_actor_email TEXT,
  p_employee_profile_id UUID,
  p_lease_token UUID,
  p_expected_revision INT,
  p_close_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_command operation_commands%ROWTYPE;
  v_case expert_cases%ROWTYPE;
  v_from_email TEXT;
  v_sequence BIGINT;
  v_response JSONB;
BEGIN
  INSERT INTO operation_commands (
    scope, idempotency_key, request_hash, actor_email, actor_role,
    aggregate_type, aggregate_id
  ) VALUES (
    'expert_case.close', p_idempotency_key, p_request_hash,
    p_actor_email, 'expert', 'expert_case', p_case_id
  )
  ON CONFLICT (scope, idempotency_key) DO NOTHING;
  SELECT * INTO v_command FROM operation_commands
  WHERE scope = 'expert_case.close' AND idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF v_command.request_hash <> p_request_hash
     OR v_command.aggregate_id IS DISTINCT FROM p_case_id THEN
    RAISE EXCEPTION 'idempotency key reused with a different request'
      USING ERRCODE = '22000';
  END IF;
  IF v_command.status IN ('succeeded', 'replayed') THEN
    RETURN v_command.response_json;
  END IF;

  SELECT * INTO v_case FROM expert_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.owner_employee_id IS DISTINCT FROM p_employee_profile_id
     OR v_case.lease_token IS DISTINCT FROM p_lease_token
     OR v_case.lease_expires_at IS NULL
     OR v_case.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'a live matching lease is required' USING ERRCODE = '55000';
  END IF;
  IF v_case.current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'stale revision: expected %, actual %',
      p_expected_revision, v_case.current_revision USING ERRCODE = '40001';
  END IF;
  IF v_case.status NOT IN ('ready_to_close', 'under_review', 'awaiting_farmer') THEN
    RAISE EXCEPTION 'case status % cannot be closed', v_case.status
      USING ERRCODE = '55000';
  END IF;
  v_from_email := v_case.owner_email;

  PERFORM 1 FROM expert_capacity_state
  WHERE employee_profile_id = p_employee_profile_id FOR UPDATE;
  UPDATE expert_capacity_state
  SET active_case_count = greatest(active_case_count - 1, 0),
      active_weight = greatest(active_weight - v_case.queue_weight, 0),
      version = version + 1, updated_by = p_actor_email, updated_at = now()
  WHERE employee_profile_id = p_employee_profile_id;

  UPDATE expert_cases
  SET status = 'closed', review_flag = 'closed',
      assignment_status = 'completed',
      owner_employee_id = NULL, owner_email = NULL, lease_token = NULL,
      lease_expires_at = NULL, last_heartbeat_at = NULL,
      closed_at = now(), closed_by = p_actor_email,
      close_summary = COALESCE(p_close_summary, '{}'::jsonb),
      queue_version = queue_version + 1, updated_at = now()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  SELECT COALESCE(max(sequence), 0) + 1 INTO v_sequence
  FROM domain_event_ledger
  WHERE aggregate_type = 'expert_case' AND aggregate_id = p_case_id;
  INSERT INTO domain_event_ledger (
    command_id, aggregate_type, aggregate_id, sequence, event_type,
    actor_email, before_state, after_state
  ) VALUES (
    v_command.id, 'expert_case', p_case_id, v_sequence,
    'expert_case.closed', p_actor_email,
    jsonb_build_object('status', 'ready_to_close', 'revision', p_expected_revision),
    jsonb_build_object('status', 'closed', 'revision', p_expected_revision)
  );
  INSERT INTO expert_case_ownership_events (
    case_id, event_type, from_owner_email, from_employee_id, reason, actor_email
  ) VALUES (
    p_case_id, 'released', v_from_email, p_employee_profile_id,
    'case_closed', p_actor_email
  );
  INSERT INTO expert_assignment_events (
    case_id, assignment_version, event_type, from_employee_profile_id,
    from_owner_email, actor_type, actor_id, reason_code
  ) VALUES (
    p_case_id, v_case.queue_version, 'completed', p_employee_profile_id,
    v_from_email, 'staff', p_actor_email, 'case_closed'
  );

  INSERT INTO event_outbox (
    id, event_type, source, payload, idempotency_key, status, available_at
  )
  SELECT gen_random_uuid(), 'expert_case.closed', 'expert_copilot',
    jsonb_build_object('case_id', p_case_id, 'revision', p_expected_revision),
    'expert-case-closed:' || p_case_id::text || ':' || p_expected_revision::text,
    'pending', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM event_outbox
    WHERE idempotency_key =
      'expert-case-closed:' || p_case_id::text || ':' || p_expected_revision::text
  );

  v_response := jsonb_build_object(
    'case_id', p_case_id, 'status', 'closed',
    'revision', p_expected_revision, 'queue_version', v_case.queue_version
  );
  UPDATE operation_commands
  SET status = 'succeeded', response_json = v_response, completed_at = now()
  WHERE id = v_command.id;
  RETURN v_response;
END;
$$;

-- ---------------------------------------------------------------------------
-- Outbox leasing, completion, retry, and dead-lettering
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_event_outbox(
  p_worker_id TEXT,
  p_limit INT DEFAULT 50,
  p_lease_seconds INT DEFAULT 60
)
RETURNS SETOF event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Expired workers relinquish their rows. Exhausted rows are dead-lettered
  -- before any new claim is selected.
  UPDATE event_outbox
  SET locked_at = NULL, locked_by = NULL, lease_expires_at = NULL
  WHERE processed_at IS NULL
    AND dead_lettered_at IS NULL
    AND lease_expires_at <= now();

  UPDATE event_outbox
  SET status = 'failed',
      dead_lettered_at = now(),
      locked_at = NULL, locked_by = NULL, lease_expires_at = NULL,
      last_error = COALESCE(last_error, 'maximum attempts exceeded')
  WHERE processed_at IS NULL
    AND dead_lettered_at IS NULL
    AND attempt_count >= max_attempts;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM event_outbox o
    WHERE o.processed_at IS NULL
      AND o.dead_lettered_at IS NULL
      AND o.attempt_count < o.max_attempts
      AND COALESCE(o.available_at, o.created_at) <= now()
      AND (o.lease_expires_at IS NULL OR o.lease_expires_at <= now())
      AND o.status IN ('pending', 'failed')
    ORDER BY COALESCE(o.available_at, o.created_at), o.created_at, o.id
    FOR UPDATE OF o SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 1000))
  )
  UPDATE event_outbox o
  SET locked_at = now(),
      locked_by = p_worker_id,
      lease_expires_at = now() + make_interval(
        secs => greatest(1, least(p_lease_seconds, 3600))
      ),
      attempt_count = o.attempt_count + 1,
      retry_count = COALESCE(o.retry_count, 0) + 1,
      status = 'pending'
  FROM candidates c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION complete_event_outbox(
  p_event_id UUID,
  p_worker_id TEXT,
  p_succeeded BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_retry_delay_seconds INT DEFAULT 60
)
RETURNS event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event event_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM event_outbox
  WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.locked_by IS DISTINCT FROM p_worker_id
     OR v_event.lease_expires_at IS NULL
     OR v_event.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'outbox lease is absent, expired, or owned by another worker'
      USING ERRCODE = '55000';
  END IF;

  UPDATE event_outbox
  SET status = CASE
        WHEN p_succeeded THEN 'processed'
        ELSE 'failed'
      END,
      processed_at = CASE WHEN p_succeeded THEN now() ELSE NULL END,
      available_at = CASE WHEN p_succeeded THEN available_at
        ELSE now() + make_interval(secs => greatest(0, p_retry_delay_seconds)) END,
      last_error = CASE WHEN p_succeeded THEN NULL ELSE p_error END,
      error_message = CASE WHEN p_succeeded THEN NULL ELSE p_error END,
      dead_lettered_at = CASE
        WHEN NOT p_succeeded AND attempt_count >= max_attempts THEN now()
        ELSE dead_lettered_at
      END,
      locked_at = NULL, locked_by = NULL, lease_expires_at = NULL
  WHERE id = p_event_id
  RETURNING * INTO v_event;
  RETURN v_event;
END;
$$;

-- RPCs bypass RLS but are callable only by the trusted service role.
REVOKE ALL ON FUNCTION governance_actor_has_capability(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION governance_require_capability(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_claim_case(UUID, UUID, TEXT, TEXT, BIGINT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_heartbeat_case(UUID, UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_release_case(UUID, UUID, UUID, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_transfer_case(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_assign_next_case(UUID, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_reap_expired_leases(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_commit_case_review(UUID, TEXT, TEXT, TEXT, UUID, UUID, INT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION expert_close_case(UUID, TEXT, TEXT, TEXT, UUID, UUID, INT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_event_outbox(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_event_outbox(UUID, TEXT, BOOLEAN, TEXT, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION governance_actor_has_capability(TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION governance_require_capability(TEXT, TEXT, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_claim_case(UUID, UUID, TEXT, TEXT, BIGINT, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_heartbeat_case(UUID, UUID, UUID, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_release_case(UUID, UUID, UUID, TEXT, TEXT, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_transfer_case(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_assign_next_case(UUID, TEXT, TEXT, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_reap_expired_leases(TEXT, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_commit_case_review(UUID, TEXT, TEXT, TEXT, UUID, UUID, INT, JSONB, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION expert_close_case(UUID, TEXT, TEXT, TEXT, UUID, UUID, INT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION claim_event_outbox(TEXT, INT, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION complete_event_outbox(UUID, TEXT, BOOLEAN, TEXT, INT)
  TO service_role;

COMMENT ON FUNCTION expert_claim_case(UUID, UUID, TEXT, TEXT, BIGINT, INT)
  IS 'Atomically claims one expert case and consumes expert capacity.';
COMMENT ON FUNCTION expert_assign_next_case(UUID, TEXT, TEXT, INT)
  IS 'Claims the highest priority eligible queue row using SKIP LOCKED.';
COMMENT ON FUNCTION expert_commit_case_review(UUID, TEXT, TEXT, TEXT, UUID, UUID, INT, JSONB, JSONB)
  IS 'Idempotently commits a case revision, domain event, and optional communication intent.';
COMMENT ON FUNCTION claim_event_outbox(TEXT, INT, INT)
  IS 'Leases available outbox rows using SKIP LOCKED and dead-letters exhausted rows.';
