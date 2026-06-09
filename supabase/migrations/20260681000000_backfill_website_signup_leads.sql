-- Farmers who registered on the website but had no telecaller lead (old skip-if-phone-exists logic)
INSERT INTO leads (
  farmer_id,
  intent,
  source,
  status,
  stage,
  priority,
  notes,
  last_interaction_at,
  created_at,
  updated_at
)
SELECT
  f.id,
  'general',
  'shopify',
  'new',
  'new_lead',
  'normal',
  'Registered on Morbeez Shopify website (backfill)',
  COALESCE(f.last_login_at, f.created_at, NOW()),
  COALESCE(f.created_at, NOW()),
  NOW()
FROM farmers f
WHERE f.phone IS NOT NULL
  AND (
    f.source IN ('website', 'shopify')
    OR f.password_hash IS NOT NULL
    OR f.email IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM leads l WHERE l.farmer_id = f.id
  );
