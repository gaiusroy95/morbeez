import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchMarketIntel,
  fetchPortalSummary,
  fetchWeatherIntel,
  formatInr,
  t,
  tokens,
  type PortalSummary,
} from '@morbeez/shared';
import { AlertBox, Btn, HealthBadge, Loading, Panel, QuickActionGrid, SectionHeader, StatCard, AlertCard } from '@morbeez/ui-native';
import { BulletList } from '@/components/PortalHelpers';
import { OfflineBanner, useOffline } from '@/context/OfflineContext';
import { useLocale } from '@/context/LocaleContext';

export default function HomeScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { isOnline, cacheGet, cacheSet } = useOffline();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [marketSummary, setMarketSummary] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [data, weather, market] = await Promise.all([
        fetchPortalSummary(),
        fetchWeatherIntel().catch(() => null),
        fetchMarketIntel().catch(() => null),
      ]);
      setSummary(data);
      setWeatherSummary(weather?.summary ?? null);
      setMarketSummary(market?.summary ?? null);
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

  const crop = summary?.crop;
  const glance = summary?.atAGlance;
  const rec = summary?.latestRecommendation;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <OfflineBanner />
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Text style={styles.greeting}>Hello {summary?.greetingName ?? 'Farmer'}</Text>
      <Text style={styles.sub}>Your crop control center</Text>

      {crop ? (
        <Panel title="Crop health">
          <View style={styles.healthRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cropTitle}>{crop.name}{crop.variety ? ` · ${crop.variety}` : ''}</Text>
              <Text style={styles.meta}>{crop.blockName}{crop.daysAfterPlanting != null ? ` · Day ${crop.daysAfterPlanting}` : ''}</Text>
              <Text style={styles.meta}>{crop.stage}</Text>
            </View>
            <HealthBadge status="stable" label="Monitoring" />
          </View>
        </Panel>
      ) : null}

      <Panel title="Weather">
        <Text style={styles.body}>{weatherSummary ?? 'Pull to refresh weather for your field.'}</Text>
        <Btn label="Weather & market" variant="secondary" onPress={() => router.push('/intel/weather-market')} />
      </Panel>

      {summary?.notifications?.length ? (
        <Panel title="Today's alerts">
          {summary.notifications.slice(0, 3).map((n) => (
            <AlertCard key={n.id} message={n.message} meta={n.atLabel} tone={n.tone} />
          ))}
          <Btn label="All notifications" variant="secondary" onPress={() => router.push('/intel/notifications')} />
        </Panel>
      ) : null}

      <SectionHeader title="Quick actions" />
      <QuickActionGrid
        actions={[
          { id: 'scan', label: 'AI Scan', onPress: () => router.push('/(tabs)/scan') },
          { id: 'activity', label: 'Add activity', onPress: () => router.push('/activities/add') },
          { id: 'reco', label: 'Recommendations', onPress: () => router.push('/recommendations') },
          { id: 'shop', label: 'Shop', onPress: () => router.push('/(tabs)/shop') },
          { id: 'roi', label: 'ROI', onPress: () => router.push('/intel/roi') },
        ]}
      />

      <View style={styles.statsRow}>
        <StatCard label="Active orders" value={glance?.activeOrders ?? 0} />
        <StatCard label="Est. profit" value={formatInr(glance?.estimatedProfitInr ?? 0)} />
      </View>

      {rec ? (
        <Panel title="Recent recommendation">
          <Text style={styles.meta}>{rec.dateLabel}{rec.dayLabel ? ` · ${rec.dayLabel}` : ''}</Text>
          <BulletList items={rec.bullets} />
          <Btn label="View all" variant="secondary" onPress={() => router.push('/recommendations')} />
        </Panel>
      ) : null}

      {marketSummary ? (
        <Panel title="Market price">
          <Text style={styles.body}>{marketSummary}</Text>
        </Panel>
      ) : null}

      {summary?.recentOrder ? (
        <Panel title="Recent order">
          <Text style={styles.body}>{summary.recentOrder.productTitle} · {summary.recentOrder.statusLabel}</Text>
          <Btn label="Track order" variant="secondary" onPress={() => router.push(`/order/${summary.recentOrder!.id}`)} />
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg },
  greeting: { fontSize: 24, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
  healthRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cropTitle: { fontSize: 16, fontWeight: '700', color: tokens.text },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginVertical: 12 },
  muted: { color: tokens.textMuted },
});
