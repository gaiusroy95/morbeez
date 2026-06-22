import { useMemo, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, t, tokens } from '@morbeez/shared';
import { AlertBox, Loading, QuickActionGrid, StatCard, stableRowKey } from '@morbeez/ui-native';
import { useAgronomistDashboard } from '@/context/AgronomistDashboardContext';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';

export default function DashboardScreen() {
  const router = useRouter();
  const { admin } = useStaffAuth();
  const { locale } = useLocale();
  const { dashboard, loading, refreshing, error, refresh } = useAgronomistDashboard();
  const [commandCenter, setCommandCenter] = useState<{
    priorityQueue: Array<{ farmerName: string; priority: string }>;
    summary: { priorityCount: number; openEscalations: number };
  } | null>(null);

  useEffect(() => {
    void agronomistClient
      .getVisitCommandCenter()
      .then((c) => setCommandCenter(c))
      .catch(() => setCommandCenter(null));
  }, [refreshing]);

  const quickActions = useMemo(
    () => [
      { id: 'visit', label: t('startVisit', locale), onPress: () => router.push('/(tabs)/visits') },
      { id: 'farmers', label: t('findFarmer', locale), onPress: () => router.push('/(tabs)/farmers') },
      { id: 'routes', label: t('routePlanner', locale), onPress: () => router.push('/route') },
      { id: 'map', label: t('farmerMap', locale), onPress: () => router.push('/map') },
      { id: 'tasks', label: t('taskHub', locale), onPress: () => router.push('/(tabs)/tasks') },
      { id: 'queue', label: t('findingQueue', locale), onPress: () => router.push('/(tabs)/tasks') },
    ],
    [router, locale]
  );

  if (loading && !dashboard) return <Loading label={t('loadingDashboard', locale)} />;

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
      <Text style={styles.subtitle}>{t('todaysOverview', locale)}</Text>

      {commandCenter ? (
        <Pressable style={styles.commandStrip} onPress={() => router.push('/visit-command')}>
          <Text style={styles.commandTitle}>Command center</Text>
          <Text style={styles.commandLine}>
            Priority visits: {commandCenter.summary.priorityCount} · Escalations:{' '}
            {commandCenter.summary.openEscalations}
          </Text>
          {commandCenter.priorityQueue.slice(0, 3).map((row, i) => (
            <Text key={i} style={styles.commandLine}>
              {row.farmerName} ({row.priority})
            </Text>
          ))}
        </Pressable>
      ) : null}

      <View style={styles.statsGrid}>
        <StatCard
          label={t('visitsToday', locale)}
          value={dashboard?.todaysVisits ?? 0}
          onPress={() => router.push('/(tabs)/visits')}
        />
        <StatCard
          label={t('routesToday', locale)}
          value={dashboard?.routesToday ?? 0}
          onPress={() => router.push('/route')}
        />
        <StatCard
          label={t('followUp', locale)}
          value={dashboard?.pendingFollowUps ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'follow_up' } })}
        />
        <StatCard
          label={t('callbacks', locale)}
          value={dashboard?.pendingCallbacks ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'callback' } })}
        />
        <StatCard
          label={t('escalations', locale)}
          value={dashboard?.openEscalations ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'escalation' } })}
        />
        <StatCard
          label={t('aiCases', locale)}
          value={dashboard?.aiReviewCases ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'ai_review' } })}
        />
        <StatCard
          label={t('findings', locale)}
          value={dashboard?.findingReviewQueue ?? 0}
          onPress={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'finding_review' } })}
        />
        <StatCard label={t('soilReports', locale)} value={dashboard?.newSoilReports ?? 0} />
      </View>

      {(dashboard?.focusFarmers?.length ?? 0) > 0 ? (
        <View style={styles.focusSection}>
          <Text style={styles.sectionTitle}>{t('focusFarmers', locale)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusRow}>
            {dashboard!.focusFarmers.map((f, index) => (
              <Pressable
                key={stableRowKey(f.farmerId, index)}
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

      <Text style={styles.sectionTitle}>{t('quickActions', locale)}</Text>
      <QuickActionGrid actions={quickActions} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: tokens.textMuted, marginBottom: 16 },
  commandStrip: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  commandTitle: { fontSize: 15, fontWeight: '600', color: tokens.text },
  commandLine: { fontSize: 13, color: tokens.textMuted },
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
