import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MarketTrendChart } from '@/components/market/MarketTrendChart';
import {
  fetchMarketDashboard,
  fetchMarketTrends,
  fetchPortalSummary,
  fetchWeatherIntel,
  formatDateInLocale,
  resolveMarketRateDisplay,
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
import { useHomeDashboard, type HomeTrendRange } from '@/context/HomeDashboardContext';
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
    selectedCrop: persistedCrop,
    selectedMarket: persistedMarket,
    selectedBlockId,
    trendRange: persistedTrendRange,
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
  const [contentLoading, setContentLoading] = useState(false);

  const [displayCrop, setDisplayCrop] = useState('ginger');
  const [displayMarket, setDisplayMarket] = useState<string | null>(null);
  const [displayTrendRange, setDisplayTrendRange] = useState<HomeTrendRange>('2Y');
  const [pendingCrop, setPendingCrop] = useState<string | null>(null);
  const [pendingMarket, setPendingMarket] = useState<string | null>(null);
  const [pendingTrendRange, setPendingTrendRange] = useState<HomeTrendRange | null>(null);

  const requestIdRef = useRef(0);
  const initializedRef = useRef(false);
  const summaryRef = useRef<PortalSummary | null>(null);
  summaryRef.current = summary;
  const blockId = selectedBlockId ?? summary?.crop?.blockId ?? undefined;

  const fetchCrop = pendingCrop ?? displayCrop;
  const fetchMarket = pendingMarket ?? displayMarket ?? undefined;
  const fetchTrendRange = pendingTrendRange ?? displayTrendRange;

  useEffect(() => {
    if (!filtersReady || initializedRef.current) return;
    initializedRef.current = true;
    if (persistedCrop) setDisplayCrop(persistedCrop);
    if (persistedMarket) setDisplayMarket(persistedMarket);
    setDisplayTrendRange(persistedTrendRange);
  }, [filtersReady, persistedCrop, persistedMarket, persistedTrendRange]);

  const load = useCallback(
    async (opts?: { refreshSummary?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const isInitial = !summaryRef.current && !dashboard;
      if (isInitial) setLoading(true);
      else setContentLoading(true);
      setError('');

      try {
        const summaryPromise =
          opts?.refreshSummary || !summaryRef.current
            ? fetchPortalSummary()
            : Promise.resolve(summaryRef.current);

        const [summaryData, dash, tr, weather] = await Promise.all([
          summaryPromise,
          fetchMarketDashboard(fetchCrop, fetchMarket),
          fetchMarketTrends(fetchCrop, fetchTrendRange, fetchMarket),
          fetchWeatherIntel(blockId).catch(() => null),
        ]);

        if (requestId !== requestIdRef.current) return;

        setSummary(summaryData);
        setDashboard(dash);
        setTrends(tr);
        const alerts = weather?.diseaseAlerts ?? [];
        setWeatherMessage(alerts[0] ? formatWeatherAlert(alerts[0]) : null);
        void cacheSet('portal_summary', summaryData);

        const nextCrop = fetchCrop;
        const nextMarket = fetchMarket ?? dash.selectedMarket ?? null;
        const nextTrendRange = fetchTrendRange;

        setDisplayCrop(nextCrop);
        setDisplayMarket(nextMarket);
        setDisplayTrendRange(nextTrendRange);
        setPendingCrop(null);
        setPendingMarket(null);
        setPendingTrendRange(null);
        setSelectedCrop(nextCrop);
        if (nextMarket) setSelectedMarket(nextMarket);
        if (nextTrendRange !== persistedTrendRange) setTrendRange(nextTrendRange);

        applyDefaults({
          selectedCrop: summaryData.crop?.name?.toLowerCase() ?? dash.favoriteCrop ?? dash.crop,
          selectedMarket: dash.selectedMarket,
          selectedBlockId: summaryData.crop?.blockId ?? null,
        });
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setPendingCrop(null);
        setPendingMarket(null);
        setPendingTrendRange(null);
        const cached = await cacheGet<PortalSummary>('portal_summary');
        if (cached) {
          setSummary(cached);
          setError(isOnline ? (e instanceof Error ? e.message : 'Could not load dashboard') : t('offlineBanner', locale));
        } else {
          setError(e instanceof Error ? e.message : 'Could not load dashboard');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setContentLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      applyDefaults,
      blockId,
      cacheGet,
      cacheSet,
      dashboard,
      fetchCrop,
      fetchMarket,
      fetchTrendRange,
      isOnline,
      locale,
      persistedTrendRange,
      setSelectedCrop,
      setSelectedMarket,
      setTrendRange,
    ]
  );

  useEffect(() => {
    if (!filtersReady || !initializedRef.current) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filter fetch params change
  }, [filtersReady, fetchCrop, fetchMarket, fetchTrendRange]);

  const crops = dashboard?.crops ?? [];
  const markets = useMemo(() => dashboard?.rows?.map((r) => r.marketName) ?? [], [dashboard?.rows]);

  const cropMeta = summary?.crop;
  const heroCropName = cropTitle(displayCrop);
  const cropItem = crops.find((c) => c.cropName === displayCrop);
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

  const marketRate = useMemo(() => {
    if (!dashboard) return null;
    const resolved = resolveMarketRateDisplay(dashboard, (d) => formatDateInLocale(d, locale));
    if (!resolved) return null;
    return {
      ...resolved,
      rateLabel: t(resolved.rateLabelKey, locale),
      updatedOnLabel: resolved.updatedOnLabel
        ? t('priceUpdatedOn', locale).replace('{date}', resolved.updatedOnLabel)
        : null,
      pendingMessage: resolved.pending ? t('marketRatePending', locale) : null,
    };
  }, [dashboard, locale]);

  const greetingName = farmer?.firstName ?? summary?.greetingName?.split(' ')[0] ?? 'Farmer';

  if ((loading && !summary) || !filtersReady) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load({ refreshSummary: true });
          }}
        />
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
        crops={crops.length ? crops : [{ id: displayCrop, cropName: displayCrop, icon: cropItem?.icon }]}
        markets={markets}
        selectedCrop={displayCrop}
        selectedMarket={displayMarket ?? dashboard?.selectedMarket ?? null}
        pendingCrop={pendingCrop}
        pendingMarket={pendingMarket}
        favoriteCrop={dashboard?.favoriteCrop}
        onSelectCrop={(c) => {
          if (c === displayCrop && !pendingCrop) return;
          setPendingCrop(c);
        }}
        onSelectMarket={(m) => {
          if (m === displayMarket && !pendingMarket) return;
          setPendingMarket(m);
        }}
        cropLabel={t('selectCrop', locale)}
        marketLabel={t('selectMarket', locale)}
      />

      <View style={styles.contentBlock}>
        {contentLoading ? (
          <View style={styles.contentLoadingOverlay} pointerEvents="none">
            <ActivityIndicator color={tokens.green700} size="small" />
          </View>
        ) : null}

        {marketRate && (marketRate.showPrice || marketRate.pending) ? (
          <HomeHeroCard
            cropName={heroCropName}
            cropIcon={cropItem?.icon}
            dap={dap}
            cycleDays={cycleDays}
            stage={stage}
            marketName={dashboard!.selectedMarket ?? dashboard!.districtLabel}
            pricePerKg={marketRate.showPrice ? marketRate.pricePerKg : null}
            rateLabel={marketRate.rateLabel}
            priceUpdatedOn={marketRate.updatedOnLabel}
            pendingRateMessage={marketRate.pendingMessage}
            dailyChangePct={marketRate.showPrice ? dashboard!.dailyChangePct : null}
            lastYearPrice={marketRate.showPrice ? dashboard!.lastYearSameDayPricePerKg : null}
            differenceInr={marketRate.showPrice ? dashboard!.differenceInr : null}
            yoyPct={marketRate.showPrice ? dashboard!.yoyPct : null}
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
          activeRange={displayTrendRange}
          onRangeChange={(id) => {
            const next = id as HomeTrendRange;
            if (next === displayTrendRange && !pendingTrendRange) return;
            setPendingTrendRange(next);
          }}
          showCurrentYear={showCurrentYear}
          showLastYear={showLastYear}
          onToggleCurrentYear={() => setShowCurrentYear(!showCurrentYear)}
          onToggleLastYear={() => setShowLastYear(!showLastYear)}
          currentYearLabel={t('thisYearLine', locale)}
          lastYearLabel={t('lastYearLine', locale)}
          chart={
            overlayCurrent.length ? (
              <MarketTrendChart
                chartKey={`${displayCrop}-${displayTrendRange}-${overlayCurrent.length}-${overlayPrevious.length}`}
                current={overlayCurrent}
                previous={overlayPrevious.length ? overlayPrevious : undefined}
              />
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
      </View>

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
  contentBlock: { position: 'relative' },
  contentLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderRadius: tokens.radius,
  },
  chartEmpty: { fontSize: 13, color: tokens.textMuted, paddingVertical: 24, textAlign: 'center' },
});
