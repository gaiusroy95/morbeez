import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { draftHasTreatment, draftValidationChecklist, emptyExpertCaseDraft, mergeExpertCaseDraft, } from '@morbeez/shared/expert-case';
import { applyLabelDoseIntent, applyOpenImagesIntent, buildCopilotValidations, detectCopilotIntent, enrichDraftAfterExtraction, parseFarmerAnswerMessage, } from '../expert-case-copilot-simulation.service.js';
describe('Expert Copilot simulation', () => {
    it('detects open-images and annotation intents', () => {
        assert.equal(detectCopilotIntent('Open all images.', null), 'open_images');
        const afterOpen = applyOpenImagesIntent(emptyExpertCaseDraft(), { imageCount: 4 });
        assert.equal(afterOpen.draft.imageAnalysis?.offerAnnotate, true);
        assert.equal(detectCopilotIntent('Yes.', afterOpen.draft), 'enable_annotations');
    });
    it('prefers label-dose Yes over stale annotate offer', () => {
        const afterOpen = applyOpenImagesIntent(emptyExpertCaseDraft(), { imageCount: 4 });
        const withTreatment = enrichDraftAfterExtraction({
            draft: mergeExpertCaseDraft(afterOpen.draft, {
                treatmentProduct: 'Azoxystrobin + Tebuconazole',
                dosage: 'Manufacturer label dose',
                dosageSource: 'pending',
                recommendationText: 'Foliar spray',
            }),
            runValidations: true,
        });
        assert.equal(detectCopilotIntent('Yes', withTreatment), 'apply_label_dose');
    });
    it('builds structured validations after treatment extraction', () => {
        const draft = mergeExpertCaseDraft(emptyExpertCaseDraft(), {
            diagnosis: 'Anthracnose',
            confidence: 0.91,
            secondaryDiagnosis: 'Potassium Deficiency',
            treatmentProduct: 'Azoxystrobin + Tebuconazole',
            dosage: 'Manufacturer label dose',
            dosageSource: 'pending',
            applicationMethod: 'Foliar Spray',
            applicationTiming: 'Tomorrow Morning',
            nutritionProduct: 'SOP',
            nutritionDose: '25 kg/acre',
            precautions: ['Do not mix with copper fungicides'],
            evidence: ['Brown elongated lesions', 'Yellow halo'],
            followUpDays: 7,
        });
        assert.equal(draftHasTreatment(draft), true);
        const enriched = enrichDraftAfterExtraction({
            draft,
            briefing: { soil: { ph: 'Pending', ec: 'Pending', status: 'pending' } },
            runValidations: true,
        });
        assert.ok(enriched.validations?.compatibility?.length);
        assert.equal(enriched.validations?.dosage?.askLabelDose, true);
        assert.ok((enriched.farmerQuestions?.length ?? 0) >= 2);
        assert.ok(draftValidationChecklist(enriched).includes('Treatment Generated'));
    });
    it('applies registered label dose and parses farmer answers', () => {
        const draft = enrichDraftAfterExtraction({
            draft: {
                ...emptyExpertCaseDraft(),
                treatmentProduct: 'Azoxystrobin + Tebuconazole',
                dosage: 'label dose',
                dosageSource: 'pending',
                recommendationText: 'Foliar spray',
            },
            runValidations: true,
        });
        assert.equal(detectCopilotIntent('Yes', draft), 'apply_label_dose');
        const applied = applyLabelDoseIntent(draft);
        assert.equal(applied.draft.dosageSource, 'label');
        assert.equal(applied.draft.validations?.dosage?.askLabelDose, false);
        const answers = parseFarmerAnswerMessage('Soil pH 6.7 EC 1.3. No fungicide sprayed recently. Symptoms increased after rain.');
        assert.equal(answers?.soilPh, '6.7');
        assert.equal(answers?.soilEc, '1.3');
        assert.equal(answers?.recentFungicide, 'No');
    });
    it('builds compatibility rows for copper tank-mix caution', () => {
        const validations = buildCopilotValidations({
            ...emptyExpertCaseDraft(),
            treatmentProduct: 'Azoxystrobin + Tebuconazole',
            nutritionProduct: 'SOP',
            precautions: ['Do not mix with copper fungicides'],
            dosage: 'label',
            dosageSource: 'label',
        });
        const copper = validations.compatibility?.find((row) => /copper/i.test(row.product));
        assert.equal(copper?.status, 'fail');
    });
    it('localizes open-images messages for Malayalam UI', () => {
        const afterOpen = applyOpenImagesIntent(emptyExpertCaseDraft(), { imageCount: 4 }, 'ml');
        assert.match(afterOpen.assistantMessage, /ഫോട്ടോ|ലോഡ്/);
    });
});
//# sourceMappingURL=expert-case-copilot-simulation.test.js.map