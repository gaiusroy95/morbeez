import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  filterPickQueue,
  tokens,
  warehouseClient,
  type PickQueueTab,
  type QueueOrder,
} from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';

const TABS: Array<{ id: PickQueueTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'on_hold', label: 'On Hold' },
];

function parsePickTab(raw: string | string[] | undefined): PickQueueTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'assigned' || v === 'in_progress' || v === 'on_hold' || v === 'all') return v;
  return 'all';
}

export default function PickingQueueScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [tab, setTab] = useState<PickQueueTab>(() => parsePickTab(tabParam));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const q = await warehouseClient.getQueue({ repair: true, limit: 80 });
      setQueue(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load picking queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tabParam) setTab(parsePickTab(tabParam));
  }, [tabParam]);

  const filtered = useMemo(() => filterPickQueue(queue, tab), [queue, tab]);
  const counts = useMemo(
    () => ({
      all: filterPickQueue(queue, 'all').length,
      assigned: filterPickQueue(queue, 'assigned').length,
      in_progress: filterPickQueue(queue, 'in_progress').length,
      on_hold: filterPickQueue(queue, 'on_hold').length,
    }),
    [queue]
  );

  if (loading) return <Loading label="Loading picking queue…" />;

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
        renderItem={({ item }) => {
          const inProgress = item.omsStatus === 'picking';
          const rackHint = item.pickListId ? 'Pick list ready' : 'Awaiting pick list';
          return (
            <View>
              <ListCard
                title={item.orderName}
                subtitle={[item.customerName, `${item.itemCount} items`, rackHint].filter(Boolean).join(' · ')}
                meta={item.stockIssue ? `On hold · ${item.stockIssue}` : item.omsStatus}
                onPress={() => router.push(`/(app)/picking/${item.id}`)}
              />
              <View style={styles.cardAction}>
                <Btn
                  label={inProgress ? 'Resume picking' : 'Start picking'}
                  onPress={() => router.push(`/(app)/picking/${item.id}`)}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState>No orders in this picking bucket.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  cardAction: { marginTop: -4, marginBottom: 12, paddingHorizontal: 4 },
});
