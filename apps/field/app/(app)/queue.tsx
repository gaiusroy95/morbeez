import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { STAFF_API_V1, formatDate, staffApi, tokens } from '@morbeez/shared';
import { AlertBox, EmptyState, ListCard, Loading } from '@morbeez/ui-native';

const AGRO = `${STAFF_API_V1}/os/agronomist`;

type QueueItem = {
  finding: {
    id: string;
    blockName: string;
    cropType: string;
    diseasePest: string | null;
    visitedAt: string;
  };
  farmer: { name: string | null; phone: string | null } | null;
  existingRecommendation: { id: string; status: string } | null;
};

export default function QueueScreen() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await staffApi<{ ok: boolean; items: QueueItem[] }>(`${AGRO}/queue`);
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading review queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.finding.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
        renderItem={({ item }) => (
          <ListCard
            title={item.farmer?.name ?? item.farmer?.phone ?? 'Farmer'}
            subtitle={`${item.finding.blockName} · ${item.finding.cropType}${
              item.finding.diseasePest ? ` · ${item.finding.diseasePest}` : ''
            }`}
            meta={
              item.existingRecommendation
                ? 'Draft'
                : formatDate(item.finding.visitedAt)
            }
            onPress={() => router.push(`/finding/${item.finding.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState>No field findings awaiting review.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16 },
});
