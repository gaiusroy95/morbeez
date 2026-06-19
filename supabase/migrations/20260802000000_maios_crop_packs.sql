-- MAIOS v12 — crop packs registry + automation job types

CREATE TABLE IF NOT EXISTS crop_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '12.0',
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_type, version)
);

CREATE INDEX IF NOT EXISTS idx_crop_packs_active ON crop_packs (crop_type) WHERE active = TRUE;

ALTER TABLE crop_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY crop_packs_service ON crop_packs FOR ALL USING (true) WITH CHECK (true);

-- Regional learning (Wave 5)
CREATE TABLE IF NOT EXISTS regional_issue_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  issue_label TEXT NOT NULL,
  season TEXT,
  case_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district, crop_type, issue_label, season)
);

CREATE TABLE IF NOT EXISTS regional_protocol_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  issue_label TEXT NOT NULL,
  protocol_key TEXT NOT NULL,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district, crop_type, issue_label, protocol_key)
);

CREATE TABLE IF NOT EXISTS regional_farm_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL UNIQUE,
  crop_type TEXT NOT NULL,
  district TEXT,
  soil_ph_band TEXT,
  water_hardness TEXT,
  common_issue TEXT,
  farm_count INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lab reports (Wave 3)
CREATE TABLE IF NOT EXISTS crm_water_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'field_visit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_leaf_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'lab',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pathogen_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pathogen TEXT,
  metrics JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'lab',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS block_stress_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES farm_blocks(id) ON DELETE CASCADE,
  stress_type TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'field_visit',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_block_stress_flags_block ON block_stress_flags (block_id, captured_at DESC);

-- Knowledge graph (Wave 5)
CREATE TABLE IF NOT EXISTS kg_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (node_type, label)
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  weight NUMERIC(5,4) DEFAULT 1,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges (from_node_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_to ON kg_edges (to_node_id);

-- Gold learning queue (Wave 5)
CREATE TABLE IF NOT EXISTS ml_gold_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_advisory_sessions(id) ON DELETE SET NULL,
  crop_type TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'trained', 'rejected')),
  failure_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend automation job types
ALTER TABLE advisory_automation_jobs DROP CONSTRAINT IF EXISTS advisory_automation_jobs_job_type_check;

ALTER TABLE advisory_automation_jobs ADD CONSTRAINT advisory_automation_jobs_job_type_check
  CHECK (
    job_type IN (
      'follow_up_reminder',
      'callback_reminder',
      'whatsapp_follow_up',
      'seasonal_alert',
      'cultivation_application_prompt',
      'cultivation_result_validation',
      'rec_application_check',
      'rec_application_reminder',
      'rec_outcome_check',
      'rec_outcome_reminder',
      'rec_outcome_no_response',
      'rec_no_response_escalation',
      'visit_monitoring_progression',
      'visit_callback_escalation',
      'ginger_sop_recovery_d3',
      'ginger_sop_recovery_d7',
      'ginger_sop_recovery_d14',
      'maios_recovery_d3',
      'maios_recovery_d7',
      'maios_recovery_d14',
      'maios_proactive_alert',
      'ml_retraining_weekly',
      'ml_retraining_monthly'
    )
  );
