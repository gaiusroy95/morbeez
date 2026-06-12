import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Loading, StatCard } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';
import { useTelecallerDashboard } from '@/context/TelecallerDashboardContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { admin } = useStaffAuth();
  const { locale } = useLocale();
  const { dashboard, loading, refreshing, error, refresh, offlinePending, flushOffline } =
    useTelecallerDashboard();

  if (loading && !dashboard) return <Loading label={t('loadingDashboard', locale)} />;

  const overview = dashboard?.overview;
  const qc = dashboard?.qc;

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

      <View style={styles.statsGrid}>
        <StatCard
          label="Calls today"
          value={overview?.callsToday ?? 0}
          onPress={() => router.push('/(tabs)/leads')}
        />
        <StatCard
          label={t('followUp', locale)}
          value={overview?.pendingFollowUps ?? 0}
          onPress={() => router.push('/(tabs)/follow-ups')}
        />
        <StatCard
          label="Avg QC (7d)"
          value={qc?.averageScore ?? 0}
        />
        <StatCard
          label="Flagged calls"
          value={qc?.flaggedCalls ?? 0}
        />
      </View>

      {offlinePending > 0 ? (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineText}>{offlinePending} recording(s) queued offline</Text>
          <Btn label="Retry upload" onPress={() => void flushOffline()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 16 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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
