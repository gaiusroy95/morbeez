import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { filterDispatchQueue, filterLrPending, tokens, type QueueOrder } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

type DispatchTab = 'ready' | 'lr_pending';

function groupKey(row: QueueOrder): string {
  if (row.shippingMethod === 'manual' || row.needsManualTracking) return 'Manual courier';
  if (row.courier?.toLowerCase().includes('shiprocket') || row.awb) return 'Shiprocket';
  return row.courier || 'Other';
}

function parseDispatchTab(raw: string | string[] | undefined): DispatchTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'lr_pending' ? 'lr_pending' : 'ready';
}

export default function DispatchQueueScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const { queue, stats, queueLoading, refreshing, error, refreshQueue, refreshStats } = useWarehouseQueue();
  const [tab, setTab] = useState<DispatchTab>(() => parseDispatchTab(tabParam));

  useEffect(() => {
    if (tabParam) setTab(parseDispatchTab(tabParam));
  }, [tabParam]);

  const ready = useMemo(() => filterDispatchQueue(queue), [queue]);
  const lrPending = useMemo(() => filterLrPending(queue), [queue]);
  const readyCount = stats?.readyDispatch ?? ready.length;
  const lrCount = stats?.awaitingTracking ?? stats?.lrPending ?? lrPending.length;
  const filtered = tab === 'ready' ? ready : lrPending;

  const grouped = useMemo(() => {
    const map = new Map<string, QueueOrder[]>();
    for (const row of filtered) {
      const key = groupKey(row);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  if (queueLoading && !queue.length) return <Loading label="Loading dispatch queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={grouped}
        keyExtractor={([key]) => key}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshQueue({ force: true });
              void refreshStats({ force: true });
            }}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <HubTabs
              tabs={[
                { id: 'ready' as const, label: `Ready (${readyCount})` },
                { id: 'lr_pending' as const, label: `LR pending (${lrCount})` },
              ]}
              active={tab}
              onChange={setTab}
            />
            {tab === 'lr_pending' ? (
              <View style={styles.headerAction}>
                <Btn label="Open LR pending list" onPress={() => router.push('/(app)/dispatch/lr-pending')} variant="secondary" />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item: [group, rows] }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            {rows.map((row) => (
              <View key={row.id} style={styles.cardWrap}>
                <ListCard
                  title={row.orderName}
                  subtitle={[row.customerName, row.awb ? `AWB ${row.awb}` : row.courier].filter(Boolean).join(' · ')}
                  meta={row.omsStatus}
                  onPress={() =>
                    tab === 'lr_pending'
                      ? router.push(`/(app)/dispatch/lr-update/${row.id}`)
                      : router.push(`/(app)/dispatch/${row.id}`)
                  }
                />
                <View style={styles.cardAction}>
                  {tab === 'lr_pending' ? (
                    <Btn label="Update LR" onPress={() => router.push(`/(app)/dispatch/lr-update/${row.id}`)} />
                  ) : (
                    <Btn label="Open dispatch" onPress={() => router.push(`/(app)/dispatch/${row.id}`)} />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={<EmptyState>No orders in this dispatch bucket.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  headerAction: { marginBottom: 12 },
  group: { marginBottom: 16 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: tokens.green800, marginBottom: 8 },
  cardWrap: { marginBottom: 4 },
  cardAction: { marginTop: -4, marginBottom: 8, paddingHorizontal: 4 },
});
