import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { AlertBox, Btn, DonutChart, Loading, StatCard } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { admin } = useStaffAuth();
  const { stats, statsLoading, refreshing, error, refreshStats, refreshQueue } = useWarehouseQueue();

  const progressSegments = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Assigned', value: stats.pendingOrders ?? 0, color: tokens.green100 },
      { label: 'Picking', value: stats.picking ?? 0, color: tokens.green400 },
      { label: 'Packing', value: stats.packing ?? stats.packed ?? 0, color: tokens.green500 },
      { label: 'Ready', value: stats.readyDispatch ?? 0, color: tokens.green700 },
      { label: 'LR Pending', value: stats.awaitingTracking ?? stats.lrPending ?? 0, color: tokens.warning },
    ].filter((s) => s.value > 0);
  }, [stats]);

  const totalActive = useMemo(() => progressSegments.reduce((s, x) => s + x.value, 0), [progressSegments]);

  const refreshAll = () => {
    void refreshStats({ force: true });
    void refreshQueue({ force: true });
  };

  if (statsLoading && !stats) return <Loading label="Loading dashboard…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshAll}
        />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.greeting}>Hello{admin?.fullName ? `, ${admin.fullName}` : ''}</Text>
      <Text style={styles.subtitle}>Today&apos;s fulfillment overview</Text>

      <View style={styles.statsGrid}>
        <StatCard
          label="Assigned"
          value={stats?.pendingOrders ?? 0}
          onPress={() => router.push({ pathname: '/(app)/(tabs)/picking', params: { tab: 'assigned' } })}
        />
        <StatCard
          label="Picking"
          value={stats?.picking ?? 0}
          onPress={() => router.push({ pathname: '/(app)/(tabs)/picking', params: { tab: 'in_progress' } })}
        />
        <StatCard
          label="Packing"
          value={stats?.packing ?? 0}
          onPress={() => router.push({ pathname: '/(app)/(tabs)/packing', params: { tab: 'packing' } })}
        />
        <StatCard
          label="Awaiting pack"
          value={stats?.packed ?? stats?.readyToPack ?? 0}
          onPress={() => router.push({ pathname: '/(app)/(tabs)/packing', params: { tab: 'awaiting_pack' } })}
        />
        <StatCard
          label="Ready dispatch"
          value={stats?.readyDispatch ?? 0}
          onPress={() => router.push({ pathname: '/(app)/(tabs)/dispatch', params: { tab: 'ready' } })}
        />
        <StatCard
          label="LR pending"
          value={stats?.awaitingTracking ?? stats?.lrPending ?? 0}
          onPress={() => router.push({ pathname: '/(app)/(tabs)/dispatch', params: { tab: 'lr_pending' } })}
        />
      </View>

      {progressSegments.length > 0 ? (
        <View style={styles.progressCard}>
          <Text style={styles.cardTitle}>Today&apos;s progress</Text>
          <DonutChart segments={progressSegments} size={160} />
          <Text style={styles.progressMeta}>{totalActive} active orders in pipeline</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Btn label="Go to picking" onPress={() => router.push('/(app)/(tabs)/picking')} />
        <Btn label="Go to packing" onPress={() => router.push('/(app)/(tabs)/packing')} variant="secondary" />
        <Btn label="Go to dispatch" onPress={() => router.push('/(app)/(tabs)/dispatch')} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: tokens.textMuted, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  progressCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: tokens.text, marginBottom: 12 },
  progressMeta: { fontSize: 13, color: tokens.textMuted, marginTop: 8, textAlign: 'center' },
  actions: { gap: 8 },
});
