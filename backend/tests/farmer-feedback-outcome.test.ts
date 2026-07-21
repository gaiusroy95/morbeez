import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFarmerOutcomeAnswer } from '../src/services/whatsapp/scenarios/farmer-feedback-flow.service.js';

const ACTIVITY_REPLY =
  'I applied 19:19:19 fertilizer 70 kg, magnesium sulphate 15 kg, zinc sulphate 10 kg per acre. Took 7 labour paid ₹700 per labour.';

describe('farmer feedback outcome parsing', () => {
  it('does not treat fertilizer/labour logs as outcome answers', () => {
    assert.equal(parseFarmerOutcomeAnswer(ACTIVITY_REPLY), null);
  });

  it('accepts short outcome replies', () => {
    assert.equal(parseFarmerOutcomeAnswer('improved'), 'improved');
    assert.equal(parseFarmerOutcomeAnswer('partial'), 'partial');
    assert.equal(parseFarmerOutcomeAnswer('no change'), 'no_change');
    assert.equal(parseFarmerOutcomeAnswer('2'), 'partial');
  });
});
