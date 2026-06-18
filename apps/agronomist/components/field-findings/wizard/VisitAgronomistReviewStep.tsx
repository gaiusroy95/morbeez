import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens, type AgronomistReviewAction, type IssueCategory, type IssueMasterRow } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
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
  onChange,
  onSuggestQuestions,
  onCreateIssueType,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<IssueDraft | null>(null);

  function patchIssue(localId: string, patch: Partial<IssueDraft>) {
    onChange(issues.map((i) => (i.localId === localId ? { ...i, ...patch } : i)));
  }

  function setReviewAction(localId: string, action: AgronomistReviewAction) {
    const issue = issues.find((i) => i.localId === localId);
    if (!issue) return;
    patchIssue(localId, {
      agronomistReview: {
        action,
        finalDiagnosis: issue.finalDiagnosis,
        finalRecommendation: issue.finalRecommendation,
        modificationReason: action === 'correct_ai' ? issue.agronomistReview?.modificationReason : undefined,
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
      </Text>
      <Btn label="+ Add issue" onPress={() => { setEditing(null); setModalVisible(true); }} />

      {issues.map((issue) => (
        <View key={issue.localId} style={styles.card}>
          <Pressable onPress={() => { setEditing(issue); setModalVisible(true); }}>
            <Text style={styles.category}>{getIssueCategoryLabel(issue.category)}</Text>
            <Text style={styles.title}>{issue.issueName}</Text>
            {issue.finalDiagnosis ? <Text style={styles.dx}>AI: {issue.finalDiagnosis}</Text> : null}
          </Pressable>
          <View style={styles.actions}>
            {REVIEW_ACTIONS.map((a) => {
              const active = issue.agronomistReview?.action === a.value;
              return (
                <Pressable
                  key={a.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setReviewAction(issue.localId, a.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {(issue.agronomistReview?.action === 'correct_ai' || issue.agronomistReview?.action === 'partial_match') &&
          !issue.observation?.trim() ? (
            <Text style={styles.warn}>Tap card to add observation for modify.</Text>
          ) : null}
        </View>
      ))}

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
  chipText: { fontSize: 12, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '700' },
  warn: { fontSize: 12, color: '#c0392b' },
});
