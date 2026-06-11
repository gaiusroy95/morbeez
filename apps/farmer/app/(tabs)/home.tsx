import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchPortalSummary,
  fetchWeatherIntel,
  formatDateInLocale,
  formatInr,
  t,
  tokens,
  type PortalSummary,
} from '@morbeez/shared';
import {
  AlertBox,
  AlertCard,
  Btn,
  FinanceSummaryRow,
  Loading,
  MarketRateCard,
  Panel,
  QuickActionGrid,
  SectionHeader,
  TaskCard,
} from '@morbeez/ui-native';
import { OfflineBanner, useOffline } from '@/context/OfflineContext';
import { useLocale } from '@/context/LocaleContext';

export default function HomeScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { isOnline, cacheGet, cacheSet } = useOffline();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [data, weather] = await Promise.all([
        fetchPortalSummary(),
        fetchWeatherIntel().catch(() => null),
      ]);
      setSummary(data);
      setWeatherAlerts(weather?.diseaseAlerts ?? []);
      void cacheSet('portal_summary', data);
    } catch (e) {
      const cached = await cacheGet<PortalSummary>('portal_summary');
      if (cached) {
        setSummary(cached);
        setError(isOnline ? (e instanceof Error ? e.message : 'Could not load dashboard') : t('offlineBanner', locale));
      } else {
        setError(e instanceof Error ? e.message : 'Could not load dashboard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheGet, cacheSet, isOnline, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label={t('loading', locale)} />;

  const tm = summary?.todayMarket;
  const finance = summary?.finance;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <OfflineBanner />
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Text style={styles.greeting}>Good morning, {summary?.greetingName ?? 'Farmer'}</Text>
      <Text style={styles.sub}>{formatDateInLocale(new Date(), locale)}</Text>

      {tm ? (
        <MarketRateCard
          crop={tm.crop}
          marketName={tm.marketName}
          pricePerKg={tm.pricePerKg}
          trend={tm.trend}
          onPress={() => router.push('/(tabs)/market')}
        />
      ) : null}

      {finance ? (
        <>
          <SectionHeader title="Financial summary" />
          <FinanceSummaryRow
            items={[
              { label: "Today's expense", value: formatInr(finance.todayExpenseInr) },
              { label: 'This month', value: formatInr(finance.monthExpenseInr) },
              { label: 'Projected profit', value: formatInr(finance.projectedProfitInr), highlight: true },
            ]}
          />
        </>
      ) : null}

      {summary?.tasks?.length ? (
        <Panel title="Today's tasks">
          {summary.tasks.map((task) => (
            <TaskCard
              key={task.id}
              label={task.label}
              dueLabel={task.dueLabel}
              onPress={() => router.push(task.href as '/recommendations')}
            />
          ))}
        </Panel>
      ) : null}

      {weatherAlerts.length || summary?.notifications?.length ? (
        <Panel title="Weather & alerts">
          {weatherAlerts.map((a) => (
            <AlertCard key={a} message={a} tone="warning" />
          ))}
          {summary?.notifications?.slice(0, 2).map((n) => (
            <AlertCard key={n.id} message={n.message} meta={n.atLabel} tone={n.tone} />
          ))}
        </Panel>
      ) : null}

      <SectionHeader title="Quick actions" />
      <QuickActionGrid
        actions={[
          { id: 'scan', label: t('scan', locale), onPress: () => router.push('/scan') },
          { id: 'expense', label: t('addExpense', locale), onPress: () => router.push('/roi/quick-expense') },
          { id: 'activity', label: t('activities', locale), onPress: () => router.push('/activities/add') },
          { id: 'fields', label: t('fields', locale), onPress: () => router.push('/fields') },
          { id: 'reco', label: t('recommendations', locale), onPress: () => router.push('/recommendations') },
        ]}
      />

      <Btn label={t('myFields', locale)} onPress={() => router.push('/fields')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 24, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
});
