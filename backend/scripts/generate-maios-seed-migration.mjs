import { writeFileSync } from 'fs';
import { GINGER_PACK } from '../dist/domain/crop-pack/packs/ginger.pack.js';
import { BANANA_PACK } from '../dist/domain/crop-pack/packs/banana.pack.js';

const esc = (s) => s.replace(/'/g, "''");
const ginger = esc(JSON.stringify(GINGER_PACK));
const banana = esc(JSON.stringify(BANANA_PACK));

const sql = `-- MAIOS v12 crop pack + knowledge graph seeds

INSERT INTO crop_packs (crop_type, version, config, active)
VALUES
  ('ginger', '${GINGER_PACK.version}', '${ginger}'::jsonb, true),
  ('banana', '${BANANA_PACK.version}', '${banana}'::jsonb, true)
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
`;

writeFileSync(new URL('../../supabase/migrations/20260803000000_maios_crop_packs_seed.sql', import.meta.url), sql);
console.log('Seed migration written');
