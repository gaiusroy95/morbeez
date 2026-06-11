import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  filterPackQueueByTab,
  formatCompletedTime,
  t,
  tokens,
  type PackQueueTab,
} from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

function parsePackTab(raw: string | string[] | undefined): PackQueueTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'packing' || v === 'awaiting_pack' || v === 'completed_today' || v === 'all') return v;
  return 'all';
}

export default function PackingQueueScreen() {
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
  const [tab, setTab] = useState<PackQueueTab>(() => parsePackTab(tabParam));

  useEffect(() => {
    if (tabParam) setTab(parsePackTab(tabParam));
  }, [tabParam]);

  const filtered = useMemo(() => {
    if (tab === 'completed_today') return completedToday.packedToday;
    return filterPackQueueByTab(queue, tab);
  }, [queue, tab, completedToday.packedToday]);

  const counts = useMemo(
    () => ({
      all: filterPackQueueByTab(queue, 'all').length,
      packing: filterPackQueueByTab(queue, 'packing').length,
      awaiting_pack: filterPackQueueByTab(queue, 'awaiting_pack').length,
      completed_today: stats?.packedToday ?? completedToday.packedToday.length,
    }),
    [queue, stats?.packedToday, completedToday.packedToday.length]
  );

  const tabs: Array<{ id: PackQueueTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'packing', label: t('packing', locale) },
    { id: 'awaiting_pack', label: t('awaitingPack', locale) },
    { id: 'completed_today', label: t('completedToday', locale) },
  ];

  if (queueLoading && !queue.length) return <Loading label="Loading packing queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
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
              tabs={tabs.map((item) => ({ id: item.id, label: `${item.label} (${counts[item.id]})` }))}
              active={tab}
              onChange={setTab}
            />
          </>
        }
        renderItem={({ item }) => {
          const completedAt = formatCompletedTime(item.packedAt, locale);
          return (
            <>
              <ListCard
                title={item.orderName}
                subtitle={[item.customerName, `${item.itemCount} items`, item.courier].filter(Boolean).join(' · ')}
                meta={tab === 'completed_today' && completedAt ? `Packed ${completedAt}` : item.omsStatus}
                onPress={() => router.push(`/(app)/packing/${item.id}`)}
              />
              {tab !== 'completed_today' ? (
                <View style={styles.cardAction}>
                  <Btn label="Open pack screen" onPress={() => router.push(`/(app)/packing/${item.id}`)} />
                </View>
              ) : null}
            </>
          );
        }}
        ListEmptyComponent={
          <EmptyState>
            {tab === 'completed_today'
              ? t('noCompletedPackingToday', locale)
              : 'No orders in this packing bucket.'}
          </EmptyState>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  cardAction: { marginTop: -4, marginBottom: 12, paddingHorizontal: 4 },
});
