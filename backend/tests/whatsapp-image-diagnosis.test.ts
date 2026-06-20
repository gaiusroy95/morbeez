import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiReuseService,
  hasDiagnosisMedia,
} from '../src/services/ai/ai-reuse.service.js';
import { whatsappDiagnosisRendererService } from '../src/services/whatsapp/pipeline/whatsapp-diagnosis-renderer.service.js';
import {
  mergeImageBatchCaption,
  scheduleImageBatch,
  whatsappImageBatchPendingCount,
} from '../src/services/whatsapp/pipeline/whatsapp-image-batch.service.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';

const baseInput = {
  farmerId: '00000000-0000-0000-0000-000000000001',
  cropType: 'ginger',
  language: 'en' as const,
  channel: 'whatsapp' as const,
  symptomsText: 'yellow spots on leaves',
};

describe('hasDiagnosisMedia', () => {
  it('is true when imageBase64 is set', () => {
    assert.equal(hasDiagnosisMedia({ imageBase64: 'abc123' }), true);
  });

  it('is true when imageStoragePath is set', () => {
    assert.equal(
      hasDiagnosisMedia({ imageStoragePath: 'farmer/x/photo.jpg' }),
      true
    );
  });

  it('is true when diagnosisImages array is non-empty', () => {
    assert.equal(
      hasDiagnosisMedia({
        diagnosisImages: [{ imageMimeType: 'image/jpeg', imageStoragePath: 'p.jpg' }],
      }),
      true
    );
  });

  it('is false for text-only input', () => {
    assert.equal(hasDiagnosisMedia({}), false);
  });
});

describe('aiReuseService with media', () => {
  it('peekMatch returns false when hasMedia is true', async () => {
    const match = await aiReuseService.peekMatch({
      farmerId: baseInput.farmerId,
      cropType: 'ginger',
      symptomsText: 'yellow spots on leaves',
      hasMedia: true,
    });
    assert.equal(match, false);
  });

  it('tryReuse returns null when imageBase64 is present', async () => {
    const result = await aiReuseService.tryReuse(
      {
        ...baseInput,
        imageBase64: 'fakebase64',
        imageMimeType: 'image/jpeg',
      },
      '00000000-0000-0000-0000-000000000099'
    );
    assert.equal(result, null);
  });

  it('tryReuse returns null when only imageStoragePath is present', async () => {
    const result = await aiReuseService.tryReuse(
      {
        ...baseInput,
        imageStoragePath: 'advisory-images/farmer/photo.jpg',
      },
      '00000000-0000-0000-0000-000000000099'
    );
    assert.equal(result, null);
  });
});

describe('whatsapp diagnosis renderer — image evidence guard', () => {
  const genericSummary: StructuredAdvisory = {
    probableIssue: 'Nutrient deficiency or fungal leaf spot',
    confidence: 0.72,
    uncertain: false,
    severity: 'moderate',
    nutrientDeficiency: [],
    stressAnalysis: [],
    treatments: [],
    dosageGuidance: [],
    precautions: [],
    escalationRecommended: false,
    farmerSummaryEn:
      'Hi! Thanks for the images. Could be deficiency or fungus. Check drainage and spray foliar feed.',
    farmerSummaryMl: '',
    recommendedProductTags: [],
    imageObservations: [],
    differentialDiagnosis: [],
  };

  it('requiresImageEvidence avoids bare farmerSummary template', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: genericSummary,
      language: 'en',
      requiresImageEvidence: true,
    });
    assert.doesNotMatch(text, /Thanks for the images/);
    assert.doesNotMatch(text, /foliar feed/);
    assert.match(text, /closer photo|affected leaves/i);
    assert.match(text, /Primary issue|Nutrient deficiency/);
  });

  it('allows rich diagnosis when imageObservations are present', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: {
        ...genericSummary,
        imageObservations: ['Yellow-brown circular lesions on mid-canopy leaves'],
        dosageGuidance: [
          { product: 'NeemAzad', rate: '2 ml/L', method: 'Foliar', frequency: 'weekly' },
        ],
      },
      language: 'en',
      requiresImageEvidence: true,
    });
    assert.match(text, /What I see/);
    assert.match(text, /Yellow-brown circular/);
  });
});

describe('mergeImageBatchCaption', () => {
  it('merges caption into pending batch', async () => {
    const farmerId = '00000000-0000-0000-0000-000000000002';
    scheduleImageBatch(
      {
        farmerId,
        phone: '+910000000000',
        language: 'en',
        isPremium: false,
        image: {
          imageBase64: 'abc',
          imageMimeType: 'image/jpeg',
          contentHash: 'hash1',
        },
        sendText: async () => {},
      },
      async () => {}
    );
    assert.equal(whatsappImageBatchPendingCount(farmerId), 1);
    assert.equal(mergeImageBatchCaption(farmerId, 'yellow spots on leaves'), true);
  });
});
