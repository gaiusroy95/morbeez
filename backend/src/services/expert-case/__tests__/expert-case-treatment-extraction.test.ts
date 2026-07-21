import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { draftNeedsDilutionClarification, emptyExpertCaseDraft } from '@morbeez/shared/expert-case';
import { applyOpenImagesIntent } from '../expert-case-copilot-simulation.service.js';
import {
  parseDilutionVolumeL,
  parseTreatmentActivitiesFromMessage,
  supplementTreatmentDraft,
} from '../expert-case-treatment-extraction.service.js';

describe('Expert treatment extraction', () => {
  it('parses dilution volume in liters from free text', () => {
    assert.equal(parseDilutionVolumeL('Use 200 liter dilution'), 200);
    assert.equal(parseDilutionVolumeL('200 L water'), 200);
    assert.equal(parseDilutionVolumeL('spray in 200-litre tank'), 200);
  });

  it('splits composite spray and drench recommendations into activities', () => {
    const message =
      'Spray 1kg 13:00:45 with 300 ml tebuconazole + Trifloxystrobin and drench 4 kg SOP with micronutrient mixture every 10 days';
    const activities = parseTreatmentActivitiesFromMessage(message);
    assert.ok(activities.length >= 2);
    assert.ok(activities.some((row) => /spray/i.test(String(row.method))));
    assert.ok(activities.some((row) => /drench/i.test(String(row.method))));
  });

  it('asks for dilution when foliar spray has no water volume', () => {
    const draft = supplementTreatmentDraft(
      emptyExpertCaseDraft(),
      'Spray Azoxystrobin 300 ml foliar'
    );
    assert.equal(draftNeedsDilutionClarification(draft), true);
    assert.ok((draft.unresolvedFields ?? []).includes('dilutionVolume'));
  });

  it('records dilution volume when provided in the same message', () => {
    const draft = supplementTreatmentDraft(
      emptyExpertCaseDraft(),
      'Spray 300 ml fungicide in 200 liter water and drench 4 kg SOP'
    );
    assert.equal(draft.sprayVolumeL, 200);
    assert.equal(draftNeedsDilutionClarification(draft), false);
    assert.ok((draft.treatmentActivities?.length ?? 0) >= 2);
  });
});

describe('Open images intent', () => {
  it('attaches briefing image URLs to the draft for the UI gallery', () => {
    const result = applyOpenImagesIntent(emptyExpertCaseDraft(), {
      imageCount: 2,
      images: [
        { url: 'https://example.com/a.jpg', label: 'Leaf' },
        { url: 'https://example.com/b.jpg', label: 'Field' },
      ],
    });
    assert.equal(result.draft.imageAnalysis?.imagesOpened, true);
    assert.equal(result.draft.imageAnalysis?.images?.length, 2);
  });
});
