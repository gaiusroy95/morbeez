import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens, type WhatsappPreviewMessage } from '@morbeez/shared';
import { AlertBox, Btn } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

type Props = {
  farmerId: string;
  issues: IssueDraft[];
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
};

export function VisitWhatsappPreviewStep({ farmerId, issues, confirmed, onConfirmedChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<WhatsappPreviewMessage[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const rows = await agronomistClient.previewWhatsappMessages({
        farmerId,
        issues: issues.map((i) => ({
          issueName: i.issueName,
          finalDiagnosis: i.finalDiagnosis,
          finalRecommendation: i.finalRecommendation,
          initialRecommendation: i.initialRecommendation,
        })),
      });
      setMessages(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load preview');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {messages.map((msg) => (
        <View key={msg.issueLabel} style={styles.card}>
          <Text style={styles.title}>{msg.issueLabel}</Text>
          <Text style={styles.body}>{msg.message}</Text>
        </View>
      ))}
      <Btn
        label={confirmed ? 'WhatsApp confirmed' : 'Confirm WhatsApp messages'}
        variant={confirmed ? 'primary' : 'secondary'}
        onPress={() => onConfirmedChange(!confirmed)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { padding: 24, alignItems: 'center' },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  body: { fontSize: 12, color: tokens.textMuted, marginTop: 8, lineHeight: 18 },
});
