import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLanguage } from '../src/services/whatsapp/pipeline/language-detection.service.js';
import { validateAgricultureIntent } from '../src/services/whatsapp/pipeline/agriculture-guard.service.js';
import {
  isAgricultureMessage,
  shouldRunCropDoctorTextDiagnosis,
  buildCrossLanguageIntentSlug,
} from '../src/services/whatsapp/pipeline/crop-message-intent.service.js';
import { assessImageBuffer } from '../src/services/whatsapp/pipeline/image-quality.service.js';

describe('language preference', () => {
  it('normalizeLanguage uses stored session language', () => {
    assert.equal(normalizeLanguage(null, 'ml'), 'ml');
    assert.equal(normalizeLanguage(null, 'hi'), 'hi');
    assert.equal(normalizeLanguage(null, null), 'en');
  });
});

describe('agriculture guard', () => {
  it('blocks off-topic long text', () => {
    const r = validateAgricultureIntent({
      text: 'tell me about bitcoin trading strategies for beginners',
      hasCropMedia: false,
    });
    assert.equal(r.allowed, false);
  });

  it('allows crop media without text', () => {
    const r = validateAgricultureIntent({ text: '', hasCropMedia: true });
    assert.equal(r.allowed, true);
  });

  it('allows Hindi ginger leaf spot symptom text', () => {
    const hindi =
      'अदरक के पत्तों पर पीले धब्बे तेज़ी से फैल रहे हैं';
    assert.equal(isAgricultureMessage(hindi), true);
    const r = validateAgricultureIntent({ text: hindi, hasCropMedia: false });
    assert.equal(r.allowed, true);
    assert.equal(shouldRunCropDoctorTextDiagnosis(hindi), true);
  });

  it('builds same intent slug for English and Hindi yellow leaf spots', () => {
    const en = 'Yellow spots on ginger leaves spreading fast';
    const hi = 'अदरक के पत्तों पर पीले धब्बे तेज़ी से फैल रहे हैं';
    const slugEn = buildCrossLanguageIntentSlug('ginger', en);
    const slugHi = buildCrossLanguageIntentSlug('ginger', hi);
    assert.equal(slugEn, slugHi);
    assert.equal(slugEn, 'ginger_yellow_spot_leaf');
  });
});

describe('image quality', () => {
  it('rejects tiny buffers', () => {
    const r = assessImageBuffer(Buffer.alloc(100), 'image/jpeg');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'too_small');
  });
});
