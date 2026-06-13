import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, formatDate, tokens, type FarmerVisitRow } from '@morbeez/shared';
import { AlertBox, ListCard, Loading, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
};

export function FarmerVisitsPanel({ farmerId }: Props) {
  const router = useRouter();
  const [visits, setVisits] = useState<FarmerVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setVisits(await agronomistClient.listFarmerVisits(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load visits');
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading visits…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Visit timeline">
        <Text style={styles.hint}>
          Auto-generated from completed field visits. Start a new visit from a block workspace.
        </Text>
      </Panel>
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ListCard
            title={item.blockName}
            subtitle={item.summary || '—'}
            meta={[
              formatDate(item.visitedAt),
              item.dapAtVisit != null ? `DAP ${item.dapAtVisit}` : null,
              `${item.issueCount} issue${item.issueCount === 1 ? '' : 's'}`,
              item.recommendationCount ? `${item.recommendationCount} recs` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push(`/visit/${item.id}`)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No visits recorded yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  list: { padding: 12, paddingBottom: 32 },
  empty: { padding: 24, color: tokens.textMuted, textAlign: 'center' },
});
