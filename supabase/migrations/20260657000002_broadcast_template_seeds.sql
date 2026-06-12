-- Default Ginger DAP broadcast templates (draft — approve in Broadcast Admin)

INSERT INTO whatsapp_broadcast_templates (name, category, crop_type, target_dap, title, body, language, status)
SELECT v.name, v.category, v.crop_type, v.target_dap, v.title, v.body, 'en', 'draft'
FROM (VALUES
  (
    'Ginger 30 DAP Fertigation Reminder',
    'fertigation_reminder',
    'ginger',
    30,
    'Fertigation reminder',
    'Hello {{FarmerName}}, your {{Crop}} crop is at {{DAP}} DAP. Please follow the fertigation schedule for this stage. — Morbeez'
  ),
  (
    'Ginger 45 DAP Cultivation Advisory',
    'cultivation_advisory',
    'ginger',
    45,
    'Cultivation advisory',
    'Hello {{FarmerName}}, your {{Crop}} at {{DAP}} DAP in {{Village}} needs attention on weed and nutrient management. — Morbeez'
  ),
  (
    'Ginger 60 DAP Fertigation Reminder',
    'fertigation_reminder',
    'ginger',
    60,
    'Fertigation reminder',
    'Hello {{FarmerName}}, {{Crop}} at {{DAP}} DAP ({{FarmArea}} acres): apply the recommended fertigation dose this week. — Morbeez'
  ),
  (
    'Ginger 90 DAP Harvest Prep',
    'cultivation_advisory',
    'ginger',
    90,
    'Harvest preparation',
    'Hello {{FarmerName}}, your {{Crop}} crop is at {{DAP}} DAP. Plan harvest and post-harvest handling in {{District}}. — Morbeez'
  )
) AS v(name, category, crop_type, target_dap, title, body)
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_broadcast_templates t
  WHERE t.name = v.name AND t.crop_type = v.crop_type AND t.target_dap = v.target_dap
);
