import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { looksLikeFarmActivityMessage } from '../src/services/farm-activity/farm-activity-message-intent.service.js';
import { parseDeterministicFarmActivityUtterance } from '../src/services/farm-activity/farm-activity-utterance-parser.service.js';
import { shouldRunCropDoctorTextDiagnosis } from '../src/services/whatsapp/pipeline/crop-message-intent.service.js';

const SAMPLE =
  '"I applied 19:19:19 fertilizer 70 kg, magnesium sulphate 15 kg, zinc sulphate 10 kg per acre. Took 7 labour paid ₹700 per labour.';

describe('farm activity WhatsApp routing', () => {
  it('detects fertilizer + labour logging messages', () => {
    assert.equal(looksLikeFarmActivityMessage(SAMPLE), true);
    assert.equal(shouldRunCropDoctorTextDiagnosis(SAMPLE), false);
  });

  it('still routes symptom questions to crop doctor', () => {
    const symptoms = 'My ginger leaves have yellow spots and brown tips, what disease is this?';
    assert.equal(looksLikeFarmActivityMessage(symptoms), false);
    assert.equal(shouldRunCropDoctorTextDiagnosis(symptoms), true);
  });

  it('parses fertilizer products and labour cost from a mixed utterance', () => {
    const events = parseDeterministicFarmActivityUtterance(SAMPLE, 'msg-1');
    assert.equal(events.length, 2);

    const fertilizer = events.find((event) => event.kind === 'activity');
    assert.ok(fertilizer);
    assert.equal(fertilizer!.activityType.value, 'fertilizer application');
    assert.match(String(fertilizer!.description.value), /19:19:19 fertilizer 70 kg/);
    assert.match(String(fertilizer!.description.value), /magnesium sulphate 15 kg/);
    assert.equal(fertilizer!.quantity.value, 95);

    const labour = events.find((event) => event.kind === 'labour');
    assert.ok(labour);
    assert.equal(labour!.workerCount.value, 7);
    assert.equal(labour!.rate.value?.amount, 700);
    assert.equal(labour!.totalCost.value?.amount, 4900);
  });
});
