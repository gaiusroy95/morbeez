import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import {
  fetchMarketDashboard,
  fetchMarketTrends,
  fetchPortalSummary,
  fetchWeatherIntel,
  formatDateInLocale,
  t,
  tokens,
  type MarketDashboard,
  type MarketTrends,
  type PortalSummary,
} from '@morbeez/shared';
import {
  AlertBox,
  CropMarketSelectors,
  HomeHeroCard,
  HomeQuickActions,
  Loading,
  MarketAnalyticsPanel,
  WeatherAlertBanner,
} from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useHomeDashboard } from '@/context/HomeDashboardContext';
import { OfflineBanner, useOffline } from '@/context/OfflineContext';
import { useLocale } from '@/context/LocaleContext';

function cropTitle(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatWeatherAlert(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function HomeScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { farmer } = useFarmerAuth();
  const { isOnline, cacheGet, cacheSet } = useOffline();
  const {
    selectedCrop,
    selectedMarket,
    selectedBlockId,
    trendRange,
    showCurrentYear,
    showLastYear,
    setSelectedCrop,
    setSelectedMarket,
    setTrendRange,
    setShowCurrentYear,
    setShowLastYear,
    applyDefaults,
    ready: filtersReady,
  } = useHomeDashboard();

  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [dashboard, setDashboard] = useState<MarketDashboard | null>(null);
  const [trends, setTrends] = useState<MarketTrends | null>(null);
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const crop =
    selectedCrop ?? dashboard?.crop ?? summary?.crop?.name?.toLowerCase() ?? dashboard?.favoriteCrop ?? 'ginger';
  const market = selectedMarket ?? dashboard?.selectedMarket ?? undefined;
  const blockId = selectedBlockId ?? summary?.crop?.blockId ?? undefined;

  const load = useCallback(async () => {
    setError('');
    try {
      const [summaryData, dash, tr, weather] = await Promise.all([
        fetchPortalSummary(),
        fetchMarketDashboard(crop, market),
        fetchMarketTrends(crop, trendRange, market),
        fetchWeatherIntel(blockId).catch(() => null),
      ]);
      setSummary(summaryData);
      setDashboard(dash);
      setTrends(tr);
      const alerts = weather?.diseaseAlerts ?? [];
      setWeatherMessage(alerts[0] ? formatWeatherAlert(alerts[0]) : null);
      void cacheSet('portal_summary', summaryData);
      applyDefaults({
        selectedCrop: summaryData.crop?.name?.toLowerCase() ?? dash.favoriteCrop ?? dash.crop,
        selectedMarket: dash.selectedMarket,
        selectedBlockId: summaryData.crop?.blockId ?? null,
      });
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
  }, [applyDefaults, blockId, cacheGet, cacheSet, crop, isOnline, locale, market, trendRange]);

  useEffect(() => {
    if (!filtersReady) return;
    setLoading(true);
    void load();
  }, [load, filtersReady]);

  const crops = dashboard?.crops ?? [];
  const markets = useMemo(() => dashboard?.rows?.map((r) => r.marketName) ?? [], [dashboard?.rows]);

  const cropMeta = summary?.crop;
  const heroCropName = cropTitle(crop);
  const cropItem = crops.find((c) => c.cropName === crop);
  const dap = cropMeta?.daysAfterPlanting ?? null;
  const cycleDays = cropMeta?.cycleDays ?? 270;
  const stage = cropMeta?.stage ?? 'Growing';

  const overlayCurrent = useMemo(
    () => (showCurrentYear ? trends?.overlayCurrent?.map((p) => ({ value: p.value, label: p.label })) ?? [] : []),
    [showCurrentYear, trends?.overlayCurrent]
  );
  const overlayPrevious = useMemo(
    () => (showLastYear ? trends?.overlayPrevious?.map((p) => ({ value: p.value, label: p.label })) ?? [] : []),
    [showLastYear, trends?.overlayPrevious]
  );

  const greetingName = farmer?.firstName ?? summary?.greetingName?.split(' ')[0] ?? 'Farmer';

  if ((loading && !summary) || !filtersReady) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      <OfflineBanner />
      {error ? <AlertBox>{error}</AlertBox> : null}

      <View style={styles.greetingRow}>
        <View style={styles.greetingCol}>
          <Text style={styles.greeting}>
            {t('goodMorning', locale)}, {greetingName} 👋
          </Text>
          <Text style={styles.sub}>{formatDateInLocale(new Date(), locale)}</Text>
        </View>
        <Pressable style={styles.notifBtn} onPress={() => router.push('/intel/notifications')}>
          <Text style={styles.notifIcon}>🔔</Text>
          {(summary?.notifications?.length ?? 0) > 0 ? (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {Math.min(summary!.notifications.length, 9)}
                {summary!.notifications.length > 9 ? '+' : ''}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <CropMarketSelectors
        crops={crops.length ? crops : [{ id: crop, cropName: crop, icon: cropItem?.icon }]}
        markets={markets}
        selectedCrop={crop}
        selectedMarket={market ?? dashboard?.selectedMarket ?? null}
        favoriteCrop={dashboard?.favoriteCrop}
        onSelectCrop={(c) => {
          setSelectedCrop(c);
          setLoading(true);
        }}
        onSelectMarket={(m) => {
          setSelectedMarket(m);
          setLoading(true);
        }}
        cropLabel={t('selectCrop', locale)}
        marketLabel={t('selectMarket', locale)}
      />

      {dashboard?.todayPrice != null ? (
        <HomeHeroCard
          cropName={heroCropName}
          cropIcon={cropItem?.icon}
          dap={dap}
          cycleDays={cycleDays}
          stage={stage}
          marketName={dashboard.selectedMarket ?? dashboard.districtLabel}
          pricePerKg={dashboard.todayPrice}
          dailyChangePct={dashboard.dailyChangePct}
          lastYearPrice={dashboard.lastYearSameDayPricePerKg}
          differenceInr={dashboard.differenceInr}
          yoyPct={dashboard.yoyPct}
          labels={{
            currentRate: t('currentMarketRate', locale),
            lastYearSameDay: t('lastYearSameDay', locale),
            difference: t('priceDifference', locale),
            yoyChange: t('yoyChange', locale),
            dap: t('dapLabel', locale),
          }}
        />
      ) : null}

      <MarketAnalyticsPanel
        title={t('marketTrendTitle', locale).replace('{crop}', heroCropName)}
        ranges={[
          { id: '30D', label: '30D' },
          { id: '90D', label: '90D' },
          { id: '1Y', label: '1Y' },
          { id: '2Y', label: '2Y' },
        ]}
        activeRange={trendRange}
        onRangeChange={(id) => {
          setTrendRange(id as typeof trendRange);
          setLoading(true);
        }}
        showCurrentYear={showCurrentYear}
        showLastYear={showLastYear}
        onToggleCurrentYear={() => setShowCurrentYear(!showCurrentYear)}
        onToggleLastYear={() => setShowLastYear(!showLastYear)}
        currentYearLabel={t('thisYearLine', locale)}
        lastYearLabel={t('lastYearLine', locale)}
        chart={
          overlayCurrent.length ? (
            <View>
              <LineChart
                data={overlayCurrent}
                data2={overlayPrevious.length ? overlayPrevious : undefined}
                color={tokens.green700}
                color2={tokens.textMuted}
                thickness={2}
                thickness2={2}
                hideDataPoints={overlayCurrent.length > 8}
                yAxisTextStyle={{ color: tokens.textMuted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: tokens.textMuted, fontSize: 9 }}
              />
              <View style={styles.legendRow}>
                {showCurrentYear ? <Text style={styles.legendCurrent}>● {t('thisYearLine', locale)}</Text> : null}
                {showLastYear ? <Text style={styles.legendPrev}>● {t('lastYearLine', locale)}</Text> : null}
              </View>
            </View>
          ) : (
            <Text style={styles.chartEmpty}>{t('noTrendData', locale)}</Text>
          )
        }
      />

      {weatherMessage ? (
        <WeatherAlertBanner
          message={weatherMessage}
          actionLabel={t('viewDetails', locale)}
          onPress={() => router.push('/intel/weather-market')}
        />
      ) : null}

      <HomeQuickActions
        title={t('quickActions', locale)}
        actions={[
          {
            id: 'scan',
            label: t('aiScan', locale),
            subtitle: t('aiScanSub', locale),
            icon: '📷',
            onPress: () => router.push('/scan'),
          },
          {
            id: 'activities',
            label: t('activities', locale),
            subtitle: t('activitiesSub', locale),
            icon: '📋',
            onPress: () => router.push('/fields'),
          },
          {
            id: 'fields',
            label: t('myBlocks', locale),
            subtitle: t('myFieldsSub', locale),
            icon: '🌾',
            onPress: () => router.push('/fields'),
          },
          {
            id: 'reco',
            label: t('recommendations', locale),
            subtitle: t('recommendationsSub', locale),
            icon: '💡',
            onPress: () => router.push('/recommendations'),
          },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  greetingCol: { flex: 1 },
  greeting: { fontSize: 22, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginTop: 4 },
  notifBtn: { padding: 8, position: 'relative' },
  notifIcon: { fontSize: 22 },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: tokens.danger,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendCurrent: { fontSize: 12, color: tokens.green700 },
  legendPrev: { fontSize: 12, color: tokens.textMuted },
  chartEmpty: { fontSize: 13, color: tokens.textMuted, paddingVertical: 24, textAlign: 'center' },
});
