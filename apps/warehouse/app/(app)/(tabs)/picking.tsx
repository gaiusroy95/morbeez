import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { filterPickQueue, tokens, type PickQueueTab } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

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
  const { queue, queueLoading, refreshing, error, refreshQueue } = useWarehouseQueue();
  const [tab, setTab] = useState<PickQueueTab>(() => parsePickTab(tabParam));

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

  if (queueLoading && !queue.length) return <Loading label="Loading picking queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshQueue({ repair: true, force: true })}
          />
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
                  label={item.omsStatus === 'picking' ? 'Continue pick' : 'Start pick'}
                  onPress={() => router.push(`/(app)/picking/${item.id}`)}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState>No orders in this queue.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  cardAction: { marginTop: -8, marginBottom: 12, paddingHorizontal: 4 },
});
