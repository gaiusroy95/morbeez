-- Extend farmer_events for onboarding + web lead form source.

ALTER TABLE farmer_events DROP CONSTRAINT IF EXISTS farmer_events_event_type_check;

ALTER TABLE farmer_events ADD CONSTRAINT farmer_events_event_type_check CHECK (
  event_type IN (
    'MESSAGE_SENT',
    'MESSAGE_REPLY',
    'IMAGE_UPLOAD',
    'VOICE_NOTE',
    'RECOMMENDATION_APPLIED',
    'FOLLOWUP_COMPLETED',
    'CALLBACK_REQUESTED',
    'SITE_VISIT_ACCEPTED',
    'ROI_ENTRY',
    'SOIL_TEST_UPLOADED',
    'CROP_ASSESSMENT_REQUESTED',
    'RECOMMENDATION_APPROVED',
    'RECOMMENDATION_COMMUNICATED',
    'FARMER_REACTIVATED',
    'ORDER_CONVERTED',
    'ADVISORY_SESSION_COMPLETED',
    'FIELD_FINDING_LOGGED',
    'FARMER_ONBOARDED'
  )
);

ALTER TABLE farmer_events DROP CONSTRAINT IF EXISTS farmer_events_source_check;

ALTER TABLE farmer_events ADD CONSTRAINT farmer_events_source_check CHECK (
  source IN ('whatsapp', 'crm', 'agronomist', 'shopify', 'roi', 'system', 'field_pwa', 'web')
);
