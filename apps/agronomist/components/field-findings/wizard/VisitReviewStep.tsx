import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens, type AgronomistReviewAction } from '@morbeez/shared';
import { Panel, TextField, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { SegmentedChips } from '../SegmentedChips';
import type { IssueDraft } from '../IssueCard';

const REVIEW_ACTIONS: Array<{ value: AgronomistReviewAction; label: string }> = [
  { value: 'approve_ai', label: 'Approve' },
  { value: 'correct_ai', label: 'Modify' },
  { value: 'partial_match', label: 'Partial' },
  { value: 'escalate_urgent', label: 'Reject' },
];

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
};

export function VisitReviewStep({ issues, onChange }: Props) {
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
        ...patch.agronomistReview,
      },
    };
    onChange(next);
  }

  return (
    <View style={styles.root}>
      {issues.map((issue, index) => {
        const action = issue.agronomistReview?.action ?? 'approve_ai';
        const needsReason = action === 'correct_ai' || action === 'partial_match' || action === 'escalate_urgent';
        const showEscalationHint =
          issue.confidenceAction === 'escalate' || issue.severity === 'high';
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {showEscalationHint ? (
              <Text style={styles.escalationHint}>
                This case may need senior agronomist review before farmer communication.
              </Text>
            ) : null}
            <Text style={styles.label}>Review decision</Text>
            <SegmentedChips
              options={REVIEW_ACTIONS}
              value={action}
              onChange={(value) =>
                patchIssue(index, {
                  agronomistReview: {
                    action: value as AgronomistReviewAction,
                    finalDiagnosis: issue.finalDiagnosis,
                    finalRecommendation: issue.finalRecommendation,
                  },
                })
              }
            />
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
          </Panel>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
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
});
