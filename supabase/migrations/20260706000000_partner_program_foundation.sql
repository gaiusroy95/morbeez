-- Morbeez Partner Program — foundation (ownership, partner domain, operations, intelligence)

-- ─── Farmer ownership (canonical) ───────────────────────────
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS enrollment_owner_type TEXT
    CHECK (enrollment_owner_type IS NULL OR enrollment_owner_type IN ('partner', 'morbeez', 'referral', 'campaign')),
  ADD COLUMN IF NOT EXISTS enrollment_owner_partner_id UUID,
  ADD COLUMN IF NOT EXISTS enrollment_source TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_event_id UUID,
  ADD COLUMN IF NOT EXISTS customer_owner_type TEXT
    CHECK (customer_owner_type IS NULL OR customer_owner_type IN ('partner', 'morbeez')),
  ADD COLUMN IF NOT EXISTS customer_owner_partner_id UUID,
  ADD COLUMN IF NOT EXISTS service_model TEXT
    CHECK (service_model IS NULL OR service_model IN ('remote_advisory', 'partner_assisted')),
  ADD COLUMN IF NOT EXISTS assigned_partner_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_telecaller_email TEXT,
  ADD COLUMN IF NOT EXISTS assigned_expert_email TEXT,
  ADD COLUMN IF NOT EXISTS partner_code_at_enrollment TEXT;

CREATE INDEX IF NOT EXISTS idx_farmers_enrollment_partner
  ON farmers(enrollment_owner_partner_id)
  WHERE enrollment_owner_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farmers_customer_owner_partner
  ON farmers(customer_owner_partner_id)
  WHERE customer_owner_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farmers_assigned_partner
  ON farmers(assigned_partner_id)
  WHERE assigned_partner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS farmer_ownership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  customer_owner_type TEXT NOT NULL CHECK (customer_owner_type IN ('partner', 'morbeez')),
  customer_owner_partner_id UUID,
  service_model TEXT CHECK (service_model IN ('remote_advisory', 'partner_assisted')),
  assigned_partner_id UUID,
  reason TEXT NOT NULL,
  changed_by TEXT,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farmer_ownership_history_farmer
  ON farmer_ownership_history(farmer_id, effective_at DESC);

-- Backfill legacy farmers
UPDATE farmers
SET
  enrollment_owner_type = COALESCE(enrollment_owner_type, 'morbeez'),
  customer_owner_type = COALESCE(customer_owner_type, 'morbeez'),
  service_model = COALESCE(service_model, 'remote_advisory')
WHERE enrollment_owner_type IS NULL OR customer_owner_type IS NULL;

-- ─── Partner domain ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied', 'verified', 'training', 'certified', 'active', 'suspended', 'inactive')),
  tier TEXT NOT NULL DEFAULT 'associate'
    CHECK (tier IN ('associate', 'certified', 'senior', 'master')),
  state TEXT,
  district TEXT,
  taluk TEXT,
  village TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  crops_expertise TEXT[] NOT NULL DEFAULT '{}',
  referral_slug TEXT UNIQUE,
  qr_token TEXT UNIQUE,
  max_active_farmers INT NOT NULL DEFAULT 50,
  current_active_farmers INT NOT NULL DEFAULT 0,
  reliability_score NUMERIC(5, 2) NOT NULL DEFAULT 70,
  performance_score NUMERIC(5, 2) NOT NULL DEFAULT 50,
  lead_allocation_weight NUMERIC(5, 2) NOT NULL DEFAULT 1,
  commission_eligible BOOLEAN NOT NULL DEFAULT true,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  certified_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_phone ON partners(phone);
CREATE INDEX IF NOT EXISTS idx_partners_status_tier ON partners(status, tier);

ALTER TABLE farmers
  ADD CONSTRAINT farmers_enrollment_owner_partner_fk
    FOREIGN KEY (enrollment_owner_partner_id) REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE farmers
  ADD CONSTRAINT farmers_customer_owner_partner_fk
    FOREIGN KEY (customer_owner_partner_id) REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE farmers
  ADD CONSTRAINT farmers_assigned_partner_fk
    FOREIGN KEY (assigned_partner_id) REFERENCES partners(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  state TEXT,
  district TEXT,
  village TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  experience_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status
  ON partner_applications(status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_program_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO partner_program_settings (setting_key, setting_value, description)
VALUES
  ('registration_requirements', '{"minAge":18,"documentsRequired":["id_proof"]}', 'Partner registration requirements'),
  ('training_requirements', '{"modulesRequired":3,"minQuizScore":70}', 'Training before certification'),
  ('certification_requirements', '{"fieldVisitShadow":1}', 'Certification checklist'),
  ('tier_thresholds', '{"certified":{"reliability":75,"farmers":10},"senior":{"reliability":85,"farmers":50},"master":{"reliability":90,"farmers":150}}', 'Tier promotion thresholds'),
  ('lead_allocation', '{"weights":{"reliability":0.25,"performance":0.2,"capacity":0.15,"tier":0.2,"dataQuality":0.1,"retention":0.1},"explorationFloorPct":5,"newPartnerDays":90}', 'Lead allocation engine weights'),
  ('customer_owner_rules', '{"suspendPartnerRevertsToMorbeez":true,"reliabilitySuspendThreshold":40}', 'Customer owner transition rules')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS partner_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_status_history_partner
  ON partner_status_history(partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_otp_phone ON partner_otp_challenges(phone, created_at DESC);

-- ─── Partner attribution ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_farmer_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  attribution_type TEXT NOT NULL
    CHECK (attribution_type IN ('enrollment', 'visit', 'meeting', 'soil_collection', 'conversion_assist', 'reactivation')),
  weight NUMERIC(4, 3) NOT NULL DEFAULT 1,
  first_touch_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_touch_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  touch_count INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (farmer_id, partner_id, attribution_type)
);

CREATE INDEX IF NOT EXISTS idx_partner_farmer_attribution_partner
  ON partner_farmer_attribution(partner_id, active, last_touch_at DESC);

-- ─── Field operations extensions ──────────────────────────────
ALTER TABLE crm_field_findings
  ADD COLUMN IF NOT EXISTS submitted_by_role TEXT NOT NULL DEFAULT 'agronomist'
    CHECK (submitted_by_role IN ('agronomist', 'partner')),
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_field_findings_partner
  ON crm_field_findings(partner_id, created_at DESC)
  WHERE partner_id IS NOT NULL;

ALTER TABLE agronomist_visit_sessions
  ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'agronomist'
    CHECK (agent_type IN ('agronomist', 'partner')),
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

ALTER TABLE agronomist_visit_sessions
  ALTER COLUMN agronomist_email DROP NOT NULL;

ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS assigned_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_partner
  ON crm_tasks(assigned_partner_id, status, due_at)
  WHERE assigned_partner_id IS NOT NULL;

-- Ensure agronomist CRM task columns exist (remote may not have 20260650000000 applied)
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS assigned_agronomist TEXT;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS issue_description TEXT;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS task_category TEXT NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_crm_tasks_agronomist
  ON crm_tasks(assigned_agronomist, status, due_at)
  WHERE assigned_agronomist IS NOT NULL;

ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_priority_check;
ALTER TABLE crm_tasks ADD CONSTRAINT crm_tasks_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Extend task_category check (drop and recreate — includes partner task types)
ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_task_category_check;
ALTER TABLE crm_tasks ADD CONSTRAINT crm_tasks_task_category_check
  CHECK (task_category IN (
    'call_farmer', 'visit_request', 'recommendation', 'soil_test_review', 'disease_review',
    'soil_collection', 'farmer_meeting', 'photo_verification', 'complaint_investigation', 'partner_training', 'other'
  ));

CREATE TABLE IF NOT EXISTS crm_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES crm_tasks(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'telecaller',
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_task_comments_task
  ON crm_task_comments(task_id, created_at ASC);

ALTER TABLE crm_task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_task_comments_service_role ON crm_task_comments;
CREATE POLICY crm_task_comments_service_role ON crm_task_comments
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE crm_task_comments DROP CONSTRAINT IF EXISTS crm_task_comments_author_role_check;
ALTER TABLE crm_task_comments ADD CONSTRAINT crm_task_comments_author_role_check
  CHECK (author_role IN ('telecaller', 'agronomist', 'partner', 'expert', 'admin', 'system'));

ALTER TABLE crm_task_comments
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'comment';

ALTER TABLE crm_task_comments DROP CONSTRAINT IF EXISTS crm_task_comments_entry_type_check;
ALTER TABLE crm_task_comments ADD CONSTRAINT crm_task_comments_entry_type_check
  CHECK (entry_type IN ('comment', 'note', 'escalation', 'support_request', 'review_request'));

-- ─── Farmer timeline ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  task_id UUID REFERENCES crm_tasks(id) ON DELETE SET NULL,
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('telecaller', 'partner', 'expert', 'admin', 'system')),
  author_email TEXT,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  author_name TEXT,
  entry_type TEXT NOT NULL DEFAULT 'note'
    CHECK (entry_type IN ('note', 'comment', 'escalation', 'support_request', 'review_request')),
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farmer_timeline_entries_farmer
  ON farmer_timeline_entries(farmer_id, created_at DESC);

-- ─── Reliability & KPI ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_reliability_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL
    CHECK (signal_type IN (
      'gps_compliant', 'gps_missing', 'visit_authentic', 'photo_quality_ok', 'photo_quality_low',
      'data_complete', 'data_incomplete', 'complaint', 'late_checkout', 'response_slow', 'fraud_flag'
    )),
  signal_value NUMERIC(6, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_reliability_signals_partner
  ON partner_reliability_signals(partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_reliability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_reliability_scores_partner
  ON partner_reliability_scores(partner_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS partner_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  farmer_growth INT NOT NULL DEFAULT 0,
  farmer_retention_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  visit_completion_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  data_quality_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  recommendation_success_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  revenue_influence_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  lead_generation_count INT NOT NULL DEFAULT 0,
  reliability_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS partner_lead_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  allocation_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered', 'accepted', 'declined', 'expired', 'completed')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_lead_allocations_partner
  ON partner_lead_allocations(partner_id, status, offered_at DESC);

-- ─── RBAC module ──────────────────────────────────────────────
INSERT INTO role_module_permissions (role, module_key, can_read, can_write)
VALUES
  ('super_admin', 'partner_program', true, true),
  ('admin', 'partner_program', true, true),
  ('manager', 'partner_program', true, true),
  ('operations', 'partner_program', true, false),
  ('viewer', 'partner_program', true, false)
ON CONFLICT (role, module_key) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write;

-- RLS (service role access)
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_farmer_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_reliability_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_reliability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_lead_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY partners_service ON partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_applications_service ON partner_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_program_settings_service ON partner_program_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_status_history_service ON partner_status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_otp_challenges_service ON partner_otp_challenges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_farmer_attribution_service ON partner_farmer_attribution FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_ownership_history_service ON farmer_ownership_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_timeline_entries_service ON farmer_timeline_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_reliability_signals_service ON partner_reliability_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_reliability_scores_service ON partner_reliability_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_kpi_snapshots_service ON partner_kpi_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY partner_lead_allocations_service ON partner_lead_allocations FOR ALL USING (true) WITH CHECK (true);
