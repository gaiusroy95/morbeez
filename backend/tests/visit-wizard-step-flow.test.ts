import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getNextWizardStep } from '../../packages/shared/src/visit-wizard/step-flow.js';

describe('visit wizard v12 step flow', () => {
  it('advances intake to photos', () => {
    const next = getNextWizardStep('intakeTriage', { issues: [], triage: null });
    assert.equal(next, 'photos');
  });

  it('does not skip dynamicQA before screening', () => {
    const next = getNextWizardStep('fieldIntelligence', {
      issues: [],
      triage: {
        level: 'L2',
        reason: 'Moderate',
        route: 'standard',
        mandatoryFollowUp: true,
        blockAutoApprove: false,
      },
    });
    assert.equal(next, 'dynamicQA');
  });

  it('skips dynamicQA when confidence threshold met', () => {
    const next = getNextWizardStep('fieldIntelligence', {
      issues: [
        {
          aiCaseId: 'case-1',
          qaSkipped: true,
          skipFollowUpOptional: true,
          confidenceAction: 'auto_send',
          hypotheses: [{ label: 'N deficiency', confidence: 0.9, selected: true }],
        },
      ],
      triage: {
        level: 'L1',
        reason: 'Mild',
        route: 'fast',
        mandatoryFollowUp: false,
        blockAutoApprove: false,
      },
    });
    assert.equal(next, 'aiDiagnosis');
  });

  it('legacy step normalize maps followUp to dynamicQA', async () => {
    const { normalizeVisitWizardStep } = await import('../../packages/shared/src/visit-wizard/index.js');
    assert.equal(normalizeVisitWizardStep('followUp'), 'dynamicQA');
    assert.equal(normalizeVisitWizardStep('overview'), 'intakeTriage');
  });
});
