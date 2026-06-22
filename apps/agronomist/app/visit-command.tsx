import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';

export default function VisitCommandScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof agronomistClient.getVisitCommandCenter>> | null>(null);

  useEffect(() => {
    void agronomistClient
      .getVisitCommandCenter()
      .then((c) => setData(c))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading command center…" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>Visit command center</Text>
      <Text style={styles.sub}>
        Priority: {data?.summary.priorityCount ?? 0} · Escalations: {data?.summary.openEscalations ?? 0}
      </Text>
      {(data?.priorityQueue ?? []).map((row, i) => (
        <View key={`${row.id ?? i}`} style={styles.row}>
          <Text style={styles.name}>{row.farmerName}</Text>
          <Text style={styles.meta}>{row.priority}</Text>
        </View>
      ))}
      {!data?.priorityQueue?.length ? <Text style={styles.empty}>No priority visits queued.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 8 },
  row: {
    padding: 12,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface,
  },
  name: { fontSize: 16, fontWeight: '600', color: tokens.text },
  meta: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  empty: { fontSize: 14, color: tokens.textMuted },
});
