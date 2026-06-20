import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  agronomistClient,
  tokens,
  type RecommendationGroupDraft,
  type WhatsappPreviewMessage,
} from '@morbeez/shared';
import { AlertBox, Btn, TextField } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

type Props = {
  farmerId: string;
  blockName?: string;
  issues: IssueDraft[];
  recommendationGroups?: RecommendationGroupDraft[];
  reviewDate?: string;
  monitoringInterval?: string;
  messages: WhatsappPreviewMessage[];
  onMessagesChange: (messages: WhatsappPreviewMessage[]) => void;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
};

export function VisitWhatsappPreviewStep({
  farmerId,
  blockName,
  issues,
  recommendationGroups,
  reviewDate,
  monitoringInterval,
  messages,
  onMessagesChange,
  confirmed,
  onConfirmedChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [staleHint, setStaleHint] = useState(false);
  const loadedKeyRef = useRef('');
  const generatedRef = useRef<WhatsappPreviewMessage[]>([]);

  const previewKey = JSON.stringify({
    farmerId,
    blockName,
    reviewDate,
    monitoringInterval,
    issues: issues.map((i) => ({
      issueName: i.issueName,
      finalDiagnosis: i.finalDiagnosis,
      finalRecommendation: i.finalRecommendation,
    })),
    groups: recommendationGroups,
  });

  useEffect(() => {
    if (loadedKeyRef.current && loadedKeyRef.current !== previewKey && messages.length) {
      setStaleHint(true);
      return;
    }
    if (loadedKeyRef.current === previewKey && messages.length) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const rows = await agronomistClient.previewWhatsappMessages({
        farmerId,
        blockName,
        recommendationGroups: recommendationGroups?.length ? recommendationGroups : undefined,
        reviewDate,
        monitoringInterval,
        issues: issues.map((i) => ({
          issueName: i.issueName,
          finalDiagnosis: i.finalDiagnosis,
          finalRecommendation: i.finalRecommendation,
          initialRecommendation: i.initialRecommendation,
        })),
      });
      onMessagesChange(rows);
      generatedRef.current = rows;
      onConfirmedChange(false);
      loadedKeyRef.current = previewKey;
      setStaleHint(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load preview');
    } finally {
      setLoading(false);
    }
  }

  function updateMessage(issueIndex: number, patch: Partial<WhatsappPreviewMessage>) {
    onMessagesChange(
      messages.map((msg) => (msg.issueIndex === issueIndex ? { ...msg, ...patch } : msg))
    );
    onConfirmedChange(false);
  }

  function resetMessage(issueIndex: number) {
    const original = generatedRef.current.find((m) => m.issueIndex === issueIndex);
    if (!original) return;
    updateMessage(issueIndex, {
      message: original.message,
      compliancePrompt: original.compliancePrompt,
    });
  }

  if (loading && !messages.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.hint}>
        Edit each message before confirming. The text you save here is what the farmer receives on
        WhatsApp after submit.
      </Text>
      {staleHint ? (
        <View style={styles.staleBanner}>
          <Text style={styles.staleText}>
            Recommendations changed since this preview was generated.
          </Text>
          <Pressable onPress={() => void load()} disabled={loading}>
            <Text style={styles.staleAction}>{loading ? 'Refreshing…' : 'Regenerate preview'}</Text>
          </Pressable>
        </View>
      ) : null}
      {messages.map((msg) => (
        <View key={`${msg.issueIndex}-${msg.issueLabel}`} style={styles.card}>
          <Text style={styles.title}>{msg.issueLabel}</Text>
          <TextField
            label="WhatsApp message"
            value={msg.message}
            onChangeText={(text) => updateMessage(msg.issueIndex, { message: text })}
            placeholder="Edit message text"
            multiline
          />
          {msg.compliancePrompt ? (
            <TextField
              label="Follow-up prompt (optional)"
              value={msg.compliancePrompt ?? ''}
              onChangeText={(text) => updateMessage(msg.issueIndex, { compliancePrompt: text })}
              placeholder="Compliance follow-up"
              multiline
            />
          ) : null}
          <Pressable style={styles.resetBtn} onPress={() => resetMessage(msg.issueIndex)} disabled={loading}>
            <Text style={styles.resetBtnText}>Reset to generated text</Text>
          </Pressable>
        </View>
      ))}
      <Btn
        label={confirmed ? 'WhatsApp confirmed' : 'Confirm WhatsApp messages'}
        variant={confirmed ? 'primary' : 'secondary'}
        onPress={() => onConfirmedChange(!confirmed)}
        disabled={!messages.length || messages.some((m) => !m.message.trim())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { padding: 24, alignItems: 'center' },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18, paddingHorizontal: 4 },
  staleBanner: {
    backgroundColor: '#fff8e6',
    borderWidth: 1,
    borderColor: '#f0d78c',
    borderRadius: tokens.radiusSm,
    padding: 10,
    gap: 6,
  },
  staleText: { fontSize: 13, color: '#7a5b00' },
  staleAction: { fontSize: 13, fontWeight: '700', color: tokens.green800 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  resetBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  resetBtnText: { fontSize: 12, fontWeight: '600', color: tokens.green800 },
});
