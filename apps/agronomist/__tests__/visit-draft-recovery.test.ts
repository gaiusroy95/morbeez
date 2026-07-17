import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDraftPayload,
  buildDraftSyncEnvelope,
} from '../../../packages/shared/src/visit-wizard/draft-sync';
import { hydrateServerVisitDraft, newestVisitDraft } from '../lib/visitDraftRecovery';

describe('visit draft recovery', () => {
  it('builds the backend draft envelope without flattening wizard data', () => {
    const draft = buildDraftPayload({
      farmerId: 'farmer-1',
      blockId: 'block-1',
      currentStep: 'farmerCommunication',
      fieldVoiceNote: 'yellow leaves',
      whatsappConfirmed: true,
    });

    const envelope = buildDraftSyncEnvelope(draft);

    assert.deepEqual(Object.keys(envelope).sort(), [
      'blockId',
      'currentStep',
      'farmerId',
      'payload',
      'wizardVersion',
    ]);
    assert.equal(envelope.currentStep, 'farmerCommunication');
    assert.equal(envelope.payload.fieldVoiceNote, 'yellow leaves');
    assert.equal(envelope.payload.whatsappConfirmed, true);
    assert.equal('farmerId' in envelope.payload, false);
  });

  it('hydrates server metadata and chooses the newest saved draft', () => {
    const server = hydrateServerVisitDraft({
      session_id: 'session-1',
      farmer_id: 'farmer-1',
      block_id: 'block-1',
      current_step: 'scheduleCompatibility',
      wizard_version: 'v12',
      saved_at: '2026-07-17T00:02:00.000Z',
      payload: {
        savedAt: '2026-07-17T00:01:00.000Z',
        recApproved: true,
        selectedRecommendationOptionId: 'option-2',
      },
    });

    assert.equal(server?.sessionId, 'session-1');
    assert.equal(server?.currentStep, 'scheduleCompatibility');
    assert.equal(server?.recApproved, true);
    assert.equal(
      newestVisitDraft(
        {
          farmerId: 'farmer-1',
          blockId: 'block-1',
          savedAt: '2026-07-17T00:00:00.000Z',
        },
        server
      ),
      server
    );
  });

  it('round-trips assistantState through sync and server hydration', () => {
    const assistantState = {
      revision: 4,
      messages: [{ id: 'm1', role: 'assistant', content: 'Drafted an update', createdAt: 't' }],
      filledKeys: ['fieldNote'],
      rejectedOperationIds: ['op-rejected'],
      pendingProposal: null,
    };
    const draft = buildDraftPayload({
      farmerId: 'farmer-1',
      blockId: 'block-1',
      assistantState,
    });
    const envelope = buildDraftSyncEnvelope(draft);
    const hydrated = hydrateServerVisitDraft({
      session_id: 'session-1',
      farmer_id: envelope.farmerId,
      block_id: envelope.blockId,
      current_step: envelope.currentStep,
      wizard_version: envelope.wizardVersion,
      saved_at: draft.savedAt,
      payload: envelope.payload,
    });

    assert.deepEqual(envelope.payload.assistantState, assistantState);
    assert.deepEqual(hydrated?.assistantState, assistantState);
  });
});
