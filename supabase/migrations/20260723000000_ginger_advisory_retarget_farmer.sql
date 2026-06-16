-- Retarget ginger advisory samples to farmer +916282873542 and remove demo farmer if present.
-- Safe if 20260722000000 already created "Ginger Advisory Demo" on a previous push.

DO $$
DECLARE
  v_farmer_id UUID;
  v_demo_farmer_id UUID := 'e0000000-0000-4000-8000-000000000001';
BEGIN
  SELECT id INTO v_farmer_id
  FROM farmers
  WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = '6282873542'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_farmer_id IS NULL THEN
    RAISE EXCEPTION 'Farmer with phone ending 6282873542 not found';
  END IF;

  UPDATE farm_blocks
  SET farmer_id = v_farmer_id
  WHERE id IN (
    'e0000000-0000-4000-8000-000000000011',
    'e0000000-0000-4000-8000-000000000012',
    'e0000000-0000-4000-8000-000000000013'
  );

  UPDATE crm_soil_reports
  SET farmer_id = v_farmer_id
  WHERE id IN (
    'e0000000-0000-4000-8000-000000000021',
    'e0000000-0000-4000-8000-000000000022',
    'e0000000-0000-4000-8000-000000000023'
  );

  DELETE FROM farmers
  WHERE id = v_demo_farmer_id
    AND source = 'advisory_sample'
    AND NOT EXISTS (SELECT 1 FROM farm_blocks fb WHERE fb.farmer_id = v_demo_farmer_id);

  INSERT INTO farm_blocks (
    id, farmer_id, name, crop_name, crop_type, plot_label,
    planting_date, variety_name, irrigation_type, acreage_decimal, is_primary, stage
  )
  VALUES
    (
      'e0000000-0000-4000-8000-000000000011', v_farmer_id,
      'Ginger S1 — Rhizome Rot', 'Ginger', 'ginger', 'Plot A — 90 DAS',
      (CURRENT_DATE - INTERVAL '90 days')::date, 'Varada', 'drip', 0.75, false, 'Vegetative'
    ),
    (
      'e0000000-0000-4000-8000-000000000012', v_farmer_id,
      'Ginger S2 — K/Mg Deficiency', 'Ginger', 'ginger', 'Plot B — Rhizome dev',
      (CURRENT_DATE - INTERVAL '150 days')::date, 'Varada', 'sprinkler', 1.0, false, 'Rhizome Development'
    ),
    (
      'e0000000-0000-4000-8000-000000000013', v_farmer_id,
      'Ginger S3 — Waterlogging E2E', 'Ginger', 'ginger', 'Plot C — 120 DAS low lying',
      (CURRENT_DATE - INTERVAL '120 days')::date, 'Varada', 'flood', 1.25, true, 'Vegetative'
    )
  ON CONFLICT (id) DO UPDATE SET
    farmer_id = EXCLUDED.farmer_id,
    name = EXCLUDED.name,
    plot_label = EXCLUDED.plot_label,
    planting_date = EXCLUDED.planting_date,
    variety_name = EXCLUDED.variety_name,
    irrigation_type = EXCLUDED.irrigation_type,
    acreage_decimal = EXCLUDED.acreage_decimal,
    stage = EXCLUDED.stage;

  INSERT INTO crm_soil_reports (id, farmer_id, block_id, reported_at, metrics, uploaded_by)
  VALUES
    (
      'e0000000-0000-4000-8000-000000000021', v_farmer_id,
      'e0000000-0000-4000-8000-000000000011', NOW() - INTERVAL '14 days',
      '{"version":2,"soilType":"Laterite/Red Soil","remarks":"Advisory sample S1 — rhizome rot risk","macro":{"ph":{"value":"5.8","unit":""},"ec":{"value":"0.6","unit":"dS/m"},"organicCarbon":{"value":"0.9","unit":"%"},"nitrogen":{"value":"280","unit":"kg/ha"},"phosphorus":{"value":"42","unit":"kg/ha"},"potassium":{"value":"310","unit":"kg/ha"},"calcium":{"value":"350","unit":"ppm"},"magnesium":{"value":"","unit":"ppm"},"sulfur":{"value":"","unit":"ppm"},"sodium":{"value":"","unit":"meq/100g"}},"micro":{"zinc":{"value":"1.2","unit":"ppm"},"boron":{"value":"","unit":"ppm"},"iron":{"value":"","unit":"ppm"},"manganese":{"value":"","unit":"ppm"},"copper":{"value":"","unit":"ppm"},"molybdenum":{"value":"","unit":"ppm"}}}'::jsonb,
      'advisory_sample_seed'
    ),
    (
      'e0000000-0000-4000-8000-000000000022', v_farmer_id,
      'e0000000-0000-4000-8000-000000000012', NOW() - INTERVAL '21 days',
      '{"version":2,"soilType":"Loamy","remarks":"Advisory sample S2 — low K and Mg","macro":{"ph":{"value":"7.3","unit":""},"ec":{"value":"0.5","unit":"dS/m"},"organicCarbon":{"value":"0.45","unit":"%"},"nitrogen":{"value":"260","unit":"kg/ha"},"phosphorus":{"value":"35","unit":"kg/ha"},"potassium":{"value":"85","unit":"kg/ha"},"calcium":{"value":"","unit":"ppm"},"magnesium":{"value":"45","unit":"ppm"},"sulfur":{"value":"","unit":"ppm"},"sodium":{"value":"","unit":"meq/100g"}},"micro":{"zinc":{"value":"0.8","unit":"ppm"},"boron":{"value":"","unit":"ppm"},"iron":{"value":"","unit":"ppm"},"manganese":{"value":"","unit":"ppm"},"copper":{"value":"","unit":"ppm"},"molybdenum":{"value":"","unit":"ppm"}}}'::jsonb,
      'advisory_sample_seed'
    ),
    (
      'e0000000-0000-4000-8000-000000000023', v_farmer_id,
      'e0000000-0000-4000-8000-000000000013', NOW() - INTERVAL '7 days',
      '{"version":2,"soilType":"Clay","remarks":"Advisory sample S3 — waterlogging E2E","macro":{"ph":{"value":"8.2","unit":""},"ec":{"value":"2.2","unit":"dS/m"},"organicCarbon":{"value":"0.28","unit":"%"},"nitrogen":{"value":"110","unit":"kg/ha"},"phosphorus":{"value":"18","unit":"kg/ha"},"potassium":{"value":"95","unit":"kg/ha"},"calcium":{"value":"140","unit":"ppm"},"magnesium":{"value":"","unit":"ppm"},"sulfur":{"value":"","unit":"ppm"},"sodium":{"value":"","unit":"meq/100g"}},"micro":{"zinc":{"value":"0.3","unit":"ppm"},"boron":{"value":"","unit":"ppm"},"iron":{"value":"","unit":"ppm"},"manganese":{"value":"","unit":"ppm"},"copper":{"value":"","unit":"ppm"},"molybdenum":{"value":"","unit":"ppm"}}}'::jsonb,
      'advisory_sample_seed'
    )
  ON CONFLICT (id) DO UPDATE SET
    farmer_id = EXCLUDED.farmer_id,
    metrics = EXCLUDED.metrics,
    reported_at = EXCLUDED.reported_at,
    block_id = EXCLUDED.block_id;
END $$;
