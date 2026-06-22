import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens, type TriagePreview } from '@morbeez/shared';
import { AlertBox, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
  blockId: string;
  blockAssessment?: {
    blockHealth: string;
    cropPerformance: string;
    soilMoisture: string;
  };
  measurements: Record<string, string>;
  analyzePhotos?: Array<{ dataBase64: string; mimeType?: string }>;
  triage: TriagePreview | null;
  onTriage: (triage: TriagePreview | null) => void;
};

const LEVEL_LABEL: Record<string, string> = {
  L1: 'Simple',
  L2: 'Moderate',
  L3: 'Complex',
  L4: 'Critical',
};

export function VisitAiTriageStep({
  farmerId,
  blockId,
  blockAssessment,
  measurements,
  analyzePhotos,
  triage,
  onTriage,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (triage) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const measurementRows = Object.entries(measurements)
        .filter(([, v]) => v?.trim())
        .map(([key, value]) => ({ key, value }));
      const { triage: t, capability } = await agronomistClient.triagePreview({
        farmerId,
        blockId,
        blockAssessment: blockAssessment as Props['blockAssessment'],
        measurements: measurementRows,
        analyzePhotos,
      });
      onTriage(t);
      if (!capability.capable) {
        setError('AI diagnosis degraded — escalation may be required.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Triage preview failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      {loading ? <ActivityIndicator color={tokens.colors.primary} /> : null}
      {error ? <AlertBox>{error}</AlertBox> : null}
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
  level: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
  reason: { marginTop: 8, color: tokens.colors.textMuted },
  meta: { marginTop: 4, color: tokens.colors.textMuted },
  warn: { marginTop: 8, color: tokens.colors.warning },
  ok: { marginTop: 8, color: tokens.colors.success },
});
