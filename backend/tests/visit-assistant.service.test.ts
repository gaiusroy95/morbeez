import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VISIT_ASSISTANT_CONTRACT_VERSION,
  validateVisitAssistantProposalResponse,
  type VisitAssistantFieldProposal,
  type VisitAssistantProposalResponse,
  type VisitAssistantSnapshot,
} from '@morbeez/shared/visit-assistant';
import {
  buildVisitAssistantFallback,
  normalizeVisitAssistantProposal,
} from '../src/services/agronomist/visit-assistant.service.js';

function proposed<T>(value: T): VisitAssistantFieldProposal<T> {
  return {
    value,
    confidence: 'high',
    provenance: 'agronomist_message',
    evidence: [{ kind: 'message', messageId: 'current-message' }],
  };
}

function snapshot(): VisitAssistantSnapshot {
  return {
    contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
    revision: 7,
    messages: [],
    history: [],
    draft: {
      assessments: {},
      measurements: {},
      issues: [],
      recommendationGroups: [],
      monitoring: [],
      followUps: [],
      safetyConfirmation: null,
    },
  };
}

function response(operations: VisitAssistantProposalResponse['operations']): VisitAssistantProposalResponse {
  return {
    contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
    proposalId: 'proposal-1',
    baseRevision: 7,
    messages: [],
    operations,
    clarifications: [],
    unresolvedFields: [],
  };
}

const context = {
  snapshot: snapshot(),
  userMessageId: 'current-message',
  issueMaster: [{
    id: 'master-1',
    category: 'disease',
    issueName: 'Rhizome Rot',
    conceptCode: null,
    cropType: 'ginger',
  }],
  measurementTemplates: [{
    id: 'template-1',
    cropType: 'ginger',
    measurementKey: 'soil_ph',
    labelEn: 'Soil pH',
    labelMl: null,
    unit: null,
    inputType: 'number',
    options: [],
    required: false,
    sortOrder: 1,
  }],
};

describe('visit assistant proposal normalization', () => {
  it('canonicalizes issue names and categories', () => {
    const result = normalizeVisitAssistantProposal(response([{
      id: 'operation-1',
      kind: 'issue.add',
      issue: {
        category: proposed('other'),
        issueName: proposed('rhizome-rot'),
        severity: proposed('high'),
      },
    }]), context);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    const operation = result.value.operations[0];
    assert.equal(operation.kind, 'issue.add');
    if (operation.kind === 'issue.add') {
      assert.equal(operation.issue.issueName.value, 'Rhizome Rot');
      assert.equal(operation.issue.category.value, 'disease');
    }
  });

  it('rejects stale revisions, unknown evidence, and noncanonical measurements', () => {
    const proposal = response([{
      id: 'operation-1',
      kind: 'measurement.set',
      key: 'made_up_key',
      proposed: {
        ...proposed('12'),
        evidence: [{ kind: 'message', messageId: 'unknown-message' }],
      },
    }]);
    proposal.baseRevision = 6;

    const result = normalizeVisitAssistantProposal(proposal, context);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.join(' '), /baseRevision/);
    assert.match(result.errors.join(' '), /unknown measurement key/);
    assert.match(result.errors.join(' '), /unknown message evidence/);
  });

  it('rejects arbitrary update references', () => {
    const result = normalizeVisitAssistantProposal(response([{
      id: 'operation-1',
      kind: 'issue.update',
      issueRef: 'invented-issue',
      changes: { severity: proposed('medium') },
    }]), context);

    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors.join(' '), /unknown issueRef/);
  });

  it('rejects invented recommendation identities', () => {
    const result = normalizeVisitAssistantProposal(response([{
      id: 'operation-1',
      kind: 'recommendation.material.add',
      groupRef: 'invented-group',
      material: {
        issueRef: 'invented-issue',
        category: proposed('fungicide'),
        technicalName: proposed('Mancozeb'),
      },
    }]), context);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.join(' '), /unknown groupRef/);
    assert.match(result.errors.join(' '), /unknown issueRef/);
  });

  it('repairs malformed extraction with a safe non-actioning fallback', () => {
    const malformed = {
      ...response([]),
      operations: [{ id: 'approve', kind: 'recommendation.approve' }],
      submit: true,
    };
    assert.equal(validateVisitAssistantProposalResponse(malformed).ok, false);

    const fallback = buildVisitAssistantFallback(snapshot());
    assert.equal(validateVisitAssistantProposalResponse(fallback).ok, true);
    assert.equal(fallback.baseRevision, 7);
    assert.equal(fallback.operations.length, 0);
    assert.equal(fallback.clarifications.length, 1);
    assert.equal(fallback.unresolvedFields.length, 1);
    assert.equal(fallback.clarifications[0]?.required, true);
    assert.equal(fallback.unresolvedFields[0]?.reason, 'missing_information');
    assert.match(fallback.messages[0]?.content ?? '', /provide the specific/i);
    assert.equal('submit' in fallback, false);
    assert.equal('approved' in fallback, false);
  });
});
