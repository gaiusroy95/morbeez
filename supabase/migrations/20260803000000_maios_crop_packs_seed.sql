-- MAIOS v12 crop pack + knowledge graph seeds

INSERT INTO crop_packs (crop_type, version, config, active)
VALUES
  ('ginger', '3.0', '{"cropType":"ginger","version":"3.0","displayName":"Ginger","photoSlots":[{"id":"field_wide","group":"farm","labelEn":"Full field wide","labelMl":"മുഴുവൻ വയൽ","whatsappPriority":8},{"id":"affected_zone","group":"farm","labelEn":"Affected zone","labelMl":"ബാധിത ഭാഗം","whatsappPriority":4},{"id":"healthy_zone","group":"farm","labelEn":"Healthy zone","labelMl":"ആരോഗ്യമുള്ള ഭാഗം","whatsappPriority":9},{"id":"canopy_top","group":"canopy","labelEn":"Top view","labelMl":"മുകളിൽ നിന്ന്","whatsappPriority":10},{"id":"canopy_side","group":"canopy","labelEn":"Side view","labelMl":"വശത്ത് നിന്ന്","whatsappPriority":11},{"id":"bed_bottom","group":"canopy","labelEn":"Bed bottom view","labelMl":"തടി താഴെ","whatsappPriority":12},{"id":"new_leaf_close","group":"leaf","labelEn":"New leaf close-up","labelMl":"പുതിയ ഇല അടുത്ത്","whatsappPriority":1},{"id":"old_leaf_close","group":"leaf","labelEn":"Old leaf close-up","labelMl":"പഴയ ഇല അടുത്ത്","whatsappPriority":2},{"id":"leaf_underside","group":"leaf","labelEn":"Leaf underside","labelMl":"ഇലയുടെ അടിവശം","whatsappPriority":3},{"id":"root_photo","group":"root","labelEn":"Root photo","labelMl":"വേര് ഫോട്ടോ","whatsappPriority":5},{"id":"rhizome_outside","group":"root","labelEn":"Rhizome outside","labelMl":"റൈസോം പുറത്ത്","whatsappPriority":6},{"id":"rhizome_cut","group":"root","labelEn":"Rhizome cut open","labelMl":"റൈസോം മുറിച്ചത്","whatsappPriority":7}],"rootPhotoSlots":["root_photo","rhizome_outside","rhizome_cut"],"measurementKeys":["spad","shoot_count","shoot_diameter","plant_height","leaves_per_shoot","bed_floor_visibility","weed_pressure","irrigation_water_ph","irrigation_water_ec","canopy_cover"],"moduleWeights":{"geo":5,"photo":15,"canopy":10,"field":10,"root":25,"soil":10,"water":10,"history":10,"weather":5},"recoveryDays":[3,7,14],"stageModel":[{"id":"germination","label":"Germination","dapMin":0,"dapMax":20},{"id":"vegetative","label":"Vegetative","dapMin":21,"dapMax":90},{"id":"reproductive","label":"Reproductive","dapMin":91,"dapMax":180},{"id":"harvest","label":"Harvest/Maturity","dapMin":181,"dapMax":null}],"riskRules":{"rootStressPattern":"root|rhizome|nematode|rot|വേര|റൈസോം"},"canopyExpectations":[{"dap":30,"closurePct":20},{"dap":45,"closurePct":40},{"dap":60,"closurePct":60},{"dap":75,"closurePct":80},{"dap":90,"closurePct":90}]}'::jsonb, true),
  ('banana', '12.0', '{"cropType":"banana","version":"12.0","displayName":"Banana","photoSlots":[{"id":"field_wide","group":"farm","labelEn":"Full field","labelMl":"മുഴുവൻ വയൽ","whatsappPriority":1},{"id":"affected_zone","group":"farm","labelEn":"Affected area","labelMl":"ബാധിത ഭാഗം","whatsappPriority":2},{"id":"healthy_zone","group":"farm","labelEn":"Healthy area","labelMl":"ആരോഗ്യമുള്ള ഭാഗം","whatsappPriority":3},{"id":"canopy_top","group":"canopy","labelEn":"Canopy","labelMl":"മേൽപ്പടം","whatsappPriority":4},{"id":"new_leaf_close","group":"leaf","labelEn":"Leaf top","labelMl":"ഇല മുകളിൽ","whatsappPriority":5},{"id":"leaf_underside","group":"leaf","labelEn":"Leaf bottom","labelMl":"ഇല അടിവശം","whatsappPriority":6},{"id":"stem_close","group":"leaf","labelEn":"Stem","labelMl":"തണ്ട്","whatsappPriority":7},{"id":"root_zone","group":"root","labelEn":"Root zone","labelMl":"വേര് മേഖല","whatsappPriority":8},{"id":"pseudostem_close","group":"leaf","labelEn":"Pseudostem close-up","labelMl":"തണ്ട് അടുത്ത്","whatsappPriority":9,"conditional":true},{"id":"fruit_bunch","group":"fruit","labelEn":"Fruit bunch","labelMl":"പഴം കുല","whatsappPriority":10,"conditional":true}],"rootPhotoSlots":["root_zone"],"measurementKeys":["spad","plant_height","pseudostem_girth","leaf_count"],"moduleWeights":{"geo":8,"photo":20,"canopy":12,"field":12,"root":10,"soil":12,"water":10,"history":10,"weather":5},"recoveryDays":[3,7,14],"stageModel":[{"id":"germination","label":"Germination","dapMin":0,"dapMax":14},{"id":"vegetative","label":"Vegetative","dapMin":15,"dapMax":60},{"id":"reproductive","label":"Reproductive","dapMin":61,"dapMax":120},{"id":"harvest","label":"Harvest/Maturity","dapMin":121,"dapMax":null}]}'::jsonb, true)
ON CONFLICT (crop_type, version) DO UPDATE SET
  config = EXCLUDED.config,
  active = EXCLUDED.active,
  updated_at = NOW();

-- KG nodes from agronomy concepts
INSERT INTO kg_nodes (node_type, label, metadata)
SELECT
  CASE
    WHEN lower(COALESCE(ac.category, '')) IN ('symptom', 'disease', 'pest') THEN lower(ac.category)
    ELSE 'concept'
  END,
  ac.name,
  jsonb_build_object('concept_code', ac.concept_code, 'source', 'agronomy_concepts')
FROM agronomy_concepts ac
WHERE ac.name IS NOT NULL AND trim(ac.name) <> ''
ON CONFLICT (node_type, label) DO NOTHING;

-- KG issue nodes from recommendation templates
INSERT INTO kg_nodes (node_type, label, metadata)
SELECT
  'issue',
  COALESCE(rt.issue_label_en, rt.issue_key),
  jsonb_build_object('crop_type', rt.crop_type, 'issue_key', rt.issue_key, 'source', 'recommendation_templates')
FROM recommendation_templates rt
WHERE rt.status IN ('approved', 'draft') AND COALESCE(rt.issue_label_en, rt.issue_key) IS NOT NULL
ON CONFLICT (node_type, label) DO NOTHING;

-- KG chemical nodes from resistance rotation
INSERT INTO kg_nodes (node_type, label, metadata)
SELECT DISTINCT
  'chemical',
  rrg.technical_name,
  jsonb_build_object('crop_type', rrg.crop_type, 'moa', rrg.mode_of_action, 'source', 'resistance_rotation_groups')
FROM resistance_rotation_groups rrg
WHERE rrg.active = true AND rrg.technical_name IS NOT NULL
ON CONFLICT (node_type, label) DO NOTHING;

-- KG edges: concept/symptom -> issue (crop-linked templates)
INSERT INTO kg_edges (from_node_id, to_node_id, relation, weight)
SELECT DISTINCT
  sn.id,
  in_node.id,
  'suggests_issue',
  0.6
FROM kg_nodes sn
CROSS JOIN recommendation_templates rt
JOIN kg_nodes in_node
  ON in_node.node_type = 'issue'
 AND in_node.label = COALESCE(rt.issue_label_en, rt.issue_key)
 AND in_node.metadata->>'crop_type' = rt.crop_type
WHERE sn.node_type IN ('symptom', 'concept', 'disease')
  AND sn.metadata->>'source' = 'agronomy_concepts'
  AND NOT EXISTS (
    SELECT 1 FROM kg_edges e
    WHERE e.from_node_id = sn.id AND e.to_node_id = in_node.id AND e.relation = 'suggests_issue'
  );
