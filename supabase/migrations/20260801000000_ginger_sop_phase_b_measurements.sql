-- Ginger SOP v3 Phase B — field measurement templates

INSERT INTO crop_measurement_templates (crop_type, measurement_key, label_en, unit, input_type, sort_order)
VALUES
  ('ginger', 'plant_height', 'Plant height (10+10 sample)', 'cm', 'number', 35),
  ('ginger', 'leaves_per_shoot', 'Leaves per shoot', 'count', 'number', 36),
  ('ginger', 'bed_floor_visibility', 'Bed floor visibility (1=>75% visible, 5=<10%)', 'score', 'number', 40),
  ('ginger', 'weed_pressure', 'Weed pressure (1=severe, 5=none)', 'score', 'number', 41),
  ('ginger', 'irrigation_water_ph', 'Irrigation water pH', 'pH', 'number', 50),
  ('ginger', 'irrigation_water_ec', 'Irrigation water EC', 'dS/m', 'number', 51)
ON CONFLICT (crop_type, measurement_key) DO UPDATE SET
  label_en = EXCLUDED.label_en,
  unit = EXCLUDED.unit,
  input_type = EXCLUDED.input_type,
  sort_order = EXCLUDED.sort_order;
