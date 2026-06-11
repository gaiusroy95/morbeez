import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { filterDispatchQueue, filterLrPending, tokens, warehouseClient, type QueueOrder } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';

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
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [tab, setTab] = useState<DispatchTab>(() => parseDispatchTab(tabParam));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const q = await warehouseClient.getQueue({ limit: 80 });
      setQueue(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dispatch queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tabParam) setTab(parseDispatchTab(tabParam));
  }, [tabParam]);

  const ready = useMemo(() => filterDispatchQueue(queue), [queue]);
  const lrPending = useMemo(() => filterLrPending(queue), [queue]);
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

  if (loading) return <Loading label="Loading dispatch queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={grouped}
        keyExtractor={([key]) => key}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <HubTabs
              tabs={[
                { id: 'ready' as const, label: `Ready (${ready.length})` },
                { id: 'lr_pending' as const, label: `LR pending (${lrPending.length})` },
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
