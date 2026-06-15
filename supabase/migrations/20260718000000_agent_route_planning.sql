-- Extend route planner for partner agents + pincode-clustered optimization metadata

ALTER TABLE agronomist_routes
  ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'agronomist'
    CHECK (agent_type IN ('agronomist', 'partner')),
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE CASCADE;

ALTER TABLE agronomist_routes ALTER COLUMN agronomist_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_routes_partner_date
  ON agronomist_routes (partner_id, route_date DESC)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_routes_type_email_date
  ON agronomist_routes (agronomist_email, route_date DESC)
  WHERE agent_type = 'agronomist';

COMMENT ON COLUMN agronomist_routes.agent_type IS 'agronomist | partner — field route owner';
COMMENT ON COLUMN agronomist_routes.partner_id IS 'Set when agent_type = partner';
