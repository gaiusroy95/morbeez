import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel, StatCard } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';
import { useTelecallerDashboard } from '@/context/TelecallerDashboardContext';
import { SalesOpportunitiesPanel } from '@/components/SalesOpportunitiesPanel';

export default function DashboardScreen() {
  const router = useRouter();
  const { admin } = useStaffAuth();
  const { locale } = useLocale();
  const { dashboard, loading, refreshing, error, refresh, offlinePending, flushOffline } =
    useTelecallerDashboard();

  if (loading && !dashboard) return <Loading label={t('loadingDashboard', locale)} />;

  const overview = dashboard?.overview;
  const qc = dashboard?.qc;
  const actionQueue = dashboard?.actionQueue ?? [];
  const todaysTasks = dashboard?.todaysTasks ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh({ force: true })} />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.greeting}>
        {t('hello', locale)}
        {admin?.fullName ? `, ${admin.fullName}` : ''}
      </Text>

      <Panel title="Today's work">
        <View style={styles.statsGrid}>
          <StatCard label="Calls today" value={overview?.callsToday ?? 0} />
          <StatCard
            label={t('followUp', locale)}
            value={overview?.pendingFollowUps ?? 0}
            onPress={() => router.push('/(tabs)/follow-ups')}
          />
          <StatCard label="Due today" value={overview?.followUpsDueToday ?? 0} />
          <StatCard label="Escalations" value={overview?.openEscalations ?? dashboard?.escalations ?? 0} />
        </View>
      </Panel>

      <Panel title="Revenue">
        <View style={styles.statsGrid}>
          <StatCard
            label="Monthly target"
            value={`₹${((overview?.monthlyTarget ?? 0) / 1000).toFixed(0)}k`}
          />
          <StatCard label="Achieved" value={`₹${(overview?.revenue ?? 0).toLocaleString('en-IN')}`} />
          <StatCard label="Orders" value={overview?.ordersGenerated ?? 0} />
          <StatCard label="Conversion" value={`${overview?.conversionRate ?? 0}%`} />
        </View>
      </Panel>

      <Panel title="Action queue">
        {actionQueue.length ? (
          actionQueue.map((item) => (
            <Pressable
              key={item.id}
              style={styles.queueRow}
              onPress={() => item.leadId && router.push(`/lead/${item.leadId}`)}
            >
              <Text style={styles.queueLabel}>{item.label}</Text>
              <Text style={styles.queueMeta}>
                {item.count} · {item.farmerName ?? 'Farmer'}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.empty}>No urgent actions right now.</Text>
        )}
      </Panel>

      <Panel title="Today's tasks">
        {todaysTasks.length ? (
          todaysTasks.map((task) => (
            <Pressable
              key={task.id}
              style={styles.queueRow}
              onPress={() => task.leadId && router.push(`/lead/${task.leadId}`)}
            >
              <Text style={styles.queueLabel}>{task.title}</Text>
              <Text style={styles.queueMeta}>{task.dueLabel ?? task.farmerName ?? '—'}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.empty}>No tasks scheduled for today.</Text>
        )}
      </Panel>

      <Panel title="Sales opportunities (partner handoffs)">
        <SalesOpportunitiesPanel />
      </Panel>

      <Panel title="Quality (7 days)">
        <View style={styles.statsGrid}>
          <StatCard label="Avg QC" value={qc?.averageScore ?? 0} />
          <StatCard label="Flagged calls" value={qc?.flaggedCalls ?? 0} />
        </View>
      </Panel>

      {offlinePending > 0 ? (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineText}>{offlinePending} recording(s) queued offline</Text>
          <Btn label="Retry upload" onPress={() => void flushOffline()} />
        </View>
      ) : null}

      <Btn label={t('farmers', locale)} onPress={() => router.push('/(tabs)/farmers' as never)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  queueRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  queueLabel: { fontSize: 15, fontWeight: '600', color: tokens.text },
  queueMeta: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
  empty: { fontSize: 13, color: tokens.textMuted },
  offlineBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#fffbeb',
    gap: 8,
  },
  offlineText: { color: tokens.text, fontSize: 14 },
});
