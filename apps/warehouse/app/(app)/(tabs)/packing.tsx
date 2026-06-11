import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { filterPackQueue, tokens, warehouseClient, type QueueOrder } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, ListCard, Loading } from '@morbeez/ui-native';

export default function PackingQueueScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const q = await warehouseClient.getQueue({ limit: 80 });
      setQueue(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packing queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterPackQueue(queue), [queue]);

  if (loading) return <Loading label="Loading packing queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
        renderItem={({ item }) => (
          <>
            <ListCard
              title={item.orderName}
              subtitle={[item.customerName, `${item.itemCount} items`, item.courier].filter(Boolean).join(' · ')}
              meta={item.omsStatus}
              onPress={() => router.push(`/(app)/packing/${item.id}`)}
            />
            <View style={styles.cardAction}>
              <Btn label="Open pack screen" onPress={() => router.push(`/(app)/packing/${item.id}`)} />
            </View>
          </>
        )}
        ListEmptyComponent={<EmptyState>No orders ready for packing.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  cardAction: { marginTop: -4, marginBottom: 12, paddingHorizontal: 4 },
});
