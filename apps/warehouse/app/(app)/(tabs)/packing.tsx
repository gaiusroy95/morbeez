import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  filterPackQueueByTab,
  tokens,
  warehouseClient,
  type PackQueueTab,
  type QueueOrder,
} from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';

const TABS: Array<{ id: PackQueueTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'packing', label: 'Packing' },
  { id: 'awaiting_pack', label: 'Awaiting pack' },
];

function parsePackTab(raw: string | string[] | undefined): PackQueueTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'packing' || v === 'awaiting_pack' || v === 'all') return v;
  return 'all';
}

export default function PackingQueueScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [tab, setTab] = useState<PackQueueTab>(() => parsePackTab(tabParam));
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

  useEffect(() => {
    if (tabParam) setTab(parsePackTab(tabParam));
  }, [tabParam]);

  const filtered = useMemo(() => filterPackQueueByTab(queue, tab), [queue, tab]);
  const counts = useMemo(
    () => ({
      all: filterPackQueueByTab(queue, 'all').length,
      packing: filterPackQueueByTab(queue, 'packing').length,
      awaiting_pack: filterPackQueueByTab(queue, 'awaiting_pack').length,
    }),
    [queue]
  );

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
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <HubTabs
              tabs={TABS.map((t) => ({ id: t.id, label: `${t.label} (${counts[t.id]})` }))}
              active={tab}
              onChange={setTab}
            />
          </>
        }
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
        ListEmptyComponent={<EmptyState>No orders in this packing bucket.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  cardAction: { marginTop: -4, marginBottom: 12, paddingHorizontal: 4 },
});
