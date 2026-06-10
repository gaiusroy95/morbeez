import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { STAFF_API_V1, staffApi, tokens } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, ListCard, Loading, StatCard } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

const WMS = `${STAFF_API_V1}/os/warehouse`;

type QueueFilter = 'pending' | 'packed' | 'lr_pending' | 'completed';

type Stats = {
  pending: number;
  packed: number;
  lrPending: number;
  completed: number;
};

type QueueRow = {
  id: string;
  orderName: string;
  customerName?: string | null;
  courier: string;
  itemCount: number;
  priority: string;
  omsStatus: string;
  awb: string | null;
  needsManualTracking?: boolean;
  isCod?: boolean;
  totalAmount?: number;
  createdAt?: string;
};

const QUEUE_FILTERS: Array<{ id: QueueFilter; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'packed', label: 'Packed' },
  { id: 'lr_pending', label: 'LR Pending' },
  { id: 'completed', label: 'Completed' },
];

function queueFilterBucket(row: QueueRow): QueueFilter {
  const status = row.omsStatus;
  if (status === 'awaiting_tracking' || row.needsManualTracking) return 'lr_pending';
  if (['ready_dispatch', 'shipped', 'delivered', 'completed'].includes(status)) {
    return 'completed';
  }
  if (['packed', 'awaiting_label_verification'].includes(status)) return 'packed';
  return 'pending';
}

export default function QueueScreen() {
  const router = useRouter();
  const { logout, canWrite } = useStaffAuth();
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('pending');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, q] = await Promise.all([
        staffApi<{ ok: boolean; stats: Stats }>(`${WMS}/fulfillment/stats`),
        staffApi<{ ok: boolean; queue: QueueRow[] }>(`${WMS}/fulfillment/queue?repair=true&limit=60`),
      ]);
      setStats(s.stats);
      setQueue(q.queue ?? []);
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

  async function syncInventory() {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await staffApi<{
        ok: boolean;
        syncedQty?: number;
        repaired?: number;
        failed?: number;
        queue: QueueRow[];
      }>(`${WMS}/fulfillment/sync-inventory`, { method: 'POST' });
      setQueue(r.queue ?? []);
      const parts: string[] = [];
      if (r.syncedQty) parts.push(`${r.syncedQty} units synced`);
      if (r.repaired) parts.push(`${r.repaired} pick lists rebuilt`);
      if (r.failed) parts.push(`${r.failed} still blocked`);
      setMessage(parts.length ? parts.join(' · ') : 'Sync finished');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  const filteredQueue = useMemo(
    () => queue.filter((row) => queueFilterBucket(row) === queueFilter),
    [queue, queueFilter]
  );

  const filterCounts = useMemo(
    () => ({
      pending: stats?.pending ?? queue.filter((r) => queueFilterBucket(r) === 'pending').length,
      packed: stats?.packed ?? queue.filter((r) => queueFilterBucket(r) === 'packed').length,
      lr_pending:
        stats?.lrPending ?? queue.filter((r) => queueFilterBucket(r) === 'lr_pending').length,
      completed: stats?.completed ?? queue.filter((r) => queueFilterBucket(r) === 'completed').length,
    }),
    [queue, stats]
  );

  if (loading) return <Loading label="Loading fulfillment queue…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filteredQueue}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
              <StatCard label="Pending" value={filterCounts.pending} />
              <View style={styles.statGap} />
              <StatCard label="Packed" value={filterCounts.packed} />
              <View style={styles.statGap} />
              <StatCard label="LR pending" value={filterCounts.lr_pending} />
              <View style={styles.statGap} />
              <StatCard label="Completed" value={filterCounts.completed} />
            </ScrollView>
            <HubTabs
              tabs={QUEUE_FILTERS.map((f) => ({
                id: f.id,
                label: `${f.label} (${filterCounts[f.id]})`,
              }))}
              active={queueFilter}
              onChange={setQueueFilter}
            />
            {canWrite ? (
              <Btn
                label={busy ? 'Syncing…' : 'Sync inventory & repair pick lists'}
                onPress={syncInventory}
                disabled={busy}
                variant="secondary"
              />
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <ListCard
            title={item.orderName}
            subtitle={[
              item.customerName,
              `${item.itemCount} items`,
              item.isCod ? 'COD' : null,
              item.totalAmount != null ? `₹${item.totalAmount}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            meta={item.omsStatus}
            onPress={() => router.push(`/(app)/order/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState>No orders in this queue bucket.</EmptyState>}
        ListFooterComponent={<Btn label="Sign out" onPress={() => void logout()} variant="secondary" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: { marginBottom: 12 },
  statGap: { width: 8 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
});
