import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lexiconSpecificityScore,
  pickBestScopedRow,
} from '../src/services/regional-terminology/terminology-match.util.js';

describe('terminology lexicon specificity', () => {
  it('prefers district+crop over crop over language-global', () => {
    const rows = [
      { id: 'global', cropType: null, district: null, confidence: 0.9 },
      { id: 'crop', cropType: 'ginger', district: null, confidence: 0.8 },
      { id: 'district-crop', cropType: 'ginger', district: 'Idukki', confidence: 0.7 },
    ];
    const best = pickBestScopedRow(rows, { cropType: 'ginger', district: 'Idukki' });
    assert.equal(best?.id, 'district-crop');

    const cropOnly = pickBestScopedRow(rows, { cropType: 'ginger', district: null });
    assert.equal(cropOnly?.id, 'crop');

    const globalOnly = pickBestScopedRow(rows, { cropType: null, district: null });
    assert.equal(globalOnly?.id, 'global');
  });

  it('never selects a mismatched district or crop', () => {
    const score = lexiconSpecificityScore(
      { cropType: 'ginger', district: 'Wayanad', confidence: 1 },
      { cropType: 'ginger', district: 'Idukki' }
    );
    assert.equal(score, -1);

    const wrongCrop = lexiconSpecificityScore(
      { cropType: 'banana', district: null, confidence: 1 },
      { cropType: 'ginger', district: null }
    );
    assert.equal(wrongCrop, -1);
  });

  it('keeps language-scoped district rows out when district is absent', () => {
    const best = pickBestScopedRow(
      [
        { id: 'district', cropType: null, district: 'Idukki', confidence: 0.95 },
        { id: 'global', cropType: null, district: null, confidence: 0.5 },
      ],
      { cropType: null, district: null }
    );
    assert.equal(best?.id, 'global');
  });

  it('ranks district-only above crop-only when both match request', () => {
    const best = pickBestScopedRow(
      [
        { id: 'crop', cropType: 'ginger', district: null, confidence: 0.99 },
        { id: 'district', cropType: null, district: 'Idukki', confidence: 0.5 },
      ],
      { cropType: 'ginger', district: 'Idukki' }
    );
    assert.equal(best?.id, 'district');
  });
});
