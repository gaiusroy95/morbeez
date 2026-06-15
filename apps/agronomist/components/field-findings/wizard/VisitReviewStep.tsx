import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  agronomistClient,
  defaultEvidenceQuestions,
  tokens,
  validateRejectReasonFlow,
  visitAiCaseStatusLabel,
  type AgronomistReviewAction,
  type VisitAiRejectReason,
} from '@morbeez/shared';
import { AlertBox, Btn, Panel, TextField, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { SegmentedChips } from '../SegmentedChips';
import type { IssueDraft } from '../IssueCard';
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
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
};

export function VisitReviewStep({ issues, onChange }: Props) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [flowError, setFlowError] = useState('');

  function patchIssue(index: number, patch: Partial<IssueDraft>) {
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
    <View style={styles.root}>
      {flowError ? <AlertBox>{flowError}</AlertBox> : null}
      {issues.map((issue, index) => {
        const action = issue.agronomistReview?.action ?? 'approve_ai';
        const subStep = issue.reviewSubStep ?? 'decision';
        const inRejectFlow = action === 'reject_recommendation' && subStep !== 'decision';
        const needsReason =
          !inRejectFlow &&
          (action === 'correct_ai' || action === 'partial_match' || action === 'escalate_urgent');
        const showEscalationHint =
          issue.confidenceAction === 'escalate' || issue.severity === 'high';
        const statusLabel = visitAiCaseStatusLabel(issue.visitAiCaseStatus);

        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {statusLabel ? (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{statusLabel}</Text>
              </View>
            ) : null}
            {showEscalationHint ? (
              <Text style={styles.escalationHint}>
                This case may need senior agronomist review before farmer communication.
              </Text>
            ) : null}

            {inRejectFlow ? (
              <>
                <Btn label="Back" variant="secondary" onPress={() => backInRejectFlow(index)} />
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
                  <View style={styles.continueRow}>
                    <Btn
                      label={busyIndex === index ? 'Saving…' : 'Continue'}
                      onPress={() => void completeRejectFlow(index)}
                      disabled={busyIndex === index}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.label}>Review decision</Text>
                <SegmentedChips
                  options={REVIEW_ACTIONS}
                  value={action === 'reject_recommendation' ? null : action}
                  onChange={(value) =>
                    patchIssue(index, {
                      reviewSubStep: 'decision',
                      agronomistReview: {
                        action: value as AgronomistReviewAction,
                        rejectFlowComplete: false,
                        rejectReason: undefined,
                        finalDiagnosis: issue.finalDiagnosis,
                        finalRecommendation: issue.finalRecommendation,
                      },
                    })
                  }
                />
                <Pressable onPress={() => startRejectFlow(index)} style={styles.rejectBtn}>
                  <Text style={styles.rejectBtnText}>Reject Recommendation</Text>
                </Pressable>
                <Text style={styles.label}>Final diagnosis</Text>
                <TextField
                  label="Final diagnosis"
                  value={issue.finalDiagnosis ?? ''}
                  onChangeText={(text) => patchIssue(index, { finalDiagnosis: text })}
                />
                <Text style={styles.label}>Final recommendation</Text>
                <TextInput
                  style={[styles.input, { minHeight: MULTILINE_MIN_HEIGHT }]}
                  multiline
                  value={issue.finalRecommendation ?? ''}
                  onChangeText={(text) => patchIssue(index, { finalRecommendation: text })}
                />
                {needsReason ? (
                  <>
                    <Text style={styles.label}>Reason for change</Text>
                    <TextField
                      label="Modification reason"
                      value={issue.agronomistReview?.modificationReason ?? ''}
                      onChangeText={(text) =>
                        patchIssue(index, {
                          agronomistReview: {
                            action,
                            modificationReason: text,
                            finalDiagnosis: issue.finalDiagnosis,
                            finalRecommendation: issue.finalRecommendation,
                          },
                        })
                      }
                    />
                  </>
                ) : null}
                <Text style={styles.label}>Yield risk (optional)</Text>
                <TextField
                  label="Yield risk"
                  value={issue.agronomistReview?.yieldRisk ?? ''}
                  onChangeText={(text) =>
                    patchIssue(index, {
                      agronomistReview: {
                        action,
                        yieldRisk: text,
                        finalDiagnosis: issue.finalDiagnosis,
                        finalRecommendation: issue.finalRecommendation,
                      },
                    })
                  }
                />
              </>
            )}
          </Panel>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.green100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '600', color: tokens.green800 },
  escalationHint: {
    fontSize: 13,
    color: '#8a6d3b',
    backgroundColor: '#fff8e6',
    padding: 10,
    borderRadius: tokens.radiusSm,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.bg,
    textAlignVertical: 'top',
  },
  rejectBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignSelf: 'flex-start',
  },
  rejectBtnText: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  continueRow: { marginTop: 12 },
});
