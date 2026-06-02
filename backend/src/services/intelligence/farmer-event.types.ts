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
] as const;

export type FarmerEventType = (typeof FARMER_EVENT_TYPES)[number];

export const FARMER_EVENT_SOURCES = [
  'whatsapp',
  'crm',
  'agronomist',
  'shopify',
  'roi',
  'system',
  'field_pwa',
  'web',
] as const;

export type FarmerEventSource = (typeof FARMER_EVENT_SOURCES)[number];

export type FarmerEventValue = Record<string, unknown>;

export type RecordFarmerEventInput = {
  farmerId: string;
  eventType: FarmerEventType;
  eventValue?: FarmerEventValue;
  source: FarmerEventSource;
  employeeProfileId?: string | null;
  employeeEmail?: string | null;
  idempotencyKey?: string;
  referenceType?: string;
  referenceId?: string;
  occurredAt?: string;
};

export type FarmerEventRow = {
  id: string;
  farmerId: string;
  employeeProfileId: string | null;
  eventType: FarmerEventType;
  eventValue: FarmerEventValue;
  source: FarmerEventSource;
  occurredAt: string;
  createdAt: string;
};
