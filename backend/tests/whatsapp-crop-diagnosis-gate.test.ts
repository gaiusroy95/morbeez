import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasUsableCropPhotoEvidence,
  observationIndicatesNoCrop,
} from '../src/services/whatsapp/pipeline/crop-photo-evidence.util.js';
import { sanitizeAdvisoryForFarmerWhatsApp } from '../src/services/ai/advisory-farmer-sanitize.util.js';
import { cropDoctorFarmerReportService } from '../src/services/ai/crop-doctor-farmer-report.service.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';
import { farmActivityDraftSummaryForTest } from '../src/services/farm-activity/farm-activity-assistant.service.js';
import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
} from '@morbeez/shared/farm-activity-assistant';

function field<T>(value: T): FarmActivityAssistantField<T> {
  return {
    value,
    confidence: 'high',
    provenance: ['explicit_text'],
    sourceRefs: ['message-1'],
  };
}

function unresolved<T>(detail: string): FarmActivityAssistantField<T> {
  return {
    value: null,
    confidence: 'low',
    provenance: ['assistant_inference'],
    sourceRefs: ['message-1'],
    unresolved: { reason: 'missing', detail },
  };
}

function baseAdvisory(partial: Partial<StructuredAdvisory>): StructuredAdvisory {
  return {
    probableIssue: 'Field issue',
    confidence: 0.7,
    uncertain: false,
    nutrientDeficiency: [],
    stressAnalysis: [],
    treatments: [],
    dosageGuidance: [],
    precautions: [],
    escalationRecommended: false,
    farmerSummaryEn: 'Summary',
    farmerSummaryMl: 'സംഗ്രഹം',
    recommendedProductTags: [],
    ...partial,
  };
}

describe('crop photo evidence', () => {
  it('rejects no-crop observation lists', () => {
    assert.equal(observationIndicatesNoCrop('No crop image provided'), true);
    assert.equal(
      hasUsableCropPhotoEvidence([
        'No crop image provided',
        'No visible crop or leaf tissue',
      ]),
      false
    );
  });

  it('accepts lesion observations', () => {
    assert.equal(
      hasUsableCropPhotoEvidence([
        'Brown spindle lesions on upper leaf',
        'Yellow halo around necrotic spots',
      ]),
      true
    );
  });
});

describe('farmer WhatsApp advisory sanitize', () => {
  it('blocks diagnosis and strips anthracnose when photo shows no crop', () => {
    const advisory = baseAdvisory({
      probableIssue: 'Potassium Deficiency',
      confidence: 0.72,
      severity: 'moderate',
      imageObservations: ['No crop image provided', 'Product bag visible'],
      contributingFactor: 'Anthracnose / fungal leaf spot',
      diagnosisRanked: [
        { role: 'primary', label: 'Potassium Deficiency', probability: 0.7, stars: 4 },
        { role: 'contributing', label: 'Anthracnose / fungal leaf spot', probability: 0.4, stars: 2 },
      ],
      farmerSummaryEn: 'Potassium deficiency with fungal risk',
    });

    const { advisory: cleaned, blockDiagnosis, reason } = sanitizeAdvisoryForFarmerWhatsApp(advisory);
    assert.equal(blockDiagnosis, true);
    assert.equal(reason, 'no_usable_crop_photo');
    assert.match(cleaned.probableIssue ?? '', /unable to diagnose/i);
    assert.equal(cleaned.contributingFactor, undefined);
    assert.equal(cleaned.diagnosisRanked?.length ?? 0, 0);

    const reported = cropDoctorFarmerReportService.attachReports(advisory, {
      cropType: 'Ginger',
      location: 'Wayanad',
    });
    assert.match(reported.farmerReport ?? '', /unable to diagnose/i);
    assert.doesNotMatch(reported.farmerReport ?? '', /anthracnose/i);
    assert.match(reported.farmerReport ?? '', /close photo/i);
  });

  it('strips weather-only anthracnose contributing factor even with crop photo if no lesions', () => {
    const advisory = baseAdvisory({
      probableIssue: 'Potassium Deficiency',
      severity: 'mild',
      imageObservations: ['Uniform yellowing on older leaves', 'Pale canopy without dark margins'],
      contributingFactor: 'Anthracnose / fungal leaf spot',
      farmerSummaryEn: 'K deficiency',
    });
    const { advisory: cleaned, blockDiagnosis } = sanitizeAdvisoryForFarmerWhatsApp(advisory);
    assert.equal(blockDiagnosis, false);
    assert.equal(cleaned.contributingFactor, undefined);
  });
});

describe('farm activity draft summary', () => {
  it('omits empty date and block placeholders', () => {
    const draft: FarmActivityAssistantDraftV1 = {
      contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
      draftId: 'd1',
      revision: 1,
      source: {
        messageId: 'message-1',
        channel: 'whatsapp',
        text: 'Applied DAP 99',
        language: { code: 'en-IN', detected: true, confidence: 'high' },
        media: [],
        transcript: [],
      },
      clarifications: [],
      subEvents: [
        {
          id: 'e1',
          sequence: 1,
          sourceRefs: ['message-1'],
          kind: 'activity',
          activityType: field('fertilizer'),
          description: field('Applied DAP 99'),
          occurredOn: unresolved('no date'),
          blockRef: unresolved('no block'),
          quantity: unresolved('n/a'),
          unit: unresolved('n/a'),
        },
      ],
    };

    const summary = farmActivityDraftSummaryForTest.summarizeDraft(draft, 'en');
    assert.match(summary, /Applied DAP 99/);
    assert.doesNotMatch(summary, /\|\s*—/);
    assert.doesNotMatch(summary, /block\s*—/i);
  });
});
