import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';

export default function VisitCommandScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof agronomistClient.getVisitCommandCenter>> | null>(null);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void Promise.all([
      agronomistClient.getVisitCommandCenter(),
      agronomistClient.listVisitDrafts(10).catch(() => ({ ok: true, drafts: [] })),
    ])
      .then(([c, d]) => {
        setData(c);
        setDrafts(d.drafts ?? []);
      })
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

      <Text style={[styles.title, { marginTop: 16 }]}>Resume drafts</Text>
      {drafts.map((d) => {
        const farmer = d.farmers as { name?: string } | null;
        const block = d.farm_blocks as { name?: string; crop_type?: string } | null;
        const farmerId = String(d.farmer_id ?? '');
        const blockId = String(d.block_id ?? '');
        const sessionId = String(d.session_id ?? '');
        return (
          <Pressable
            key={String(d.id)}
            style={styles.row}
            onPress={() => {
              if (!farmerId || !blockId) return;
              router.push({
                pathname: '/visit',
                params: {
                  farmerId,
                  blockId,
                  blockName: block?.name ?? '',
                  cropType: block?.crop_type ?? '',
                  farmerName: farmer?.name ?? '',
                  sessionId,
                },
              });
            }}
          >
            <Text style={styles.name}>{farmer?.name ?? 'Farmer'}</Text>
            <Text style={styles.meta}>
              {block?.name ?? 'Block'} · Step {String(d.current_step ?? 'intakeTriage')}
            </Text>
          </Pressable>
        );
      })}
      {!drafts.length ? <Text style={styles.empty}>No in-progress drafts.</Text> : null}
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
    backgroundColor: tokens.card,
  },
  name: { fontSize: 16, fontWeight: '600', color: tokens.text },
  meta: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  empty: { fontSize: 14, color: tokens.textMuted },
});
