import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getNextWizardStep } from '../../packages/shared/src/visit-wizard/step-flow.js';

describe('visit wizard step flow', () => {
  it('does not skip Q&A after triage before initial screening', () => {
    const next = getNextWizardStep('aiTriage', {
      issues: [],
      triage: {
        level: 'L2',
        reason: 'Moderate symptoms',
        route: 'standard',
        mandatoryFollowUp: true,
        blockAutoApprove: false,
      },
    });
    assert.equal(next, 'followUp');
  });

  it('does not skip Q&A when issues lack aiCaseId', () => {
    const next = getNextWizardStep('aiTriage', {
      issues: [{ issueName: 'Yellow leaves', category: 'nutrient_deficiency' } as never],
      triage: {
        level: 'L2',
        reason: 'Moderate symptoms',
        route: 'standard',
        mandatoryFollowUp: true,
        blockAutoApprove: false,
      },
    });
    assert.equal(next, 'followUp');
  });

  it('advances from Q&A to AI analysis after screening', () => {
    const next = getNextWizardStep('followUp', {
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
    assert.equal(next, 'aiAnalysis');
  });
});
