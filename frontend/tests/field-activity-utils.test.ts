import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fieldActivityAddedFromLabel,
  isConfirmedVoiceActivity,
  type FieldActivity,
} from '../src/components/operations/field-activities/field-activity-utils.ts';

function baseActivity(overrides: Partial<FieldActivity> = {}): FieldActivity {
  return {
    id: 'a1',
    farm_block_id: 'b1',
    activity_type: 'spray_applied',
    activity_label: 'Thrips Spray',
    applied_at: '2026-07-01',
    notes: null,
    cost_inr: 120,
    follow_up_required: false,
    follow_up_date: null,
    activity_status: 'completed',
    created_at: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

test('isConfirmedVoiceActivity requires voice source and confirmation', () => {
  assert.equal(
    isConfirmedVoiceActivity(
      baseActivity({
        source_type: 'voice_note',
        confirmed_by: 'staff@example.com',
        transcript: 'spray cheyth',
      })
    ),
    true
  );
  assert.equal(
    isConfirmedVoiceActivity(
      baseActivity({
        source_type: 'voice_note',
        transcript: 'spray cheyth',
      })
    ),
    false
  );
  assert.equal(isConfirmedVoiceActivity(baseActivity({ added_from: 'whatsapp' })), false);
});

test('fieldActivityAddedFromLabel prefers Voice-derived for confirmed voice rows', () => {
  assert.equal(
    fieldActivityAddedFromLabel(
      baseActivity({
        sourceType: 'voice_derived',
        confirmedAt: '2026-07-02T08:00:00.000Z',
      })
    ),
    'Voice-derived'
  );
  assert.equal(
    fieldActivityAddedFromLabel(baseActivity({ added_from: 'telecaller' })),
    'Interaction'
  );
});
