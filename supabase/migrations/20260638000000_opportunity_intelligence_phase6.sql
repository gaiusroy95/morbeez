-- Phase 6: Opportunity intelligence refinement — alerts, config, action queue.

CREATE TABLE IF NOT EXISTS opportunity_intelligence_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  farmer_weight_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  employee_weight_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_thresholds JSONB NOT NULL DEFAULT '{
    "highOpportunityMin": 70,
    "autoCreateCrmTasks": true,
    "employeeAtRiskCohortPct": 0.35
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT INTO opportunity_intelligence_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS opportunity_intelligence_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT opportunity_alerts_type_check CHECK (
    alert_type IN (
      'farmer_at_risk',
      'farmer_churned',
      'high_opportunity_idle',
      'employee_at_risk_cohort'
    )
  ),
  CONSTRAINT opportunity_alerts_severity_check CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT opportunity_alerts_status_check CHECK (
    status IN ('open', 'acknowledged', 'resolved', 'dismissed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_alerts_idempotency
  ON opportunity_intelligence_alerts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_alerts_status_created
  ON opportunity_intelligence_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_alerts_farmer
  ON opportunity_intelligence_alerts (farmer_id, created_at DESC)
  WHERE farmer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_alerts_employee
  ON opportunity_intelligence_alerts (employee_profile_id, created_at DESC)
  WHERE employee_profile_id IS NOT NULL;

ALTER TABLE opportunity_intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_intelligence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY opportunity_intelligence_config_service ON opportunity_intelligence_config
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY opportunity_intelligence_alerts_service ON opportunity_intelligence_alerts
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE opportunity_intelligence_config IS
  'Phase 6: calibrated weight overrides and alert thresholds (singleton default row).';
COMMENT ON TABLE opportunity_intelligence_alerts IS
  'Phase 6: actionable alerts from retention/opportunity signals.';
