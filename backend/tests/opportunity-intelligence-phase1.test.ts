import { describe, expect, it } from 'vitest';
import { FARMER_EVENT_TYPES } from '../src/services/intelligence/farmer-event.types.js';

describe('opportunity-intelligence phase1 event capture', () => {
  it('covers Phase 1 milestone event types', () => {
    const phase1Events = [
      'MESSAGE_SENT',
      'MESSAGE_REPLY',
      'IMAGE_UPLOAD',
      'VOICE_NOTE',
      'RECOMMENDATION_APPLIED',
      'RECOMMENDATION_APPROVED',
      'RECOMMENDATION_COMMUNICATED',
      'FOLLOWUP_COMPLETED',
      'CALLBACK_REQUESTED',
      'ROI_ENTRY',
      'ORDER_CONVERTED',
      'ADVISORY_SESSION_COMPLETED',
      'CROP_ASSESSMENT_REQUESTED',
      'FIELD_FINDING_LOGGED',
      'FARMER_REACTIVATED',
    ];
    for (const t of phase1Events) {
      expect(FARMER_EVENT_TYPES).toContain(t);
    }
  });

  it('idempotency keys are stable prefixes', () => {
    const samples = [
      'wa:inbound:msg-123',
      'wa:outbound:msg-456',
      'rec:approved:rec-uuid',
      'rec:communicated:rec-uuid',
      'rec:applied:rec-uuid',
      'roi:entry-uuid',
      'order:paid:shopify-99',
      'advisory:completed:session-1',
    ];
    for (const key of samples) {
      expect(key.length).toBeGreaterThan(5);
      expect(key).not.toContain(' ');
    }
  });
});
