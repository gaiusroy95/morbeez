-- Phase 0: Farmer + employee opportunity intelligence — event spine, attribution, score snapshots.
-- Engines (Phase 3+) will populate scores; Phase 1 will write farmer_events.

-- ─── Farmer behavioral events ─────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system',
  idempotency_key TEXT,
  reference_type TEXT,
  reference_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT farmer_events_event_type_check CHECK (
    event_type IN (
      'MESSAGE_SENT',
      'MESSAGE_REPLY',
      'IMAGE_UPLOAD',
      'VOICE_NOTE',
      'RECOMMENDATION_APPLIED',
      'FOLLOWUP_COMPLETED',
      'CALLBACK_REQUESTED',
      'SITE_VISIT_ACCEPTED',
      'ROI_ENTRY',
      'SOIL_TEST_UPLOADED',
      'CROP_ASSESSMENT_REQUESTED',
      'RECOMMENDATION_APPROVED',
      'RECOMMENDATION_COMMUNICATED',
      'FARMER_REACTIVATED',
      'ORDER_CONVERTED',
      'ADVISORY_SESSION_COMPLETED',
      'FIELD_FINDING_LOGGED'
    )
  ),
  CONSTRAINT farmer_events_source_check CHECK (
    source IN ('whatsapp', 'crm', 'agronomist', 'shopify', 'roi', 'system', 'field_pwa')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_farmer_events_idempotency
  ON farmer_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_events_farmer_time
  ON farmer_events (farmer_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_farmer_events_employee_time
  ON farmer_events (employee_profile_id, occurred_at DESC)
  WHERE employee_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farmer_events_type_time
  ON farmer_events (event_type, occurred_at DESC);

-- ─── Employee ↔ farmer influence (multi-touch) ─────────────────
CREATE TABLE IF NOT EXISTS employee_farmer_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  attribution_type TEXT NOT NULL,
  employee_role TEXT NOT NULL,
  weight NUMERIC(5, 4) NOT NULL DEFAULT 1.0000
    CHECK (weight >= 0 AND weight <= 1),
  first_touch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_touch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  touch_count INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_farmer_attribution_type_check CHECK (
    attribution_type IN (
      'first_engagement',
      'relationship_owner',
      'telecaller_assigned',
      'advisory',
      'conversion_assist',
      'reactivation'
    )
  ),
  CONSTRAINT employee_farmer_attribution_role_check CHECK (
    employee_role IN ('telecaller', 'agronomist', 'operations', 'manager', 'admin', 'system')
  ),
  CONSTRAINT employee_farmer_attribution_unique UNIQUE (
    farmer_id,
    employee_profile_id,
    attribution_type
  )
);

CREATE INDEX IF NOT EXISTS idx_employee_farmer_attr_farmer
  ON employee_farmer_attribution (farmer_id, active, last_touch_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_farmer_attr_employee
  ON employee_farmer_attribution (employee_profile_id, active, last_touch_at DESC);

-- ─── Farmer opportunity score (current snapshot) ─────────────
CREATE TABLE IF NOT EXISTS farmer_scores (
  farmer_id UUID PRIMARY KEY REFERENCES farmers(id) ON DELETE CASCADE,
  opportunity_score INT NOT NULL DEFAULT 0
    CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  engagement_score INT NOT NULL DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 20),
  trust_score INT NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 15),
  acre_size_score INT NOT NULL DEFAULT 0 CHECK (acre_size_score >= 0 AND acre_size_score <= 15),
  acre_potential_score INT NOT NULL DEFAULT 0 CHECK (acre_potential_score >= 0 AND acre_potential_score <= 20),
  relationship_score INT NOT NULL DEFAULT 0 CHECK (relationship_score >= 0 AND relationship_score <= 10),
  advisory_cooperation_score INT NOT NULL DEFAULT 0
    CHECK (advisory_cooperation_score >= 0 AND advisory_cooperation_score <= 10),
  crop_value_score INT NOT NULL DEFAULT 0 CHECK (crop_value_score >= 0 AND crop_value_score <= 5),
  referral_influence_score INT NOT NULL DEFAULT 0
    CHECK (referral_influence_score >= 0 AND referral_influence_score <= 5),
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine_version TEXT NOT NULL DEFAULT 'v1',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_scores_opportunity
  ON farmer_scores (opportunity_score DESC, calculated_at DESC);

-- ─── Employee performance score (current snapshot) ─────────────
CREATE TABLE IF NOT EXISTS employee_scores (
  employee_profile_id UUID PRIMARY KEY REFERENCES employee_profiles(id) ON DELETE CASCADE,
  performance_score INT NOT NULL DEFAULT 0
    CHECK (performance_score >= 0 AND performance_score <= 100),
  engagement_growth_score INT NOT NULL DEFAULT 0
    CHECK (engagement_growth_score >= 0 AND engagement_growth_score <= 20),
  relationship_quality_score INT NOT NULL DEFAULT 0
    CHECK (relationship_quality_score >= 0 AND relationship_quality_score <= 20),
  retention_quality_score INT NOT NULL DEFAULT 0
    CHECK (retention_quality_score >= 0 AND retention_quality_score <= 15),
  trust_building_score INT NOT NULL DEFAULT 0
    CHECK (trust_building_score >= 0 AND trust_building_score <= 15),
  delayed_conversion_score INT NOT NULL DEFAULT 0
    CHECK (delayed_conversion_score >= 0 AND delayed_conversion_score <= 10),
  farmer_reactivation_score INT NOT NULL DEFAULT 0
    CHECK (farmer_reactivation_score >= 0 AND farmer_reactivation_score <= 10),
  knowledge_contribution_score INT NOT NULL DEFAULT 0
    CHECK (knowledge_contribution_score >= 0 AND knowledge_contribution_score <= 5),
  farmer_satisfaction_score INT NOT NULL DEFAULT 0
    CHECK (farmer_satisfaction_score >= 0 AND farmer_satisfaction_score <= 5),
  attributed_farmer_count INT NOT NULL DEFAULT 0,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine_version TEXT NOT NULL DEFAULT 'v1',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_scores_performance
  ON employee_scores (performance_score DESC, calculated_at DESC);

-- ─── Score history (trends / audit) ──────────────────────────
CREATE TABLE IF NOT EXISTS farmer_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  opportunity_score INT NOT NULL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine_version TEXT NOT NULL DEFAULT 'v1',
  period_days INT NOT NULL DEFAULT 30,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_score_history_farmer
  ON farmer_score_history (farmer_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS employee_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  performance_score INT NOT NULL CHECK (performance_score >= 0 AND performance_score <= 100),
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine_version TEXT NOT NULL DEFAULT 'v1',
  period_days INT NOT NULL DEFAULT 30,
  attributed_farmer_count INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_score_history_employee
  ON employee_score_history (employee_profile_id, calculated_at DESC);

-- ─── Retention risk snapshots ──────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_retention_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  risk_band TEXT NOT NULL DEFAULT 'stable'
    CHECK (risk_band IN ('healthy', 'watch', 'at_risk', 'churned')),
  retention_score INT NOT NULL DEFAULT 50
    CHECK (retention_score >= 0 AND retention_score <= 100),
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  days_since_last_inbound INT,
  interaction_trend TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT farmer_retention_tracking_farmer_unique UNIQUE (farmer_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_retention_risk
  ON farmer_retention_tracking (risk_band, calculated_at DESC);

-- ─── Recommendation milestones (for trust / delayed conversion) ─
CREATE TABLE IF NOT EXISTS recommendation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_record_id UUID NOT NULL REFERENCES recommendation_records(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  milestone TEXT NOT NULL,
  outcome TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recommendation_history_milestone_check CHECK (
    milestone IN (
      'created',
      'submitted',
      'approved',
      'rejected',
      'communicated',
      'outcome_recorded',
      'farmer_feedback'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_farmer
  ON recommendation_history (farmer_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_rec
  ON recommendation_history (recommendation_record_id, occurred_at DESC);

-- ─── Dimension history (engagement / trust over time) ─────────
CREATE TABLE IF NOT EXISTS farmer_metric_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  metric_dimension TEXT NOT NULL,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  max_weight INT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT farmer_metric_history_dimension_check CHECK (
    metric_dimension IN ('engagement', 'trust', 'relationship', 'retention')
  )
);

CREATE INDEX IF NOT EXISTS idx_farmer_metric_history_farmer_dim
  ON farmer_metric_history (farmer_id, metric_dimension, calculated_at DESC);

-- RLS: API uses service role
ALTER TABLE farmer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_farmer_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_retention_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_metric_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY farmer_events_service ON farmer_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY employee_farmer_attribution_service ON employee_farmer_attribution
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_scores_service ON farmer_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY employee_scores_service ON employee_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_score_history_service ON farmer_score_history
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY employee_score_history_service ON employee_score_history
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_retention_tracking_service ON farmer_retention_tracking
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY recommendation_history_service ON recommendation_history
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_metric_history_service ON farmer_metric_history
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE farmer_events IS
  'Canonical farmer behavioral events for opportunity + employee intelligence (auto-captured, Phase 1+).';
COMMENT ON TABLE employee_farmer_attribution IS
  'Multi-touch employee influence on a farmer (telecaller + agronomist + delayed conversion credit).';
COMMENT ON TABLE farmer_scores IS
  'Current farmer opportunity score 0–100 and weighted components (system-calculated).';
COMMENT ON TABLE employee_scores IS
  'Current employee relationship performance 0–100 (not sales-only; system-calculated).';
