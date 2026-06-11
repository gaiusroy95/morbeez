-- Agronomist mobile: visit sessions + route planner

CREATE TABLE IF NOT EXISTS agronomist_visit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  agronomist_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_at TIMESTAMPTZ,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  duration_minutes INT,
  field_finding_id UUID REFERENCES crm_field_findings(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agronomist_visit_sessions_agent
  ON agronomist_visit_sessions (agronomist_email, status, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_agronomist_visit_sessions_farmer
  ON agronomist_visit_sessions (farmer_id, check_in_at DESC);

CREATE TABLE IF NOT EXISTS agronomist_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agronomist_email TEXT NOT NULL,
  route_name TEXT NOT NULL,
  route_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  estimated_distance_km DOUBLE PRECISION,
  estimated_hours DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agronomist_routes_agent_date
  ON agronomist_routes (agronomist_email, route_date DESC);

CREATE TABLE IF NOT EXISTS agronomist_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES agronomist_routes(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES farm_blocks(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 0,
  estimated_distance_km DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agronomist_route_stops_route
  ON agronomist_route_stops (route_id, sort_order);

ALTER TABLE agronomist_visit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agronomist_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agronomist_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY agronomist_visit_sessions_service ON agronomist_visit_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY agronomist_routes_service ON agronomist_routes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY agronomist_route_stops_service ON agronomist_route_stops FOR ALL USING (true) WITH CHECK (true);
