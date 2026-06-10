import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchAiScan, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { whatsAppUrl } from '@/lib/config';

const SEVERITY_COLOR: Record<string, string> = {
  low: tokens.green700,
  medium: tokens.warning,
  high: tokens.danger,
};

export default function ScanResultScreen() {
  const router = useRouter();
  const { locale } = useLocale();
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

  if (loading) return <Loading label={t('loading', locale)} />;
  if (!result) return <AlertBox>{error || 'Result not found'}</AlertBox>;

  const severityColor = SEVERITY_COLOR[result.severity] ?? tokens.textMuted;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <View style={styles.hero}>
        <View style={[styles.confidenceRing, { borderColor: severityColor }]}>
          <Text style={[styles.confidenceText, { color: severityColor }]}>{result.confidence}%</Text>
          <Text style={styles.confidenceLabel}>confidence</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.issue}>{result.detectedIssue}</Text>
          <Text style={[styles.severity, { color: severityColor }]}>Severity: {result.severity}</Text>
          {result.spreadRisk ? <Text style={styles.alert}>Spread risk: {result.spreadRisk}</Text> : null}
        </View>
      </View>

      <Panel title="Analysis">
        <Text style={styles.body}>{result.description}</Text>
        {result.summary ? <Text style={styles.summary}>{result.summary}</Text> : null}
      </Panel>

      {result.recommendationId ? (
        <Btn label="View recommendation" onPress={() => router.push(`/recommendations/${result.recommendationId}`)} />
      ) : null}
      <Btn label="Shop recovery inputs" variant="secondary" onPress={() => router.push('/(tabs)/shop')} />
      <Btn label="Rescan" variant="secondary" onPress={() => router.replace('/scan')} />
      <Btn label={t('scanHistory', locale)} variant="secondary" onPress={() => router.push('/scan/history')} />
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
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  hero: { flexDirection: 'row', gap: 16, marginBottom: 8, alignItems: 'center' },
  confidenceRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.card,
  },
  confidenceText: { fontSize: 20, fontWeight: '800' },
  confidenceLabel: { fontSize: 10, color: tokens.textMuted },
  heroText: { flex: 1 },
  issue: { fontSize: 20, fontWeight: '700', color: tokens.text, marginBottom: 6 },
  severity: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  alert: { fontSize: 14, color: tokens.danger, fontWeight: '600' },
  body: { fontSize: 14, color: tokens.text, lineHeight: 22 },
  summary: { fontSize: 13, color: tokens.textMuted, marginTop: 8, fontStyle: 'italic' },
});
