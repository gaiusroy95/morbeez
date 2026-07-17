import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('visit wizard draft service', () => {
  it('exports upsert and list methods', async () => {
    const mod = await import('../src/services/agronomist/visit-wizard-draft.service.js');
    assert.equal(typeof mod.visitWizardDraftService.upsert, 'function');
    assert.equal(typeof mod.visitWizardDraftService.listByAgent, 'function');
    assert.equal(typeof mod.visitWizardDraftService.getBySessionId, 'function');
    assert.equal(typeof mod.visitWizardDraftService.markSubmitted, 'function');
  });
});
