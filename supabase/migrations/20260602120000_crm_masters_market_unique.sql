-- Markets are distinguished by name + district (stored in category).
-- The generic unique index on (master_type, name) blocks two markets with the same name in different districts.

DROP INDEX IF EXISTS idx_crm_masters_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_masters_unique
  ON crm_masters (master_type, lower(name), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE master_type <> 'market';

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_masters_market_unique
  ON crm_masters (master_type, lower(name), lower(COALESCE(category, '')))
  WHERE master_type = 'market';
