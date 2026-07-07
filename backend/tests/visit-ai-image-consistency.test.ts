import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  anchorPrimaryIssueToImageSignal,
  sortVisitPhotosForDiagnosis,
  visitPhotoTypePriority,
} from '../src/services/core/visit-ai-image-anchor.js';
import { hashVisitImageBase64 } from '../src/services/core/visit-image-diagnosis-cache.service.js';
import { sortVisitScreeningPhotos } from '../../packages/shared/src/visit-wizard/visit-screening.js';

describe('visit AI image consistency', () => {
  it('prioritizes symptom close-up photos over field shots', () => {
    const photos = [
      { photoType: 'field_overview', dataBase64: 'a' },
      { photoType: 'leaf', dataBase64: 'b' },
      { photoType: 'whole_plot', dataBase64: 'c' },
    ];
    const sorted = sortVisitPhotosForDiagnosis(photos);
    assert.equal(sorted[0]?.photoType, 'leaf');
    assert.equal(visitPhotoTypePriority('leaf'), 0);
    assert.equal(visitPhotoTypePriority('field_overview'), 2);
  });

  it('sorts screening photos the same way on mobile payload build', () => {
    const sorted = sortVisitScreeningPhotos([
      { dataBase64: 'x'.repeat(120), mimeType: 'image/jpeg', photoType: 'plot' },
      { dataBase64: 'y'.repeat(120), mimeType: 'image/jpeg', photoType: 'disease_leaf' },
    ]);
    assert.equal(sorted[0]?.photoType, 'disease_leaf');
  });

  it('anchors primary diagnosis to the image signal when LLM disagrees', () => {
    const evidence = {
      photoSummary: 'Image signal: Rhizome rot',
      measurementSummary: '',
      soilSummary: '',
      weatherSummary: '',
      historySummary: '',
    };
    const issues = anchorPrimaryIssueToImageSignal(
      [
        {
          category: 'nutrient_deficiency',
          issueName: 'Potassium Deficiency',
          confidence: 0.82,
          severity: 'medium',
          rootCause: {
            symptoms: [],
            photoSignals: [],
            soilSignals: ['low K'],
            weatherSignals: ['heavy rain'],
            conclusion: 'Potassium Deficiency',
          },
          evidence,
        },
      ],
      { label: 'Rhizome rot', confidence: 0.88, source: 'vision', photoCount: 1 }
    );
    assert.equal(issues[0]?.issueName, 'Rhizome rot');
    assert.ok(issues.some((i) => i.issueName === 'Potassium Deficiency'));
  });

  it('promotes matching image diagnosis when LLM lists it second', () => {
    const evidence = {
      photoSummary: 'Image signal: Leaf spot',
      measurementSummary: '',
      soilSummary: '',
      weatherSummary: '',
      historySummary: '',
    };
    const issues = anchorPrimaryIssueToImageSignal(
      [
        {
          category: 'other',
          issueName: 'Heat stress',
          confidence: 0.7,
          severity: 'low',
          rootCause: {
            symptoms: [],
            photoSignals: [],
            soilSignals: [],
            weatherSignals: ['hot'],
            conclusion: 'Heat stress',
          },
          evidence,
        },
        {
          category: 'disease',
          issueName: 'Leaf spot',
          confidence: 0.66,
          severity: 'medium',
          rootCause: {
            symptoms: [],
            photoSignals: ['spots on leaves'],
            soilSignals: [],
            weatherSignals: [],
            conclusion: 'Leaf spot',
          },
          evidence,
        },
      ],
      { label: 'Leaf spot', confidence: 0.91, source: 'plant_id', photoCount: 1 }
    );
    assert.equal(issues[0]?.issueName, 'Leaf spot');
    assert.equal(issues[0]?.confidence, 0.91);
  });

  it('hashes image bytes deterministically', () => {
    const sample = Buffer.from('same-leaf-photo').toString('base64');
    assert.equal(hashVisitImageBase64(sample), hashVisitImageBase64(sample));
    assert.notEqual(hashVisitImageBase64(sample), hashVisitImageBase64('other'));
  });
});
