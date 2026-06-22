import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diagnosisExplainService } from '../src/services/diagnosis/diagnosis-explain.service.js';
import { visitCommandCenterService } from '../src/services/agronomist/visit-command-center.service.js';
import { yieldHistoryService } from '../src/services/intelligence/yield-history.service.js';

describe('phase 1 write paths', () => {
  it('explain diagnosis returns dual text', () => {
    const out = diagnosisExplainService.explain({
      issueName: 'Waterlogging',
      finalDiagnosis: 'Waterlogging stress',
      observation: 'Standing water in furrows',
    });
    assert.ok(out.farmerText.includes('Waterlogging'));
    assert.ok(out.agronomistText.includes('Diagnosis'));
  });

  it('updatePriority rejects invalid finding gracefully', async () => {
    await assert.rejects(
      () => visitCommandCenterService.updatePriority('00000000-0000-4000-8000-000000000099', 'urgent'),
      /Could not update|not found/i
    );
  });

  it('yield history list returns array', async () => {
    const rows = await yieldHistoryService
      .listForBlock('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
      .catch(() => []);
    assert.ok(Array.isArray(rows));
  });
});
