import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens, type IssueMasterRow } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import { IssueCard, type IssueDraft } from '../IssueCard';
import { newIssueDraft, pickDefaultCategory } from './types';

type Props = {
  visible: boolean;
  issue: IssueDraft | null;
  issueMaster: IssueMasterRow[];
  cropType: string;
  blockDap?: number | null;
  onSave: (issue: IssueDraft) => void;
  onRemove?: () => void;
  onClose: () => void;
  onSuggestQuestions: (issue: IssueDraft) => Promise<string[]>;
};

export function AddIssueModal({
  visible,
  issue,
  issueMaster,
  cropType,
  blockDap,
  onSave,
  onRemove,
  onClose,
  onSuggestQuestions,
}: Props) {
  const [draft, setDraft] = useState<IssueDraft | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ name: string; confidence: number }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const active = draft ?? issue ?? newIssueDraft(pickDefaultCategory(), `new-${Date.now()}`);

  function resetOnOpen() {
    if (issue) setDraft({ ...issue });
    else setDraft(newIssueDraft(pickDefaultCategory(), `new-${Date.now()}`));
    setAiOpen(false);
    setAiSuggestions([]);
  }

  async function loadAiSuggestions() {
    setAiLoading(true);
    try {
      const questions = await onSuggestQuestions(active);
      const fromMaster = issueMaster
        .filter((m) => m.category === active.category && (!m.cropType || m.cropType === cropType))
        .slice(0, 3)
        .map((m, i) => ({ name: m.issueName, confidence: Math.max(40, 82 - i * 15) }));
      const fromAi = questions.slice(0, 2).map((q, i) => ({
        name: q.slice(0, 60),
        confidence: Math.max(20, 50 - i * 10),
      }));
      setAiSuggestions(fromMaster.length ? fromMaster : fromAi.length ? fromAi : [{ name: active.issueName || 'General observation', confidence: 60 }]);
      setAiOpen(true);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={resetOnOpen}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{issue ? 'Edit issue' : 'Add issue'}</Text>
          <Btn label="Close" variant="secondary" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <IssueCard
            issue={active}
            issueMaster={issueMaster}
            cropType={cropType}
            onChange={setDraft}
            onRemove={onRemove ?? (() => {})}
            onSuggestQuestions={() => onSuggestQuestions(active)}
          />

          <Btn
            label={aiLoading ? 'Analyzing…' : 'Get AI suggestions'}
            variant="secondary"
            onPress={() => void loadAiSuggestions()}
            disabled={aiLoading}
          />

          {aiOpen && aiSuggestions.length ? (
            <View style={styles.aiBox}>
              <Text style={styles.aiTitle}>Based on photos & observations, AI suggests:</Text>
              {aiSuggestions.map((s, i) => (
                <View key={`${s.name}-${i}`} style={styles.aiRow}>
                  <Text style={styles.aiName}>
                    {i + 1}. {s.name}
                  </Text>
                  <View style={styles.aiBarTrack}>
                    <View style={[styles.aiBarFill, { width: `${s.confidence}%` }]} />
                  </View>
                  <Text style={styles.aiPct}>{s.confidence}%</Text>
                </View>
              ))}
              <Btn
                label={`Accept ${aiSuggestions[0]?.name ?? 'suggestion'}`}
                onPress={() => {
                  const name = aiSuggestions[0]?.name ?? active.issueName;
                  setDraft({ ...active, issueName: name });
                  setAiOpen(false);
                }}
              />
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          {onRemove ? <Btn label="Remove issue" variant="secondary" onPress={onRemove} /> : null}
          <Btn
            label="Save issue"
            onPress={() => {
              if (!active.issueName.trim()) return;
              onSave(active);
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
  aiBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    gap: 10,
  },
  aiTitle: { fontSize: 13, fontWeight: '600', color: tokens.text },
  aiRow: { gap: 4 },
  aiName: { fontSize: 14, fontWeight: '600', color: tokens.text },
  aiBarTrack: { height: 8, backgroundColor: tokens.border, borderRadius: 4, overflow: 'hidden' },
  aiBarFill: { height: 8, backgroundColor: tokens.green700, borderRadius: 4 },
  aiPct: { fontSize: 12, color: tokens.textMuted },
});
