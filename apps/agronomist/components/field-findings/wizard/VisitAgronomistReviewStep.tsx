import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens, type AgronomistReviewAction, type IssueCategory, type IssueMasterRow } from '@morbeez/shared';
import { Btn, TextField } from '@morbeez/ui-native';
import { type IssueDraft } from '../IssueCard';
import { getIssueCategoryLabel } from './visitIssueTypes';
import { AddIssueModal } from './AddIssueModal';

const REVIEW_ACTIONS: Array<{ value: AgronomistReviewAction; label: string }> = [
  { value: 'approve_ai', label: 'Approve' },
  { value: 'correct_ai', label: 'Modify' },
  { value: 'partial_match', label: 'Partial' },
  { value: 'reject_recommendation', label: 'Reject' },
];

type Props = {
  issues: IssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  blockDap?: number | null;
  blockAutoApprove?: boolean;
  onChange: (issues: IssueDraft[]) => void;
  onSuggestQuestions: (issue: IssueDraft) => Promise<string[]>;
  onCreateIssueType?: (input: {
    category: IssueCategory;
    issueName: string;
    cropType: string;
  }) => Promise<IssueMasterRow | null>;
};

export function VisitAgronomistReviewStep({
  issues,
  issueMaster,
  cropType,
  blockDap,
  blockAutoApprove,
  onChange,
  onSuggestQuestions,
  onCreateIssueType,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<IssueDraft | null>(null);
  const [explainText, setExplainText] = useState('');

  async function explainIssue(issue: IssueDraft) {
    try {
      const r = await agronomistClient.explainDiagnosis({
        issueName: issue.issueName,
        finalDiagnosis: issue.finalDiagnosis ?? undefined,
        observation: issue.observation ?? undefined,
        severity: issue.severity ?? undefined,
      });
      setExplainText(r.agronomistText || r.farmerText);
    } catch (e) {
      setExplainText(e instanceof Error ? e.message : 'Explain failed');
    }
  }

  function patchIssue(localId: string, patch: Partial<IssueDraft>) {
    onChange(issues.map((i) => (i.localId === localId ? { ...i, ...patch } : i)));
  }

  function setReviewAction(localId: string, action: AgronomistReviewAction) {
    const issue = issues.find((i) => i.localId === localId);
    if (!issue) return;
    const keepModifyFields = action === 'correct_ai' || action === 'partial_match';
    patchIssue(localId, {
      agronomistReview: {
        action,
        finalDiagnosis: issue.finalDiagnosis,
        finalRecommendation: issue.finalRecommendation,
        modificationReason: keepModifyFields ? issue.agronomistReview?.modificationReason : undefined,
      },
    });
  }

  function patchReviewFields(
    localId: string,
    patch: { observation?: string; modificationReason?: string }
  ) {
    const issue = issues.find((i) => i.localId === localId);
    if (!issue?.agronomistReview?.action) return;
    patchIssue(localId, {
      ...(patch.observation !== undefined ? { observation: patch.observation } : {}),
      agronomistReview: {
        ...issue.agronomistReview,
        action: issue.agronomistReview.action,
        finalDiagnosis: issue.finalDiagnosis,
        finalRecommendation: issue.finalRecommendation,
        ...(patch.modificationReason !== undefined
          ? { modificationReason: patch.modificationReason }
          : {}),
      },
    });
  }

  function saveIssue(issue: IssueDraft) {
    const exists = issues.some((i) => i.localId === issue.localId);
    onChange(exists ? issues.map((i) => (i.localId === issue.localId ? issue : i)) : [...issues, issue]);
    setModalVisible(false);
    setEditing(null);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Review each AI issue. Approve, modify (add observation), or reject before Q&A.
        {blockAutoApprove ? ' L4 critical — auto-approve is blocked; modify or escalate.' : ''}
      </Text>
      <Btn label="+ Add issue" onPress={() => { setEditing(null); setModalVisible(true); }} />

      {issues.map((issue) => {
        const action = issue.agronomistReview?.action;
        const needsModifyFields = action === 'correct_ai' || action === 'partial_match';
        return (
        <View key={issue.localId} style={styles.card}>
          <Pressable onPress={() => { setEditing(issue); setModalVisible(true); }}>
            <Text style={styles.category}>{getIssueCategoryLabel(issue.category)}</Text>
            <Text style={styles.title}>{issue.issueName}</Text>
            {issue.finalDiagnosis ? <Text style={styles.dx}>AI: {issue.finalDiagnosis}</Text> : null}
          </Pressable>
          <View style={styles.actions}>
            {REVIEW_ACTIONS.map((a) => {
              const active = action === a.value;
              const disabled = blockAutoApprove && a.value === 'approve_ai';
              return (
                <Pressable
                  key={a.value}
                  style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                  onPress={() => !disabled && setReviewAction(issue.localId, a.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Btn label="Explain diagnosis" variant="secondary" onPress={() => void explainIssue(issue)} />
          {needsModifyFields ? (
            <View style={styles.modifyFields}>
              <TextField
                label="Your observation"
                value={issue.observation ?? ''}
                onChangeText={(observation) => patchReviewFields(issue.localId, { observation })}
                multiline
                placeholder="What you see in the field…"
              />
              <TextField
                label="Reason for change"
                value={issue.agronomistReview?.modificationReason ?? ''}
                onChangeText={(modificationReason) =>
                  patchReviewFields(issue.localId, { modificationReason })
                }
                multiline
                placeholder="Why you are changing the AI diagnosis…"
              />
            </View>
          ) : null}
        </View>
        );
      })}

      {explainText ? (
        <View style={styles.explainBox}>
          <Text style={styles.explainText}>{explainText}</Text>
        </View>
      ) : null}

      <AddIssueModal
        visible={modalVisible}
        issue={editing}
        issueMaster={issueMaster}
        cropType={cropType}
        blockDap={blockDap}
        onSave={saveIssue}
        onRemove={editing ? () => onChange(issues.filter((i) => i.localId !== editing.localId)) : undefined}
        onClose={() => { setModalVisible(false); setEditing(null); }}
        onSuggestQuestions={onSuggestQuestions}
        onCreateIssueType={onCreateIssueType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 8,
  },
  category: { fontSize: 12, fontWeight: '700', color: tokens.green800, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '700', color: tokens.text },
  dx: { fontSize: 12, color: tokens.green800, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 12, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '700' },
  chipTextDisabled: { color: tokens.textMuted },
  modifyFields: { gap: 8, marginTop: 4 },
  explainBox: {
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  explainText: { fontSize: 13, color: tokens.text, lineHeight: 18 },
});
