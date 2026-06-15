import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatDate, partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

export default function VisitDetailScreen() {
  const { findingId } = useLocalSearchParams<{ findingId: string }>();
  const id = String(findingId ?? '');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void partnerClient
      .getVisitDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load visit'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading label="Loading visit…" />;
  if (error || !detail) return <AlertBox>{error || 'Visit not found.'}</AlertBox>;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Panel title="Visit detail (read-only)">
        <KeyValueRow label="Visited" value={detail.visitedAt ? formatDate(String(detail.visitedAt)) : '—'} />
        <KeyValueRow label="Observer" value={String(detail.agronomistName ?? detail.partnerName ?? 'Partner')} />
        <KeyValueRow label="Observations" value={String(detail.observations ?? '—')} />
        <Text style={styles.note}>Submitted records cannot be edited by partners.</Text>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16 },
  note: { fontSize: 12, color: tokens.textMuted, marginTop: 8 },
});
