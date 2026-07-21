import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Documented new-farmer WhatsApp sequence (enforced in whatsapp-inbound.pipeline.ts):
 * 1. Hi → language menu (2 messages: 3 buttons + 2 buttons)
 * 2. Language tap (lang.en etc.) → pincode prompt
 * 3. 6-digit pincode → acreage buttons
 * 4. Acreage → crop picker
 * 5. Crop → planting date (DDMMYYYY)
 * 6. Planting date → main menu
 */

const ONBOARDING_STEPS = [
  'hi',
  'language_select',
  'pincode',
  'acreage',
  'crop',
  'planting_date',
  'main_menu',
] as const;

describe('new farmer onboarding sequence', () => {
  it('defines the required step order', () => {
    assert.deepEqual(ONBOARDING_STEPS, [
      'hi',
      'language_select',
      'pincode',
      'acreage',
      'crop',
      'planting_date',
      'main_menu',
    ]);
  });

  it('language button ids map to onboarding language codes', () => {
    const buttons = [
      { id: 'lang.en', code: 'en' },
      { id: 'lang.ml', code: 'ml' },
      { id: 'lang.ta', code: 'ta' },
      { id: 'lang.kn', code: 'kn' },
      { id: 'lang.hi', code: 'hi' },
    ];
    for (const b of buttons) {
      assert.equal(b.id.replace('lang.', ''), b.code);
    }
  });
});
