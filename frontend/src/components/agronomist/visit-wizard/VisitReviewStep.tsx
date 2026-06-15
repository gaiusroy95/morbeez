import { useState } from 'react';
import {
  agronomistClient,
  defaultEvidenceQuestions,
  validateRejectReasonFlow,
  visitAiCaseStatusLabel,
  type AgronomistReviewAction,
  type VisitAiRejectReason,
} from '@morbeez/shared';
import { Alert, Btn, Field, Input, Panel, textareaClass } from '../../ui';
import type { VisitIssueDraft } from './types';
import { VisitRejectCustomRecStep } from './reject/VisitRejectCustomRecStep';
import { VisitRejectEditRecStep } from './reject/VisitRejectEditRecStep';
import { VisitRejectEvidenceStep } from './reject/VisitRejectEvidenceStep';
import { VisitRejectReasonStep } from './reject/VisitRejectReasonStep';
import { VisitRejectWrongDiagnosisStep } from './reject/VisitRejectWrongDiagnosisStep';

const REVIEW_ACTIONS: Array<{ value: AgronomistReviewAction; label: string }> = [
  { value: 'approve_ai', label: 'Approve' },
  { value: 'correct_ai', label: 'Modify' },
  { value: 'partial_match', label: 'Partial' },
];

type Props = {
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitReviewStep({ issues, onChange }: Props) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [flowError, setFlowError] = useState('');

  function patchIssue(index: number, patch: Partial<VisitIssueDraft>) {
    const next = [...issues];
    const current = next[index]!;
    const action = patch.agronomistReview?.action ?? current.agronomistReview?.action ?? 'approve_ai';
    next[index] = {
      ...current,
      ...patch,
      agronomistReview: {
        action,
        finalDiagnosis: patch.finalDiagnosis ?? current.finalDiagnosis ?? current.agronomistReview?.finalDiagnosis,
        finalRecommendation:
          patch.finalRecommendation ??
          current.finalRecommendation ??
          current.agronomistReview?.finalRecommendation,
        modificationReason:
          patch.agronomistReview?.modificationReason ?? current.agronomistReview?.modificationReason,
        agronomistConfidence:
          patch.agronomistReview?.agronomistConfidence ?? current.agronomistReview?.agronomistConfidence,
        yieldRisk: patch.agronomistReview?.yieldRisk ?? current.agronomistReview?.yieldRisk,
        rejectReason: patch.agronomistReview?.rejectReason ?? current.agronomistReview?.rejectReason,
        rejectNote: patch.agronomistReview?.rejectNote ?? current.agronomistReview?.rejectNote,
        correctedDiagnosis:
          patch.agronomistReview?.correctedDiagnosis ?? current.agronomistReview?.correctedDiagnosis,
        evidenceRequest: patch.agronomistReview?.evidenceRequest ?? current.agronomistReview?.evidenceRequest,
        customRecommendation:
          patch.agronomistReview?.customRecommendation ?? current.agronomistReview?.customRecommendation,
        rejectFlowComplete:
          patch.agronomistReview?.rejectFlowComplete ?? current.agronomistReview?.rejectFlowComplete,
        ...patch.agronomistReview,
      },
    };
    onChange(next);
  }

  function startRejectFlow(index: number) {
    setFlowError('');
    patchIssue(index, {
      reviewSubStep: 'reject_reason',
      agronomistReview: {
        action: 'reject_recommendation',
        rejectFlowComplete: false,
        finalDiagnosis: issues[index]!.finalDiagnosis,
        finalRecommendation: issues[index]!.finalRecommendation,
      },
    });
  }

  function selectRejectReason(index: number, reason: VisitAiRejectReason) {
    setFlowError('');
    const issue = issues[index]!;
    const evidenceRequest =
      reason === 'need_more_evidence'
        ? { photoTypes: [] as string[], questions: defaultEvidenceQuestions() }
        : issue.agronomistReview?.evidenceRequest;
    const customRecommendation =
      reason === 'custom_recommendation'
        ? { product: '', dose: '', method: '', reviewDate: '' }
        : issue.agronomistReview?.customRecommendation;
    patchIssue(index, {
      reviewSubStep: 'reject_flow',
      agronomistReview: {
        action: 'reject_recommendation',
        rejectReason: reason,
        rejectFlowComplete: false,
        evidenceRequest,
        customRecommendation,
        correctedDiagnosis: reason === 'wrong_diagnosis' ? '' : issue.agronomistReview?.correctedDiagnosis,
        rejectNote: reason === 'recommendation_not_suitable' ? '' : issue.agronomistReview?.rejectNote,
        finalDiagnosis: issue.finalDiagnosis,
        finalRecommendation: issue.finalRecommendation,
      },
    });
  }

  function backInRejectFlow(index: number) {
    setFlowError('');
    const issue = issues[index]!;
    if (issue.reviewSubStep === 'reject_flow') {
      patchIssue(index, { reviewSubStep: 'reject_reason' });
      return;
    }
    patchIssue(index, {
      reviewSubStep: 'decision',
      agronomistReview: {
        action: 'approve_ai',
        rejectFlowComplete: false,
        rejectReason: undefined,
        finalDiagnosis: issue.finalDiagnosis,
        finalRecommendation: issue.finalRecommendation,
      },
    });
  }

  async function completeRejectFlow(index: number) {
    const issue = issues[index]!;
    const reason = issue.agronomistReview?.rejectReason;
    if (!reason || !issue.aiCaseId) {
      setFlowError('Missing AI case for reject workflow.');
      return;
    }
    const validationErr = validateRejectReasonFlow(reason, {
      ...issue.agronomistReview,
      finalRecommendation: issue.finalRecommendation,
    });
    if (validationErr) {
      setFlowError(validationErr);
      return;
    }

    setBusyIndex(index);
    setFlowError('');
    try {
      const body =
        reason === 'wrong_diagnosis'
          ? { reason, correctedDiagnosis: issue.agronomistReview!.correctedDiagnosis!.trim() }
          : reason === 'need_more_evidence'
            ? { reason, evidenceRequest: issue.agronomistReview!.evidenceRequest! }
            : reason === 'recommendation_not_suitable'
              ? {
                  reason,
                  rejectNote: issue.agronomistReview!.rejectNote!.trim(),
                  editedRecommendation: issue.finalRecommendation!.trim(),
                }
              : { reason, customRecommendation: issue.agronomistReview!.customRecommendation! };

      const result = await agronomistClient.rejectVisitAiRecommendation(issue.aiCaseId, body);
      patchIssue(index, {
        reviewSubStep: 'decision',
        visitAiCaseStatus: result.status,
        finalDiagnosis: result.finalDiagnosis ?? issue.finalDiagnosis,
        finalRecommendation: result.finalRecommendation ?? issue.finalRecommendation,
        reviewAfterDays: result.reviewAfterDays ?? issue.reviewAfterDays,
        agronomistReview: {
          action: 'reject_recommendation',
          rejectReason: reason,
          rejectFlowComplete: true,
          rejectNote: issue.agronomistReview?.rejectNote,
          correctedDiagnosis: issue.agronomistReview?.correctedDiagnosis,
          evidenceRequest: issue.agronomistReview?.evidenceRequest,
          customRecommendation: result.customRecommendation ?? issue.agronomistReview?.customRecommendation,
          finalDiagnosis: result.finalDiagnosis ?? issue.finalDiagnosis,
          finalRecommendation: result.finalRecommendation ?? issue.finalRecommendation,
        },
      });
    } catch (e) {
      setFlowError(e instanceof Error ? e.message : 'Could not complete reject workflow');
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <div className="vw-stack">
      {flowError ? <Alert tone="error">{flowError}</Alert> : null}
      {issues.map((issue, index) => {
        const action = issue.agronomistReview?.action ?? 'approve_ai';
        const subStep = issue.reviewSubStep ?? 'decision';
        const inRejectFlow = action === 'reject_recommendation' && subStep !== 'decision';
        const needsReason =
          !inRejectFlow &&
          (action === 'correct_ai' || action === 'partial_match' || action === 'escalate_urgent');
        const showEscalationHint = issue.confidenceAction === 'escalate' || issue.severity === 'high';
        const statusLabel = visitAiCaseStatusLabel(issue.visitAiCaseStatus);

        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {statusLabel ? <span className="vw-status-badge">{statusLabel}</span> : null}
            {showEscalationHint ? (
              <div className="vw-banner vw-banner--warn">
                This case may need senior agronomist review before farmer communication.
              </div>
            ) : null}

            {inRejectFlow ? (
              <>
                <Btn label="Back" variant="secondary" onClick={() => backInRejectFlow(index)} />
                {subStep === 'reject_reason' ? (
                  <VisitRejectReasonStep
                    value={issue.agronomistReview?.rejectReason}
                    onChange={(reason) => selectRejectReason(index, reason)}
                  />
                ) : null}
                {subStep === 'reject_flow' && issue.agronomistReview?.rejectReason === 'wrong_diagnosis' ? (
                  <VisitRejectWrongDiagnosisStep
                    aiDiagnosis={issue.finalDiagnosis ?? issue.issueName}
                    correctedDiagnosis={issue.agronomistReview.correctedDiagnosis ?? ''}
                    onChangeCorrected={(text) =>
                      patchIssue(index, {
                        agronomistReview: {
                          action: 'reject_recommendation',
                          rejectReason: 'wrong_diagnosis',
                          correctedDiagnosis: text,
                          finalDiagnosis: issue.finalDiagnosis,
                          finalRecommendation: issue.finalRecommendation,
                        },
                      })
                    }
                  />
                ) : null}
                {subStep === 'reject_flow' && issue.agronomistReview?.rejectReason === 'need_more_evidence' ? (
                  <VisitRejectEvidenceStep
                    evidenceRequest={
                      issue.agronomistReview.evidenceRequest ?? {
                        photoTypes: [],
                        questions: defaultEvidenceQuestions(),
                      }
                    }
                    onChange={(evidenceRequest) =>
                      patchIssue(index, {
                        agronomistReview: {
                          action: 'reject_recommendation',
                          rejectReason: 'need_more_evidence',
                          evidenceRequest,
                          finalDiagnosis: issue.finalDiagnosis,
                          finalRecommendation: issue.finalRecommendation,
                        },
                      })
                    }
                  />
                ) : null}
                {subStep === 'reject_flow' &&
                issue.agronomistReview?.rejectReason === 'recommendation_not_suitable' ? (
                  <VisitRejectEditRecStep
                    recommendation={issue.finalRecommendation ?? ''}
                    rejectNote={issue.agronomistReview.rejectNote ?? ''}
                    onChangeRecommendation={(text) => patchIssue(index, { finalRecommendation: text })}
                    onChangeNote={(text) =>
                      patchIssue(index, {
                        agronomistReview: {
                          action: 'reject_recommendation',
                          rejectReason: 'recommendation_not_suitable',
                          rejectNote: text,
                          finalDiagnosis: issue.finalDiagnosis,
                          finalRecommendation: issue.finalRecommendation,
                        },
                      })
                    }
                  />
                ) : null}
                {subStep === 'reject_flow' &&
                issue.agronomistReview?.rejectReason === 'custom_recommendation' ? (
                  <VisitRejectCustomRecStep
                    custom={
                      issue.agronomistReview.customRecommendation ?? {
                        product: '',
                        dose: '',
                        method: '',
                      }
                    }
                    onChange={(customRecommendation) =>
                      patchIssue(index, {
                        agronomistReview: {
                          action: 'reject_recommendation',
                          rejectReason: 'custom_recommendation',
                          customRecommendation,
                          finalDiagnosis: issue.finalDiagnosis,
                          finalRecommendation: issue.finalRecommendation,
                        },
                      })
                    }
                  />
                ) : null}
                {subStep === 'reject_flow' ? (
                  <Btn
                    label={busyIndex === index ? 'Saving…' : 'Continue'}
                    onClick={() => void completeRejectFlow(index)}
                    disabled={busyIndex === index}
                  />
                ) : null}
              </>
            ) : (
              <>
                <span className="vw-field-label">Review decision</span>
                <div className="vw-segmented">
                  {REVIEW_ACTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={[
                        'vw-segment',
                        action !== 'reject_recommendation' && action === opt.value ? 'vw-segment--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() =>
                        patchIssue(index, {
                          reviewSubStep: 'decision',
                          agronomistReview: {
                            action: opt.value,
                            rejectFlowComplete: false,
                            rejectReason: undefined,
                            finalDiagnosis: issue.finalDiagnosis,
                            finalRecommendation: issue.finalRecommendation,
                          },
                        })
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="vw-reject-trigger" onClick={() => startRejectFlow(index)}>
                  Reject Recommendation
                </button>
                <Field label="Final diagnosis">
                  <Input
                    value={issue.finalDiagnosis ?? ''}
                    onChange={(e) => patchIssue(index, { finalDiagnosis: e.target.value })}
                  />
                </Field>
                <span className="vw-field-label">Final recommendation</span>
                <textarea
                  className={textareaClass}
                  value={issue.finalRecommendation ?? ''}
                  onChange={(e) => patchIssue(index, { finalRecommendation: e.target.value })}
                />
                {needsReason ? (
                  <Field label="Reason for change">
                    <Input
                      value={issue.agronomistReview?.modificationReason ?? ''}
                      onChange={(e) =>
                        patchIssue(index, {
                          agronomistReview: {
                            action,
                            modificationReason: e.target.value,
                            finalDiagnosis: issue.finalDiagnosis,
                            finalRecommendation: issue.finalRecommendation,
                          },
                        })
                      }
                    />
                  </Field>
                ) : null}
                <Field label="Yield risk (optional)">
                  <Input
                    value={issue.agronomistReview?.yieldRisk ?? ''}
                    onChange={(e) =>
                      patchIssue(index, {
                        agronomistReview: {
                          action,
                          yieldRisk: e.target.value,
                          finalDiagnosis: issue.finalDiagnosis,
                          finalRecommendation: issue.finalRecommendation,
                        },
                      })
                    }
                  />
                </Field>
              </>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
