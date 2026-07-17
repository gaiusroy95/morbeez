-- Expert Copilot chat, safety decisions, operational commits, learning governance, audit

CREATE TABLE IF NOT EXISTS expert_case_chat_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  turn_index INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agronomist', 'assistant', 'system', 'farmer')),
  content TEXT NOT NULL,
  actor_email TEXT,
  lease_token UUID,
  base_revision INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, turn_index)
);

CREATE TABLE IF NOT EXISTS expert_case_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  chat_turn_id UUID REFERENCES expert_case_chat_turns(id) ON DELETE SET NULL,
  proposal_json JSONB NOT NULL DEFAULT '{}',
  clarification_json JSONB,
  unresolved_json JSONB,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'partially_applied', 'applied', 'rejected', 'superseded')),
  base_revision INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_gate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  recommendation_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'v1',
  decision TEXT NOT NULL
    CHECK (decision IN ('PASS', 'UNRESOLVED', 'REJECT', 'OVERRIDDEN')),
  blockers JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]',
  compatibility_report JSONB,
  maios_report JSONB,
  input_snapshot JSONB NOT NULL DEFAULT '{}',
  confirmed_by TEXT,
  override_reason TEXT,
  override_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_gate_aggregate
  ON safety_gate_decisions (aggregate_type, aggregate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operation_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  actor_role TEXT,
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'succeeded', 'failed', 'replayed')),
  aggregate_type TEXT,
  aggregate_id UUID,
  response_json JSONB,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS domain_event_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID REFERENCES operation_commands(id) ON DELETE SET NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  sequence BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  actor_email TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id, sequence)
);

CREATE TABLE IF NOT EXISTS communication_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  purpose TEXT NOT NULL DEFAULT 'recommendation',
  content_version INT NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  recipient_snapshot JSONB NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled', 'reconciled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id, channel, purpose, content_version)
);

CREATE TABLE IF NOT EXISTS communication_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES communication_intents(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  provider_idempotency_key TEXT,
  provider_message_id TEXT,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (intent_id, attempt_number)
);

ALTER TABLE event_outbox
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS learning_evidence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  source_surface TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  actor_email TEXT,
  actor_role TEXT,
  farmer_id UUID,
  block_id UUID,
  session_id UUID,
  recommendation_id UUID,
  case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version TEXT NOT NULL DEFAULT 'v1',
  payload JSONB NOT NULL DEFAULT '{}',
  evidence_refs JSONB NOT NULL DEFAULT '[]',
  consent_scope TEXT,
  request_id TEXT,
  idempotency_key TEXT UNIQUE,
  payload_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_type TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'regional',
  payload JSONB NOT NULL DEFAULT '{}',
  source_event_ids UUID[] NOT NULL DEFAULT '{}',
  case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  proposed_by TEXT NOT NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  risk_class TEXT NOT NULL DEFAULT 'standard'
    CHECK (risk_class IN ('standard', 'high', 'critical')),
  consent_eligible BOOLEAN NOT NULL DEFAULT true,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'submitted', 'needs_evidence', 'accepted', 'rejected', 'withdrawn', 'quarantined'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_candidates_dedupe
  ON knowledge_candidates (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('submitted', 'needs_evidence');

CREATE TABLE IF NOT EXISTS knowledge_candidate_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES knowledge_candidates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'secondary',
  verdict TEXT NOT NULL CHECK (verdict IN ('approve', 'reject', 'needs_evidence')),
  reviewer_email TEXT NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, stage, reviewer_email)
);

CREATE TABLE IF NOT EXISTS knowledge_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_kind TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (knowledge_kind, claim_key)
);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_records(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  source_candidate_id UUID REFERENCES knowledge_candidates(id) ON DELETE SET NULL,
  authored_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (knowledge_id, version_number)
);

CREATE TABLE IF NOT EXISTS knowledge_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_records(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'governed',
  scope TEXT NOT NULL DEFAULT 'global',
  active_version_id UUID REFERENCES knowledge_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (knowledge_id, channel, scope)
);

CREATE TABLE IF NOT EXISTS knowledge_publication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES knowledge_publications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('publish', 'supersede', 'withdraw', 'restore', 'emergency_disable')),
  from_version_id UUID,
  to_version_id UUID,
  actor_email TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reuse_memory_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES knowledge_publications(id) ON DELETE SET NULL,
  approved_version_id UUID REFERENCES knowledge_versions(id) ON DELETE SET NULL,
  crop_type TEXT,
  district TEXT,
  dap_bucket TEXT,
  symptom_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  staff_verified BOOLEAN NOT NULL DEFAULT true,
  disabled BOOLEAN NOT NULL DEFAULT false,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reuse_memory_lookup
  ON reuse_memory_index (crop_type, district, symptom_key)
  WHERE disabled = false;

CREATE TABLE IF NOT EXISTS governance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGINT NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  actor_email TEXT,
  actor_role TEXT,
  request_id TEXT,
  command TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_version TEXT,
  before_hash TEXT,
  after_hash TEXT,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_audit_sequence
  ON governance_audit_events (sequence);

CREATE TABLE IF NOT EXISTS reviewer_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_email TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  detail JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviewer_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_email TEXT NOT NULL,
  restriction_type TEXT NOT NULL DEFAULT 'freeze_approvals',
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at TIMESTAMPTZ
);

-- Append-only guard for governance audit
CREATE OR REPLACE FUNCTION prevent_governance_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'governance_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_governance_audit_no_update ON governance_audit_events;
CREATE TRIGGER trg_governance_audit_no_update
  BEFORE UPDATE OR DELETE ON governance_audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_governance_audit_mutation();

ALTER TABLE expert_case_chat_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_case_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_gate_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_event_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_candidate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuse_memory_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY expert_case_chat_turns_service ON expert_case_chat_turns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_case_extractions_service ON expert_case_extractions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY safety_gate_decisions_service ON safety_gate_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY operation_commands_service ON operation_commands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY domain_event_ledger_service ON domain_event_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY communication_intents_service ON communication_intents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY communication_attempts_service ON communication_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY learning_evidence_events_service ON learning_evidence_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY knowledge_candidates_service ON knowledge_candidates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY knowledge_candidate_reviews_service ON knowledge_candidate_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY knowledge_records_service ON knowledge_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY knowledge_versions_service ON knowledge_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY knowledge_publications_service ON knowledge_publications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY knowledge_publication_events_service ON knowledge_publication_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY reuse_memory_index_service ON reuse_memory_index FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY governance_audit_events_service ON governance_audit_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY reviewer_risk_signals_service ON reviewer_risk_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY reviewer_restrictions_service ON reviewer_restrictions FOR ALL USING (true) WITH CHECK (true);
