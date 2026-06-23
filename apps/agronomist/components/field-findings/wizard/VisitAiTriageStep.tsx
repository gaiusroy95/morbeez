import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  agronomistClient,
  tokens,
  withTimeout,
  type StructuredFieldVisitPayload,
  type TriagePreview,
} from '@morbeez/shared';
import { AlertBox, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
  blockId: string;
  blockAssessment?: StructuredFieldVisitPayload['blockAssessment'];
  measurements: Record<string, string>;
  triage: TriagePreview | null;
  onTriage: (triage: TriagePreview | null) => void;
};

const LEVEL_LABEL: Record<string, string> = {
  L1: 'Simple',
  L2: 'Moderate',
  L3: 'Complex',
  L4: 'Critical',
};

const TRIAGE_TIMEOUT_MS = 25_000;

export function VisitAiTriageStep({
  farmerId,
  blockId,
  blockAssessment,
  measurements,
  triage,
  onTriage,
}: Props) {
  const [loading, setLoading] = useState(() => !triage);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const measurementRows = Object.entries(measurements)
        .filter(([, v]) => v?.trim())
        .map(([key, value]) => ({ key, value }));
      const { triage: t, capability } = await withTimeout(
        agronomistClient.triagePreview({
          farmerId,
          blockId,
          blockAssessment,
          measurements: measurementRows,
        }),
        TRIAGE_TIMEOUT_MS,
        'Triage timed out — check network and tap Retry.'
      );
      onTriage(t);
      if (!capability.capable) {
        setError('AI diagnosis degraded — escalation may be required.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Triage preview failed');
    } finally {
      setLoading(false);
    }
  }, [blockAssessment, blockId, farmerId, measurements, onTriage]);

  useEffect(() => {
    if (triage) return;
    void load();
  }, [triage, load]);

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.green700} />
          <Text style={styles.loadingText}>Running case triage…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBlock}>
          <AlertBox>{error}</AlertBox>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry triage</Text>
          </Pressable>
        </View>
      ) : null}
      {triage ? (
        <Panel title="Case triage">
          <Text style={styles.level}>
            {LEVEL_LABEL[triage.level] ?? triage.level} ({triage.level})
          </Text>
          <Text style={styles.reason}>{triage.reason}</Text>
          <Text style={styles.meta}>Route: {triage.route}</Text>
          {triage.mandatoryFollowUp ? (
            <Text style={styles.warn}>Follow-up Q&A will be required.</Text>
          ) : (
            <Text style={styles.ok}>May skip Q&A on high-confidence approve.</Text>
          )}
          {triage.blockAutoApprove ? (
            <Text style={styles.warn}>Auto-approve blocked — escalation mandatory.</Text>
          ) : null}
        </Panel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  loadingText: { fontSize: 14, color: tokens.textMuted },
  errorBlock: { gap: 10 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green700,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: tokens.green700 },
  level: { fontSize: 18, fontWeight: '700', color: tokens.text },
  reason: { marginTop: 8, color: tokens.textMuted },
  meta: { marginTop: 4, color: tokens.textMuted },
  warn: { marginTop: 8, color: tokens.warning },
  ok: { marginTop: 8, color: tokens.green700 },
});
