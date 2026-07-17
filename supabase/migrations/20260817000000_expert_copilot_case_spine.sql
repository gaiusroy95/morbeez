-- Expert Copilot Domain 3: canonical case spine (additive, feature-flagged in app)

CREATE TABLE IF NOT EXISTS expert_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key TEXT NOT NULL,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  crop_type TEXT,
  primary_issue_label TEXT,
  open_fingerprint TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'intake'
    CHECK (status IN (
      'intake', 'under_review', 'awaiting_farmer', 'awaiting_capacity',
      'ready_to_close', 'closed', 'merged'
    )),
  review_flag TEXT NOT NULL DEFAULT 'open'
    CHECK (review_flag IN ('open', 'awaiting_capacity', 'closed')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  priority_tier TEXT NOT NULL DEFAULT 'standard'
    CHECK (priority_tier IN ('emergency', 'sla_risk', 'standard')),
  priority_score NUMERIC NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  sla_started_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  sla_breached_at TIMESTAMPTZ,
  sla_paused_at TIMESTAMPTZ,
  owner_employee_id UUID,
  owner_email TEXT,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  assignment_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (assignment_status IN (
      'queued', 'offered', 'accepted', 'working', 'waiting_external',
      'completed', 'intervention_required'
    )),
  queue_route TEXT NOT NULL DEFAULT 'desk'
    CHECK (queue_route IN ('desk', 'field')),
  queue_weight NUMERIC(4,2) NOT NULL DEFAULT 1,
  queue_version BIGINT NOT NULL DEFAULT 0,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_assigned_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  requeue_count INT NOT NULL DEFAULT 0,
  interruption_count INT NOT NULL DEFAULT 0,
  last_interruption_reason TEXT,
  next_assignment_at TIMESTAMPTZ,
  manual_intervention_at TIMESTAMPTZ,
  current_revision INT NOT NULL DEFAULT 0,
  pending_draft_revision INT,
  merged_into_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  parent_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  recurrence_of_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  close_summary JSONB,
  confidence_at_open NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_cases_open_fingerprint
  ON expert_cases (farmer_id, COALESCE(block_id, '00000000-0000-0000-0000-000000000000'::uuid), open_fingerprint)
  WHERE review_flag = 'open' AND merged_into_case_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expert_cases_queue
  ON expert_cases (assignment_status, next_assignment_at, sla_due_at, priority_tier, queued_at)
  WHERE review_flag = 'open' AND merged_into_case_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expert_cases_owner
  ON expert_cases (owner_email, assignment_status, lease_expires_at)
  WHERE review_flag = 'open';

CREATE INDEX IF NOT EXISTS idx_expert_cases_farmer
  ON expert_cases (farmer_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS expert_case_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  revision INT NOT NULL,
  source TEXT NOT NULL
    CHECK (source IN (
      'farmer_message', 'photo', 'visit', 'advisory_session',
      'expert_draft', 'system_merge', 'site_visit', 'follow_up'
    )),
  payload JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, revision)
);

CREATE TABLE IF NOT EXISTS expert_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL
    CHECK (link_type IN (
      'escalation', 'advisory_session', 'visit_ai_case', 'field_finding',
      'visit_issue', 'recommendation', 'callback'
    )),
  entity_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  merged_from_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (link_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_expert_case_links_case
  ON expert_case_links (case_id, link_type);

CREATE TABLE IF NOT EXISTS expert_case_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  base_revision INT NOT NULL,
  draft_revision INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded', 'safety_rejected')),
  owner_email TEXT NOT NULL,
  draft_json JSONB NOT NULL DEFAULT '{}',
  safety_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_case_drafts_pending
  ON expert_case_drafts (case_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS expert_case_ownership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'claimed', 'renewed', 'transferred', 'released', 'timed_out',
      'requeued', 'senior_escalated', 'offered', 'accepted', 'started'
    )),
  from_owner_email TEXT,
  to_owner_email TEXT,
  from_employee_id UUID,
  to_employee_id UUID,
  lease_token UUID,
  reason TEXT,
  actor_email TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_case_ownership_case
  ON expert_case_ownership_events (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS expert_case_merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  absorbed_case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL
    CHECK (trigger IN ('duplicate_escalation', 'farmer_followup', 'manual')),
  actor_email TEXT,
  absorbed_links JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agronomist_escalations
  ADD COLUMN IF NOT EXISTS expert_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expert_link_role TEXT;

ALTER TABLE recommendation_records
  ADD COLUMN IF NOT EXISTS expert_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL;

ALTER TABLE crm_field_findings
  ADD COLUMN IF NOT EXISTS expert_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'visit_ai_cases'
  ) THEN
    ALTER TABLE visit_ai_cases
      ADD COLUMN IF NOT EXISTS expert_case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agronomist_escalations_expert_case
  ON agronomist_escalations (expert_case_id)
  WHERE expert_case_id IS NOT NULL;

ALTER TABLE expert_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_case_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_case_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_case_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_case_ownership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_case_merge_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY expert_cases_service ON expert_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_case_revisions_service ON expert_case_revisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_case_links_service ON expert_case_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_case_drafts_service ON expert_case_drafts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_case_ownership_events_service ON expert_case_ownership_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_case_merge_events_service ON expert_case_merge_events FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE expert_cases IS 'Expert Copilot Domain 3 canonical case — one open review owner per fingerprint';
