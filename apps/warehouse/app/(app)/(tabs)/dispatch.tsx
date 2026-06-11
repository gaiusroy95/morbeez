import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  filterDispatchQueue,
  filterHandedOverToday,
  filterLrPending,
  formatCompletedTime,
  t,
  tokens,
  type DispatchQueueTab,
  type QueueOrder,
} from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

function groupKey(row: QueueOrder): string {
  if (row.shippingMethod === 'manual' || row.needsManualTracking) return 'Manual courier';
  if (row.courier?.toLowerCase().includes('shiprocket') || row.awb) return 'Shiprocket';
  return row.courier || 'Other';
}

function parseDispatchTab(raw: string | string[] | undefined): DispatchQueueTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'lr_pending' || v === 'handed_over') return v;
  return 'ready';
}

export default function DispatchQueueScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const {
    queue,
    completedToday,
    stats,
    queueLoading,
    refreshing,
    error,
    refreshQueue,
    refreshStats,
    refreshCompletedToday,
  } = useWarehouseQueue();
  const [tab, setTab] = useState<DispatchQueueTab>(() => parseDispatchTab(tabParam));

  useEffect(() => {
    if (tabParam) setTab(parseDispatchTab(tabParam));
  }, [tabParam]);

  const ready = useMemo(() => filterDispatchQueue(queue), [queue]);
  const lrPending = useMemo(() => filterLrPending(queue), [queue]);
  const handedOver = useMemo(
    () => filterHandedOverToday(completedToday.handedOverToday),
    [completedToday.handedOverToday]
  );
  const readyCount = stats?.readyDispatch ?? ready.length;
  const lrCount = stats?.awaitingTracking ?? stats?.lrPending ?? lrPending.length;
  const handedOverCount = stats?.handedOverToday ?? handedOver.length;
  const filtered = tab === 'ready' ? ready : tab === 'lr_pending' ? lrPending : handedOver;

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
              void refreshCompletedToday({ force: true });
            }}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <HubTabs
              tabs={[
                { id: 'ready' as const, label: `${t('readyDispatch', locale)} (${readyCount})` },
                { id: 'lr_pending' as const, label: `${t('lrPending', locale)} (${lrCount})` },
                { id: 'handed_over' as const, label: `${t('handedOver', locale)} (${handedOverCount})` },
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
            {rows.map((row) => {
              const handedOverAt = formatCompletedTime(row.shippedAt, locale);
              return (
                <View key={row.id} style={styles.cardWrap}>
                  <ListCard
                    title={row.orderName}
                    subtitle={[row.customerName, row.awb ? `AWB ${row.awb}` : row.courier].filter(Boolean).join(' · ')}
                    meta={
                      tab === 'handed_over' && handedOverAt
                        ? `Handed over ${handedOverAt}`
                        : row.omsStatus
                    }
                    onPress={() =>
                      tab === 'lr_pending'
                        ? router.push(`/(app)/dispatch/lr-update/${row.id}`)
                        : tab === 'handed_over'
                          ? router.push(`/(app)/dispatch/${row.id}`)
                          : router.push(`/(app)/dispatch/${row.id}`)
                    }
                  />
                  {tab !== 'handed_over' ? (
                    <View style={styles.cardAction}>
                      {tab === 'lr_pending' ? (
                        <Btn label="Update LR" onPress={() => router.push(`/(app)/dispatch/lr-update/${row.id}`)} />
                      ) : (
                        <Btn label="Open dispatch" onPress={() => router.push(`/(app)/dispatch/${row.id}`)} />
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState>
            {tab === 'handed_over' ? t('noHandedOverToday', locale) : 'No orders in this dispatch bucket.'}
          </EmptyState>
        }
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
