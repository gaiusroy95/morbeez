import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { filterLrPending, tokens, warehouseClient, type QueueOrder } from '@morbeez/shared';
import {AlertBox, Btn, EmptyState, ListCard, Loading, stableRowKey } from '@morbeez/ui-native';

export default function LrPendingScreen() {
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
      setError(e instanceof Error ? e.message : 'Failed to load LR queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterLrPending(queue), [queue]);

  if (loading) return <Loading label="Loading LR pending…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(r, i) => stableRowKey(r.id, i)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
        renderItem={({ item }) => (
          <>
            <ListCard
              title={item.orderName}
              subtitle={[item.customerName, item.courier].filter(Boolean).join(' · ')}
              meta="Awaiting LR / tracking"
              onPress={() => router.push(`/(app)/dispatch/lr-update/${item.id}`)}
            />
            <View style={styles.cardAction}>
              <Btn label="Update LR" onPress={() => router.push(`/(app)/dispatch/lr-update/${item.id}`)} />
            </View>
          </>
        )}
        ListEmptyComponent={<EmptyState>No orders awaiting LR entry.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  cardAction: { marginTop: -4, marginBottom: 12, paddingHorizontal: 4 },
});
