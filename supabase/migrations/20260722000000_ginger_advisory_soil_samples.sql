-- Ginger advisory workflow — sample farmer, blocks, and soil lab reports (3 QA scenarios)
-- Safe to re-run: uses fixed UUIDs + ON CONFLICT upsert

INSERT INTO farmers (id, phone, name, preferred_language, district, state, village, source)
VALUES (
  'e0000000-0000-4000-8000-000000000001',
  '+919876543210',
  'Ginger Advisory Demo',
  'en',
  'Wayanad',
  'Kerala',
  'Sulthan Bathery',
  'advisory_sample'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  district = EXCLUDED.district,
  village = EXCLUDED.village,
  source = EXCLUDED.source;

INSERT INTO farm_blocks (
  id, farmer_id, name, crop_name, crop_type, plot_label,
  planting_date, variety_name, irrigation_type, acreage_decimal, is_primary, stage
)
VALUES
  (
    'e0000000-0000-4000-8000-000000000011',
    'e0000000-0000-4000-8000-000000000001',
    'Ginger S1 — Rhizome Rot',
    'Ginger',
    'ginger',
    'Plot A — 90 DAS',
    (CURRENT_DATE - INTERVAL '90 days')::date,
    'Varada',
    'drip',
    0.75,
    false,
    'Vegetative'
  ),
  (
    'e0000000-0000-4000-8000-000000000012',
    'e0000000-0000-4000-8000-000000000001',
    'Ginger S2 — K/Mg Deficiency',
    'Ginger',
    'ginger',
    'Plot B — Rhizome dev',
    (CURRENT_DATE - INTERVAL '150 days')::date,
    'Varada',
    'sprinkler',
    1.0,
    false,
    'Rhizome Development'
  ),
  (
    'e0000000-0000-4000-8000-000000000013',
    'e0000000-0000-4000-8000-000000000001',
    'Ginger S3 — Waterlogging E2E',
    'Ginger',
    'ginger',
    'Plot C — 120 DAS low lying',
    (CURRENT_DATE - INTERVAL '120 days')::date,
    'Varada',
    'flood',
    1.25,
    true,
    'Vegetative'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  plot_label = EXCLUDED.plot_label,
  planting_date = EXCLUDED.planting_date,
  variety_name = EXCLUDED.variety_name,
  irrigation_type = EXCLUDED.irrigation_type,
  acreage_decimal = EXCLUDED.acreage_decimal,
  stage = EXCLUDED.stage;

-- Scenario 1 — Rhizome Rot Risk
INSERT INTO crm_soil_reports (id, farmer_id, block_id, reported_at, metrics, uploaded_by)
VALUES (
  'e0000000-0000-4000-8000-000000000021',
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000011',
  NOW() - INTERVAL '14 days',
  '{
    "version": 2,
    "soilType": "Laterite/Red Soil",
    "remarks": "Advisory sample S1 — rhizome rot risk after prolonged rainfall",
    "macro": {
      "ph": { "value": "5.8", "unit": "" },
      "ec": { "value": "0.6", "unit": "dS/m" },
      "organicCarbon": { "value": "0.9", "unit": "%" },
      "nitrogen": { "value": "280", "unit": "kg/ha" },
      "phosphorus": { "value": "42", "unit": "kg/ha" },
      "potassium": { "value": "310", "unit": "kg/ha" },
      "calcium": { "value": "350", "unit": "ppm" },
      "magnesium": { "value": "", "unit": "ppm" },
      "sulfur": { "value": "", "unit": "ppm" },
      "sodium": { "value": "", "unit": "meq/100g" }
    },
    "micro": {
      "zinc": { "value": "1.2", "unit": "ppm" },
      "boron": { "value": "", "unit": "ppm" },
      "iron": { "value": "", "unit": "ppm" },
      "manganese": { "value": "", "unit": "ppm" },
      "copper": { "value": "", "unit": "ppm" },
      "molybdenum": { "value": "", "unit": "ppm" }
    }
  }'::jsonb,
  'advisory_sample_seed'
)
ON CONFLICT (id) DO UPDATE SET
  metrics = EXCLUDED.metrics,
  reported_at = EXCLUDED.reported_at,
  block_id = EXCLUDED.block_id;

-- Scenario 2 — K & Mg Deficiency
INSERT INTO crm_soil_reports (id, farmer_id, block_id, reported_at, metrics, uploaded_by)
VALUES (
  'e0000000-0000-4000-8000-000000000022',
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000012',
  NOW() - INTERVAL '21 days',
  '{
    "version": 2,
    "soilType": "Loamy",
    "remarks": "Advisory sample S2 — low K and Mg; avoid misdiagnosing as disease",
    "macro": {
      "ph": { "value": "7.3", "unit": "" },
      "ec": { "value": "0.5", "unit": "dS/m" },
      "organicCarbon": { "value": "0.45", "unit": "%" },
      "nitrogen": { "value": "260", "unit": "kg/ha" },
      "phosphorus": { "value": "35", "unit": "kg/ha" },
      "potassium": { "value": "85", "unit": "kg/ha" },
      "calcium": { "value": "", "unit": "ppm" },
      "magnesium": { "value": "45", "unit": "ppm" },
      "sulfur": { "value": "", "unit": "ppm" },
      "sodium": { "value": "", "unit": "meq/100g" }
    },
    "micro": {
      "zinc": { "value": "0.8", "unit": "ppm" },
      "boron": { "value": "", "unit": "ppm" },
      "iron": { "value": "", "unit": "ppm" },
      "manganese": { "value": "", "unit": "ppm" },
      "copper": { "value": "", "unit": "ppm" },
      "molybdenum": { "value": "", "unit": "ppm" }
    }
  }'::jsonb,
  'advisory_sample_seed'
)
ON CONFLICT (id) DO UPDATE SET
  metrics = EXCLUDED.metrics,
  reported_at = EXCLUDED.reported_at,
  block_id = EXCLUDED.block_id;

-- Scenario 3 — Waterlogging + multi-issue E2E
INSERT INTO crm_soil_reports (id, farmer_id, block_id, reported_at, metrics, uploaded_by)
VALUES (
  'e0000000-0000-4000-8000-000000000023',
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000013',
  NOW() - INTERVAL '7 days',
  '{
    "version": 2,
    "soilType": "Clay",
    "remarks": "Advisory sample S3 — waterlogging, early rot, N and Zn deficiency (full E2E test)",
    "macro": {
      "ph": { "value": "8.2", "unit": "" },
      "ec": { "value": "2.2", "unit": "dS/m" },
      "organicCarbon": { "value": "0.28", "unit": "%" },
      "nitrogen": { "value": "110", "unit": "kg/ha" },
      "phosphorus": { "value": "18", "unit": "kg/ha" },
      "potassium": { "value": "95", "unit": "kg/ha" },
      "calcium": { "value": "140", "unit": "ppm" },
      "magnesium": { "value": "", "unit": "ppm" },
      "sulfur": { "value": "", "unit": "ppm" },
      "sodium": { "value": "", "unit": "meq/100g" }
    },
    "micro": {
      "zinc": { "value": "0.3", "unit": "ppm" },
      "boron": { "value": "", "unit": "ppm" },
      "iron": { "value": "", "unit": "ppm" },
      "manganese": { "value": "", "unit": "ppm" },
      "copper": { "value": "", "unit": "ppm" },
      "molybdenum": { "value": "", "unit": "ppm" }
    }
  }'::jsonb,
  'advisory_sample_seed'
)
ON CONFLICT (id) DO UPDATE SET
  metrics = EXCLUDED.metrics,
  reported_at = EXCLUDED.reported_at,
  block_id = EXCLUDED.block_id;

COMMENT ON TABLE crm_soil_reports IS 'Soil lab panel (metrics JSONB v2). Advisory QA samples: farmer e0000000-0000-4000-8000-000000000001';
