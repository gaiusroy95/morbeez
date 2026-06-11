import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { AlertBox, Loading, QuickActionGrid, StatCard } from '@morbeez/ui-native';
import { useAgronomistDashboard } from '@/context/AgronomistDashboardContext';
import { useStaffAuth } from '@/context/StaffAuth';

export default function DashboardScreen() {
  const router = useRouter();
  const { admin } = useStaffAuth();
  const { dashboard, loading, refreshing, error, refresh } = useAgronomistDashboard();

  const quickActions = useMemo(
    () => [
      { id: 'visit', label: 'Start visit', onPress: () => router.push('/(tabs)/visits') },
      { id: 'farmers', label: 'Find farmer', onPress: () => router.push('/(tabs)/farmers') },
      { id: 'routes', label: 'Route planner', onPress: () => router.push('/route') },
      { id: 'map', label: 'Farmer map', onPress: () => router.push('/map') },
      { id: 'tasks', label: 'Task hub', onPress: () => router.push('/(tabs)/tasks') },
      { id: 'queue', label: 'Finding queue', onPress: () => router.push('/(tabs)/tasks') },
    ],
    [router]
  );

  if (loading && !dashboard) return <Loading label="Loading dashboard…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh({ force: true })} />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.greeting}>Hello{admin?.fullName ? `, ${admin.fullName}` : ''}</Text>
      <Text style={styles.subtitle}>Today&apos;s overview</Text>

      <View style={styles.statsGrid}>
        <StatCard
          label="Visits today"
          value={dashboard?.todaysVisits ?? 0}
          onPress={() => router.push('/(tabs)/visits')}
        />
        <StatCard
          label="Routes"
          value={dashboard?.routesToday ?? 0}
          onPress={() => router.push('/route')}
        />
        <StatCard
          label="Follow-ups"
          value={dashboard?.pendingFollowUps ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'follow_up' } })}
        />
        <StatCard
          label="Callbacks"
          value={dashboard?.pendingCallbacks ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'callback' } })}
        />
        <StatCard
          label="Escalations"
          value={dashboard?.openEscalations ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'escalation' } })}
        />
        <StatCard
          label="AI cases"
          value={dashboard?.aiReviewCases ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'ai_review' } })}
        />
        <StatCard
          label="Findings"
          value={dashboard?.findingReviewQueue ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'finding_review' } })}
        />
        <StatCard label="Soil reports" value={dashboard?.newSoilReports ?? 0} />
      </View>

      {(dashboard?.focusFarmers?.length ?? 0) > 0 ? (
        <View style={styles.focusSection}>
          <Text style={styles.sectionTitle}>Focus farmers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusRow}>
            {dashboard!.focusFarmers.map((f) => (
              <Pressable
                key={f.farmerId}
                style={styles.focusCard}
                onPress={() => router.push(`/farmer/${f.farmerId}`)}
              >
                <Text style={styles.focusName} numberOfLines={1}>
                  {f.farmerName}
                </Text>
                <Text style={styles.focusReason} numberOfLines={2}>
                  {f.reason}
                </Text>
                {f.riskBand ? <Text style={styles.focusMeta}>{f.riskBand}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <QuickActionGrid actions={quickActions} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: tokens.textMuted, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: tokens.text, marginBottom: 10 },
  focusSection: { marginBottom: 16 },
  focusRow: { gap: 10, paddingBottom: 4 },
  focusCard: {
    width: 160,
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  focusName: { fontSize: 15, fontWeight: '600', color: tokens.text, marginBottom: 4 },
  focusReason: { fontSize: 12, color: tokens.textMuted, lineHeight: 16 },
  focusMeta: { fontSize: 11, color: tokens.green700, marginTop: 6, fontWeight: '600' },
});
