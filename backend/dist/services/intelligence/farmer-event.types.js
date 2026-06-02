/** Canonical farmer event types (must match DB check constraint). */
export const FARMER_EVENT_TYPES = [
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
    'FARMER_ONBOARDED',
];
export const FARMER_EVENT_SOURCES = [
    'whatsapp',
    'crm',
    'agronomist',
    'shopify',
    'roi',
    'system',
    'field_pwa',
    'web',
];
//# sourceMappingURL=farmer-event.types.js.map