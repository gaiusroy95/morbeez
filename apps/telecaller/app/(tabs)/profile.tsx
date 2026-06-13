import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { t, tokens } from '@morbeez/shared';
import { Btn, LanguagePicker, Loading, Panel, StatCard } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';
import { useTelecallerDashboard } from '@/context/TelecallerDashboardContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { admin, logout } = useStaffAuth();
  const { locale, setLocale } = useLocale();
  const { dashboard, loading } = useTelecallerDashboard();
  const overview = dashboard?.overview;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Panel title={admin?.fullName ?? admin?.email ?? t('telecaller', locale)}>
        <Text style={styles.email}>{admin?.email}</Text>
        <Btn
          label={admin?.hasPassword ? t('changePassword', locale) : t('setPassword', locale)}
          variant="secondary"
          onPress={() => router.push('/change-password' as never)}
        />
      </Panel>

      <Panel title="This month">
        {loading && !overview ? (
          <Loading label="Loading stats…" />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard label="Revenue" value={`₹${(overview?.revenue ?? 0).toLocaleString('en-IN')}`} />
            <StatCard
              label="Target"
              value={`₹${((overview?.monthlyTarget ?? 0) / 1000).toFixed(0)}k`}
            />
            <StatCard label="Orders" value={overview?.ordersGenerated ?? 0} />
            <StatCard label="Conversion" value={`${overview?.conversionRate ?? 0}%`} />
          </View>
        )}
      </Panel>

      <Panel title={t('language', locale)}>
        <Text style={styles.hint}>{t('languageHint', locale)}</Text>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </Panel>

      <Panel title="Settings">
        <Text style={styles.hint}>Notification preferences will be available in a future update.</Text>
      </Panel>

      <Btn label={t('logout', locale)} onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  email: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
