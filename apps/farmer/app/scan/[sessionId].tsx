import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchAiScan, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { whatsAppUrl } from '@/lib/config';

export default function ScanResultScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof fetchAiScan>> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    void fetchAiScan(String(sessionId))
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load scan result'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <Loading label="Loading AI result…" />;
  if (!result) return <AlertBox>{error || 'Result not found'}</AlertBox>;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Possible issue">
        <Text style={styles.issue}>{result.detectedIssue}</Text>
        <Text style={styles.meta}>Confidence: {result.confidence}%</Text>
        <Text style={styles.meta}>Severity: {result.severity}</Text>
        {result.spreadRisk ? <Text style={styles.alert}>Spread risk: {result.spreadRisk}</Text> : null}
      </Panel>
      <Panel title="Analysis">
        <Text style={styles.body}>{result.description}</Text>
      </Panel>
      {result.recommendationId ? (
        <Btn label="View recommendation" onPress={() => router.push(`/recommendations/${result.recommendationId}`)} />
      ) : null}
      <Btn label="Rescan" variant="secondary" onPress={() => router.replace('/(tabs)/scan')} />
      <Btn
        label="Escalate support"
        variant="secondary"
        onPress={() => Linking.openURL(whatsAppUrl(`AI scan help — session ${sessionId}`))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  issue: { fontSize: 20, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  meta: { fontSize: 14, color: tokens.textMuted, marginBottom: 4 },
  alert: { fontSize: 14, color: tokens.danger, marginTop: 8, fontWeight: '600' },
  body: { fontSize: 14, color: tokens.text, lineHeight: 22 },
});
