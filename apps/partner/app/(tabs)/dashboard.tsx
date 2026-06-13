import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerClient, tokens, type PartnerDashboardStats } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel, StatCard } from '@morbeez/ui-native';
import { usePartnerAuth } from '@/context/PartnerAuth';

export default function DashboardScreen() {
  const router = useRouter();
  const { partner } = usePartnerAuth();
  const [stats, setStats] = useState<PartnerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setStats(await partnerClient.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) return <Loading label="Loading dashboard…" />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.greeting}>
        Hello{partner?.fullName ? `, ${partner.fullName}` : ''}
      </Text>

      <Panel title="Today's work">
        <View style={styles.statsGrid}>
          <StatCard
            label="Active farmers"
            value={stats?.activeFarmers ?? 0}
            onPress={() => router.push('/(tabs)/farmers')}
          />
          <StatCard
            label="Pending tasks"
            value={stats?.pendingTasks ?? 0}
            onPress={() => router.push('/(tabs)/tasks')}
          />
          <StatCard
            label="Visits this month"
            value={stats?.visitsThisMonth ?? 0}
            onPress={() => router.push('/(tabs)/visits')}
          />
          <StatCard
            label="Lead offers"
            value={stats?.leadOffersPending ?? 0}
            onPress={() => router.push('/(tabs)/leads')}
          />
        </View>
      </Panel>

      <Panel title="Performance">
        <View style={styles.statsGrid}>
          <StatCard label="Performance score" value={stats?.performanceScore ?? 0} />
          <StatCard
            label="Notifications"
            value="View"
            onPress={() => router.push('/(tabs)/notifications')}
          />
        </View>
      </Panel>

      <Panel title="Quick actions">
        <Pressable style={styles.actionRow} onPress={() => router.push('/(tabs)/farmers')}>
          <Text style={styles.actionLabel}>Browse farmers</Text>
          <Text style={styles.actionMeta}>Open farmer workspaces</Text>
        </Pressable>
        <Pressable style={styles.actionRow} onPress={() => router.push('/(tabs)/tasks')}>
          <Text style={styles.actionLabel}>Review tasks</Text>
          <Text style={styles.actionMeta}>Accept, reschedule, or complete</Text>
        </Pressable>
        <Pressable style={styles.actionRow} onPress={() => router.push('/(tabs)/leads')}>
          <Text style={styles.actionLabel}>Lead offers</Text>
          <Text style={styles.actionMeta}>
            {stats?.leadOffersPending ?? 0} pending allocation(s)
          </Text>
        </Pressable>
      </Panel>

      <Btn label="My referral QR" onPress={() => router.push('/referral')} variant="secondary" />
      <Btn label="Profile & earnings" onPress={() => router.push('/(tabs)/profile')} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  actionLabel: { fontSize: 15, fontWeight: '600', color: tokens.text },
  actionMeta: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
});
