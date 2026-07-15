import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGingerRecoveryCheckInBody,
  buildMaiosRecoveryCheckInBody,
} from '../src/services/case/recovery-checkin-copy.js';

describe('recovery check-in copy includes condition', () => {
  it('mentions condition in MAIOS Day 7 English check-in', () => {
    const body = buildMaiosRecoveryCheckInBody({
      lang: 'en',
      cropDisplayName: 'Ginger',
      day: 7,
      condition: 'Anthracnose / fungal leaf spot',
    });
    assert.match(body, /Day 7/);
    assert.match(body, /Anthracnose \/ fungal leaf spot/);
    assert.match(body, /Condition:/);
    assert.match(body, /How is the crop now after treatment/);
  });

  it('falls back without condition', () => {
    const body = buildMaiosRecoveryCheckInBody({
      lang: 'en',
      cropDisplayName: 'Ginger',
      day: 7,
      condition: null,
    });
    assert.match(body, /Day 7: How is the crop now/);
    assert.doesNotMatch(body, /Condition:/);
  });

  it('mentions condition in Ginger SOP check-in', () => {
    const body = buildGingerRecoveryCheckInBody({
      lang: 'en',
      day: 7,
      condition: 'Rhizome rot',
    });
    assert.match(body, /Condition: Rhizome rot/);
  });
});
