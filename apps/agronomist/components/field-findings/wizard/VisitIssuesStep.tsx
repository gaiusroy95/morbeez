import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens, type IssueCategory, type IssueMasterRow } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import { type IssueDraft } from '../IssueCard';
import { AddIssueModal } from './AddIssueModal';

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  disease: 'Disease',
  pest: 'Pest',
  nutrient_deficiency: 'Deficiency',
  water_stress: 'Water stress',
  weed: 'Weed',
  other: 'Other',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: tokens.green700,
  medium: '#F9A825',
  high: '#E53935',
};

type Props = {
  issues: IssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  blockDap?: number | null;
  onChange: (issues: IssueDraft[]) => void;
  onSuggestQuestions: (issue: IssueDraft) => Promise<string[]>;
};

export function VisitIssuesStep({
  issues,
  issueMaster,
  cropType,
  blockDap,
  onChange,
  onSuggestQuestions,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<IssueDraft | null>(null);

  function openAdd() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(issue: IssueDraft) {
    setEditing(issue);
    setModalVisible(true);
  }

  function saveIssue(issue: IssueDraft) {
    const exists = issues.some((i) => i.localId === issue.localId);
    onChange(exists ? issues.map((i) => (i.localId === issue.localId ? issue : i)) : [...issues, issue]);
    setModalVisible(false);
    setEditing(null);
  }

  function removeIssue(localId: string) {
    onChange(issues.filter((i) => i.localId !== localId));
    setModalVisible(false);
    setEditing(null);
  }

  return (
    <View style={styles.root}>
      <Btn label="+ Add issue" onPress={openAdd} />

      {issues.map((issue) => (
        <Pressable key={issue.localId} style={styles.card} onPress={() => openEdit(issue)}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardCategory}>{CATEGORY_LABELS[issue.category]}</Text>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[issue.severity] ?? tokens.textMuted }]}>
              <Text style={styles.severityText}>{issue.severity}</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{issue.issueName || 'Unnamed issue'}</Text>
          {issue.observation ? (
            <Text style={styles.cardObs} numberOfLines={2}>
              {issue.observation}
            </Text>
          ) : null}
        </Pressable>
      ))}

      {!issues.length ? (
        <Text style={styles.empty}>No issues added. Tap “Add issue” to record field problems.</Text>
      ) : null}

      <AddIssueModal
        visible={modalVisible}
        issue={editing}
        issueMaster={issueMaster}
        cropType={cropType}
        blockDap={blockDap}
        onSave={saveIssue}
        onRemove={editing ? () => removeIssue(editing.localId) : undefined}
        onClose={() => {
          setModalVisible(false);
          setEditing(null);
        }}
        onSuggestQuestions={onSuggestQuestions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardCategory: { fontSize: 12, fontWeight: '700', color: tokens.green800, textTransform: 'uppercase' },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  severityText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: tokens.text },
  cardObs: { fontSize: 13, color: tokens.textMuted, marginTop: 4, lineHeight: 18 },
  empty: { fontSize: 14, color: tokens.textMuted, textAlign: 'center', paddingVertical: 16 },
});
