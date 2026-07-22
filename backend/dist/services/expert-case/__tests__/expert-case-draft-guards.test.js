import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { draftCommitBlockers, draftReadyForCommit, emptyExpertCaseDraft, mergeExpertCaseDraft, } from '@morbeez/shared/expert-case';
describe('Expert case draft commit guards', () => {
    it('blocks commit when diagnosis or treatment missing', () => {
        assert.deepEqual(draftCommitBlockers(emptyExpertCaseDraft()), ['diagnosis', 'treatment']);
        assert.equal(draftReadyForCommit(emptyExpertCaseDraft()), false);
    });
    it('blocks commit when unresolved dilution remains', () => {
        const draft = mergeExpertCaseDraft(emptyExpertCaseDraft(), {
            diagnosis: 'Anthracnose',
            treatmentProduct: 'Fungicide',
            dosage: '300 ml',
            applicationMethod: 'Foliar Spray',
            unresolvedFields: ['dilutionVolume'],
        });
        assert.ok(draftCommitBlockers(draft).some((b) => b.includes('dilution')));
        assert.equal(draftReadyForCommit(draft), false);
    });
    it('allows commit when required fields are complete', () => {
        const draft = mergeExpertCaseDraft(emptyExpertCaseDraft(), {
            diagnosis: 'Anthracnose',
            treatmentProduct: 'Fungicide',
            dosage: '300 ml',
            applicationMethod: 'Foliar Spray',
            sprayVolumeL: 200,
            dosageSource: 'manual',
            validations: {
                dosage: { askLabelDose: false, askDilution: false },
            },
        });
        assert.equal(draftCommitBlockers(draft).length, 0);
        assert.equal(draftReadyForCommit(draft), true);
    });
});
//# sourceMappingURL=expert-case-draft-guards.test.js.map