import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VISIT_ASSISTANT_CONTRACT_VERSION,
  type VisitAssistantFieldProposal,
  type VisitAssistantProposalResponse,
} from '../../../packages/shared/src/visit-assistant/index.js';
import {
  applyAcceptedOperationsToWizard,
  buildVisitAssistantSnapshot,
  emptyVisitAssistantState,
  mapSnapshotDraftToWizard,
  parseVisitAssistantState,
  type WizardAssistantSource,
} from '../lib/visitAssistantBridge';

function proposed<T>(value: T): VisitAssistantFieldProposal<T> {
  return {
    value,
    confidence: 'high',
    provenance: 'agronomist_message',
    evidence: [{ kind: 'message', messageId: 'm1' }],
  };
}

function wizard(overrides: Partial<WizardAssistantSource> = {}): WizardAssistantSource {
  return {
    blockHealth: 'average',
    cropPerformance: 'as_expected',
    soilMoisture: 'optimal',
    visitClassification: 'first',
    measurements: { plant_height: '30' },
    fieldVoiceNote: 'yellow tips',
    issues: [
      {
        localId: 'issue-1',
        category: 'disease',
        issueName: 'Leaf spot',
        severity: 'medium',
        status: 'open',
        observation: 'scattered',
        photosPreview: [],
      },
    ],
    recommendationGroups: [
      {
        localId: 'group-1',
        applicationType: 'foliar_spray',
        applicationDay: 0,
        sortOrder: 0,
        materials: [
          {
            localId: 'mat-1',
            issueLocalId: 'issue-1',
            category: 'fungicide',
            technicalName: 'Mancozeb',
            doseQuantity: '2',
            doseUnit: 'KG',
            doseBasis: 'per_acre',
            applicationMode: 'foliar',
          },
        ],
      },
    ],
    monitoringPlan: [
      {
        localId: 'mon-1',
        issueLocalId: 'issue-1',
        issueLabel: 'Leaf spot',
        intervalDays: 7,
        checkType: 'field_monitoring',
        severity: 'medium',
      },
    ],
    followUps: [
      {
        recommendationId: 'rec-1',
        label: 'Prior spray',
        followed: 'yes',
        outcome: 'improved',
        notes: '',
      },
    ],
    ...overrides,
  };
}

describe('visit assistant bridge snapshot',
  () => {
    it('maps wizard localIds to snapshot refs without inventing ids',
      () => {
        const source = wizard();
        const snapshot = buildVisitAssistantSnapshot(source, emptyVisitAssistantState());

        assert.equal(snapshot.contractVersion, VISIT_ASSISTANT_CONTRACT_VERSION);
        assert.equal(snapshot.draft.issues[0]?.ref, 'issue-1');
        assert.equal(snapshot.draft.recommendationGroups[0]?.ref, 'group-1');
        assert.equal(snapshot.draft.recommendationGroups[0]?.materials[0]?.ref, 'mat-1');
        assert.equal(snapshot.draft.recommendationGroups[0]?.materials[0]?.issueRef, 'issue-1');
        assert.equal(snapshot.draft.monitoring[0]?.ref, 'mon-1');
        assert.equal(snapshot.draft.followUps[0]?.recommendationRef, 'rec-1');
        assert.equal(snapshot.draft.assessments.blockHealth?.value, 'average');
        assert.equal(snapshot.draft.fieldNote?.value, 'yellow tips');
        assert.equal(snapshot.draft.measurements.plant_height?.value, '30');
      });

    it('parses persisted assistantState safely',
      () => {
        const parsed = parseVisitAssistantState({
          revision: 4,
          messages: [{ id: 'm1', role: 'agronomist', content: 'hi', createdAt: 't' }],
          filledKeys: ['fieldNote'],
          rejectedOperationIds: ['op-1'],
        });
        assert.equal(parsed.revision, 4);
        assert.equal(parsed.messages.length, 1);
        assert.deepEqual(parsed.filledKeys, ['fieldNote']);
        assert.equal(parseVisitAssistantState(null).revision, 0);
      });
  });

describe('visit assistant bridge apply mapping',
  () => {
    it('applies accepted ops back onto wizard setters shape using assistant refs as localIds',
      () => {
        const source = wizard();
        const assistant = emptyVisitAssistantState();
        const proposal: VisitAssistantProposalResponse = {
          contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
          proposalId: 'proposal-1',
          baseRevision: 0,
          messages: [
            {
              id: 'a1',
              role: 'assistant',
              content: 'Updated note and assessment.',
              createdAt: '2026-07-17T00:00:00.000Z',
            },
          ],
          operations: [
            {
              id: 'op-note',
              kind: 'field_note.set',
              proposed: proposed('Assistant note'),
            },
            {
              id: 'op-assess',
              kind: 'assessment.set',
              field: 'blockHealth',
              proposed: proposed('good'),
            },
            {
              id: 'op-issue',
              kind: 'issue.add',
              issue: {
                category: proposed('pest'),
                issueName: proposed('Thrips'),
                severity: proposed('low'),
                observation: proposed('leaf curling'),
              },
            },
          ],
          clarifications: [],
          unresolvedFields: [],
        };

        const { applyResult, patch, nextAssistant } = applyAcceptedOperationsToWizard(
          source,
          assistant,
          proposal,
          { acceptedOperationIds: ['op-note', 'op-assess', 'op-issue'] }
        );

        assert.equal(applyResult.ok, true);
        assert.ok(patch);
        assert.equal(patch!.fieldVoiceNote, 'Assistant note');
        assert.equal(patch!.blockHealth, 'good');
        assert.equal(patch!.issues.length, 2);
        assert.equal(patch!.issues[0]?.localId, 'issue-1');
        assert.equal(patch!.issues[1]?.localId, 'assistant:proposal-1:op-issue');
        assert.equal(patch!.issues[1]?.issueName, 'Thrips');
        assert.equal(nextAssistant.revision, 1);
        assert.equal(nextAssistant.pendingProposal, null);
        assert.ok(nextAssistant.filledKeys.includes('fieldNote'));
      });

    it('invalidates recApproved for recommendation changes and preserves prior issue extras',
      () => {
        const source = wizard({
          issues: [
            {
              localId: 'issue-1',
              category: 'disease',
              issueName: 'Leaf spot',
              severity: 'medium',
              status: 'open',
              observation: 'scattered',
              photosPreview: [],
              aiCaseId: 'case-9',
              finalDiagnosis: 'Leaf spot',
            },
          ],
        });
        const snapshot = buildVisitAssistantSnapshot(source, {
          ...emptyVisitAssistantState(),
          revision: 2,
        });
        snapshot.draft.recommendationGroups[0]!.applicationDay = {
          value: 7,
          confidence: 'high',
          provenance: 'assistant_inference',
          evidence: [],
          updatedAtRevision: 3,
        };
        const patch = mapSnapshotDraftToWizard(
          { ...snapshot, revision: 3 },
          source,
          [
            {
              id: 'op-rec',
              kind: 'recommendation.group.update',
              groupRef: 'group-1',
              changes: { applicationDay: proposed(7) },
            },
          ],
          true
        );

        assert.equal(patch.clearRecApproved, true);
        assert.equal(patch.issues[0]?.aiCaseId, 'case-9');
        assert.equal(patch.issues[0]?.finalDiagnosis, 'Leaf spot');
        assert.equal(patch.recommendationGroups[0]?.applicationDay, 7);
        assert.equal(patch.recommendationGroups[0]?.localId, 'group-1');
        assert.equal(patch.followUps[0]?.label, 'Prior spray');
      });

    it('requires critical confirmation for high-severity issue adds',
      () => {
        const { applyResult } = applyAcceptedOperationsToWizard(
          wizard(),
          emptyVisitAssistantState(),
          {
            contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
            proposalId: 'proposal-2',
            baseRevision: 0,
            messages: [],
            operations: [
              {
                id: 'op-critical',
                kind: 'issue.add',
                issue: {
                  category: proposed('disease'),
                  issueName: proposed('Blight'),
                  severity: proposed('high'),
                },
              },
            ],
            clarifications: [],
            unresolvedFields: [],
          },
          { acceptedOperationIds: ['op-critical'] }
        );

        assert.equal(applyResult.ok, false);
        if (!applyResult.ok) {
          assert.equal(applyResult.error.code, 'critical_confirmation_required');
        }
      });

    it('rejects a stale proposal without changing wizard or assistant state',
      () => {
        const assistant = {
          ...emptyVisitAssistantState(),
          revision: 2,
        };
        const result = applyAcceptedOperationsToWizard(
          wizard(),
          assistant,
          {
            contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
            proposalId: 'proposal-stale',
            baseRevision: 1,
            messages: [],
            operations: [{
              id: 'op-note',
              kind: 'field_note.set',
              proposed: proposed('Must not be applied'),
            }],
            clarifications: [],
            unresolvedFields: [],
          },
          { acceptedOperationIds: ['op-note'] }
        );

        assert.equal(result.applyResult.ok, false);
        if (!result.applyResult.ok) {
          assert.equal(result.applyResult.error.code, 'stale_base_revision');
        }
        assert.equal(result.patch, undefined);
        assert.equal(result.nextAssistant, assistant);
        assert.equal(result.nextAssistant.revision, 2);
      });
  });
