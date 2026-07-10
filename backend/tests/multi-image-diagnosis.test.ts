import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDiagnosisImages,
  fusePerImageSignals,
  type PerImageDiagnosisSignal,
} from '../src/services/ai/multi-image-diagnosis.service.js';

function signal(
  partial: Partial<PerImageDiagnosisSignal> & Pick<PerImageDiagnosisSignal, 'index' | 'label'>
): PerImageDiagnosisSignal {
  return {
    confidence: 0.7,
    observations: [],
    source: 'vision',
    ...partial,
  };
}

describe('fusePerImageSignals', () => {
  it('returns empty fusion when no signals', () => {
    const fused = fusePerImageSignals([], 3);
    assert.equal(fused.fusedLabel, '');
    assert.equal(fused.analyzedCount, 0);
    assert.equal(fused.totalCount, 3);
  });

  it('passes through a single signal', () => {
    const fused = fusePerImageSignals(
      [signal({ index: 0, label: 'Leaf blight', confidence: 0.8, observations: ['brown spots'] })],
      1
    );
    assert.equal(fused.fusedLabel, 'Leaf blight');
    assert.equal(fused.fusedConfidence, 0.8);
    assert.match(fused.evidenceBlock, /Photo 1: Leaf blight/);
  });

  it('votes agreeing labels with an agreement bonus', () => {
    const fused = fusePerImageSignals(
      [
        signal({ index: 0, label: 'Leaf blight', confidence: 0.7 }),
        signal({ index: 1, label: 'Leaf blight', confidence: 0.8 }),
        signal({ index: 2, label: 'Leaf blight', confidence: 0.75 }),
      ],
      3
    );
    assert.equal(fused.fusedLabel, 'Leaf blight');
    assert.ok(fused.fusedConfidence > 0.75);
    assert.match(fused.evidenceBlock, /Fused primary signal: Leaf blight/);
    assert.match(fused.evidenceBlock, /Photo 2:/);
    assert.match(fused.evidenceBlock, /comprehensive diagnosis/i);
  });

  it('picks the majority label when photos disagree', () => {
    const fused = fusePerImageSignals(
      [
        signal({ index: 0, label: 'Leaf blight', confidence: 0.7 }),
        signal({ index: 1, label: 'Leaf blight', confidence: 0.72 }),
        signal({ index: 2, label: 'Nutrient deficiency', confidence: 0.9 }),
      ],
      3
    );
    assert.equal(fused.fusedLabel, 'Leaf blight');
    assert.match(fused.evidenceBlock, /Photo 3: Nutrient deficiency/);
  });

  it('is case-insensitive when grouping labels', () => {
    const fused = fusePerImageSignals(
      [
        signal({ index: 0, label: 'Soft Rot', confidence: 0.6 }),
        signal({ index: 1, label: 'soft rot', confidence: 0.7 }),
      ],
      2
    );
    assert.equal(normalize(fused.fusedLabel), 'soft rot');
  });
});

describe('collectDiagnosisImages', () => {
  it('dedupes primary against diagnosisImages by storage path', () => {
    const images = collectDiagnosisImages({
      imageBase64: 'AAAA',
      imageMimeType: 'image/jpeg',
      imageStoragePath: 'a/path.jpg',
      diagnosisImages: [
        { imageBase64: 'AAAA', imageMimeType: 'image/jpeg', imageStoragePath: 'a/path.jpg' },
        { imageBase64: 'BBBB', imageMimeType: 'image/jpeg', imageStoragePath: 'b/path.jpg' },
      ],
    });
    assert.equal(images.length, 2);
    assert.equal(images[1]?.imageStoragePath, 'b/path.jpg');
  });

  it('skips diagnosis images without base64', () => {
    const images = collectDiagnosisImages({
      imageBase64: 'AAAA',
      imageMimeType: 'image/jpeg',
      diagnosisImages: [
        { imageMimeType: 'image/jpeg', imageStoragePath: 'missing.jpg' },
        { imageBase64: 'CCCC', imageMimeType: 'image/jpeg', imageStoragePath: 'c.jpg' },
      ],
    });
    assert.equal(images.length, 2);
  });
});

function normalize(s: string) {
  return s.trim().toLowerCase();
}
