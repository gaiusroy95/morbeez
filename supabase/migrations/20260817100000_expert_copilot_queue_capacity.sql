-- Expert Copilot queue, specialties, capacity, notifications

CREATE TABLE IF NOT EXISTS expert_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL,
  specialty_type TEXT NOT NULL
    CHECK (specialty_type IN ('crop', 'disease', 'language', 'geography', 'channel')),
  specialty_key TEXT NOT NULL,
  proficiency SMALLINT NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_profile_id, specialty_type, specialty_key)
);

CREATE TABLE IF NOT EXISTS expert_capacity_state (
  employee_profile_id UUID PRIMARY KEY,
  employee_email TEXT NOT NULL,
  availability TEXT NOT NULL DEFAULT 'accepting'
    CHECK (availability IN ('accepting', 'paused', 'draining', 'offline')),
  max_active_cases SMALLINT NOT NULL DEFAULT 8,
  max_active_weight NUMERIC(5,2) NOT NULL DEFAULT 10,
  active_case_count SMALLINT NOT NULL DEFAULT 0,
  active_weight NUMERIC(5,2) NOT NULL DEFAULT 0,
  paused_at TIMESTAMPTZ,
  paused_until TIMESTAMPTZ,
  pause_reason TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  shift_start TIME,
  shift_end TIME,
  last_seen_at TIMESTAMPTZ,
  last_assigned_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_capacity_email
  ON expert_capacity_state (lower(employee_email));

CREATE TABLE IF NOT EXISTS expert_queue_requirements (
  escalation_id UUID,
  case_id UUID REFERENCES expert_cases(id) ON DELETE CASCADE,
  specialty_type TEXT NOT NULL,
  specialty_key TEXT NOT NULL,
  minimum_proficiency SMALLINT NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_queue_requirements_case
  ON expert_queue_requirements (case_id);

CREATE TABLE IF NOT EXISTS expert_queue_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type TEXT NOT NULL DEFAULT 'expert_review',
  priority TEXT NOT NULL DEFAULT 'normal',
  response_sla_minutes INT NOT NULL DEFAULT 240,
  offer_timeout_minutes INT NOT NULL DEFAULT 10,
  desk_lease_minutes INT NOT NULL DEFAULT 30,
  field_lease_minutes INT NOT NULL DEFAULT 240,
  base_weight NUMERIC(4,2) NOT NULL DEFAULT 1,
  max_requeues INT NOT NULL DEFAULT 5,
  max_interruptions INT NOT NULL DEFAULT 2,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (case_type, priority)
);

INSERT INTO expert_queue_policies (case_type, priority, response_sla_minutes, offer_timeout_minutes, base_weight)
VALUES
  ('expert_review', 'urgent', 30, 5, 2.0),
  ('expert_review', 'high', 120, 10, 1.5),
  ('expert_review', 'normal', 240, 10, 1.0),
  ('expert_review', 'low', 480, 15, 0.5)
ON CONFLICT (case_type, priority) DO NOTHING;

CREATE TABLE IF NOT EXISTS expert_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  assignment_version BIGINT NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  from_employee_profile_id UUID,
  to_employee_profile_id UUID,
  from_owner_email TEXT,
  to_owner_email TEXT,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  reason_code TEXT,
  reason_text TEXT,
  score_snapshot JSONB NOT NULL DEFAULT '{}',
  capacity_snapshot JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_assignment_events_case
  ON expert_assignment_events (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_profile_id UUID,
  category TEXT NOT NULL DEFAULT 'assignment',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  case_id UUID REFERENCES expert_cases(id) ON DELETE SET NULL,
  deep_link TEXT,
  dedupe_key TEXT UNIQUE,
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_recipient
  ON staff_notifications (lower(recipient_email), created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE expert_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_capacity_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_queue_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_queue_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_assignment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY expert_specialties_service ON expert_specialties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_capacity_state_service ON expert_capacity_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_queue_requirements_service ON expert_queue_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_queue_policies_service ON expert_queue_policies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY expert_assignment_events_service ON expert_assignment_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY staff_notifications_service ON staff_notifications FOR ALL USING (true) WITH CHECK (true);
