import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens, type IssueMasterRow } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import { IssueCard, type IssueDraft } from '../IssueCard';
import { newIssueDraft, pickDefaultCategory } from './types';
import { type FarmerVisitFeedback } from './farmerVisitFeedback';

type Props = {
  visible: boolean;
  issue: IssueDraft | null;
  issueMaster: IssueMasterRow[];
  cropType: string;
  blockDap?: number | null;
  farmerFeedback?: FarmerVisitFeedback | null;
  onSave: (issue: IssueDraft) => void;
  onRemove?: () => void;
  onClose: () => void;
  onSuggestQuestions?: (issue: IssueDraft) => Promise<string[]>;
  onCreateIssueType?: (input: {
    category: import('@morbeez/shared').IssueCategory;
    issueName: string;
    cropType: string;
  }) => Promise<IssueMasterRow | null>;
};

export function AddIssueModal({
  visible,
  issue,
  issueMaster,
  cropType,
  farmerFeedback,
  onSave,
  onRemove,
  onClose,
  onCreateIssueType,
}: Props) {
  const [draft, setDraft] = useState<IssueDraft | null>(null);

  const active = draft ?? issue ?? newIssueDraft(pickDefaultCategory(), `new-${Date.now()}`);

  function resetOnOpen() {
    const base = issue
      ? { ...issue }
      : newIssueDraft(pickDefaultCategory(), `new-${Date.now()}`);
    setDraft(base);
  }

  function confirmRemove() {
    if (!onRemove) return;
    Alert.alert(
      'Remove issue?',
      'This issue will be removed from the visit. You can add it again later if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onRemove();
            onClose();
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={resetOnOpen}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Issue details</Text>
          <Btn label="Close" variant="secondary" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <IssueCard
            issue={active}
            issueMaster={issueMaster}
            cropType={cropType}
            farmerFeedback={farmerFeedback}
            onChange={setDraft}
            onCreateIssueType={onCreateIssueType}
          />
        </ScrollView>
        <View style={styles.footer}>
          {onRemove ? <Btn label="Remove issue" variant="secondary" onPress={confirmRemove} /> : null}
          <Btn
            label="Save issue"
            onPress={() => {
              if (!active.issueName.trim()) return;
              const dx = active.finalDiagnosis?.trim() || active.issueName.trim();
              onSave({
                ...active,
                finalDiagnosis: dx,
                selectedHypothesisLabel: dx,
              });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
    backgroundColor: tokens.card,
  },
  title: { fontSize: 18, fontWeight: '700', color: tokens.text },
  scroll: { padding: 16, paddingBottom: 32 },
  footer: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.card },
});
