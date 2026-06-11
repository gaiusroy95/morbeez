import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MarketTrendChart } from '@/components/market/MarketTrendChart';
import {
  fetchMarketDashboard,
  fetchMarketTrends,
  fetchMandiComparison,
  fetchMultiCropComparison,
  t,
  tokens,
  type MandiComparison,
  type MarketDashboard,
  type MarketTrends,
  type MultiCropComparison,
} from '@morbeez/shared';
import { AlertBox, HubTabs, KeyValueRow, Loading, MarketRateCard, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type MarketTab = 'today' | 'trends' | 'comparison' | 'markets';

function cropTitle(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function signalLabel(signal: 'strong' | 'weak' | 'neutral', locale: Parameters<typeof t>[1]) {
  if (signal === 'strong') return t('strongMarket', locale);
  if (signal === 'weak') return t('weakTrend', locale);
  return '—';
}

export default function MarketTabScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [tab, setTab] = useState<MarketTab>('today');
  const [dashboard, setDashboard] = useState<MarketDashboard | null>(null);
  const [trends, setTrends] = useState<MarketTrends | null>(null);
  const [mandi, setMandi] = useState<MandiComparison | null>(null);
  const [cropCompare, setCropCompare] = useState<MultiCropComparison | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  const [displayCrop, setDisplayCrop] = useState('ginger');
  const [displayMarket, setDisplayMarket] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<string | null>(null);
  const [pendingMarket, setPendingMarket] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const dashboardRef = useRef<MarketDashboard | null>(null);
  dashboardRef.current = dashboard;

  const fetchCrop = pendingCrop ?? displayCrop;
  const fetchMarket = pendingMarket ?? displayMarket ?? undefined;

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isInitial = !dashboardRef.current;
    if (isInitial) setLoading(true);
    else setContentLoading(true);
    setError('');

    try {
      const [d, tr, mc, cc] = await Promise.all([
        fetchMarketDashboard(fetchCrop, fetchMarket),
        fetchMarketTrends(fetchCrop, '1Y', fetchMarket),
        fetchMandiComparison(fetchCrop, fetchMarket),
        fetchMultiCropComparison(fetchMarket),
      ]);

      if (requestId !== requestIdRef.current) return;

      setDashboard(d);
      setTrends(tr);
      setMandi(mc);
      setCropCompare(cc);

      const nextCrop = fetchCrop;
      const nextMarket = fetchMarket ?? d.selectedMarket ?? null;
      setDisplayCrop(nextCrop);
      setDisplayMarket(nextMarket);
      setPendingCrop(null);
      setPendingMarket(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setPendingCrop(null);
      setPendingMarket(null);
      setError(e instanceof Error ? e.message : 'Could not load market data');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setContentLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetchCrop, fetchMarket]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filter fetch params change
  }, [fetchCrop, fetchMarket]);

  const crops = dashboard?.crops ?? [];
  const markets = useMemo(() => dashboard?.rows?.map((r) => r.marketName) ?? [], [dashboard?.rows]);

  const overlayCurrent =
    trends?.overlayCurrent?.map((p) => ({ value: p.value, label: p.label })) ?? [];
  const overlayPrevious =
    trends?.overlayPrevious?.map((p) => ({ value: p.value, label: p.label })) ?? [];

  if (loading && !dashboard) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Text style={styles.sectionLabel}>{t('selectCrop', locale)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {crops.map((c) => {
          const active = c.cropName === displayCrop;
          const pending = pendingCrop === c.cropName;
          const isFavorite = c.cropName === dashboard?.favoriteCrop;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, active && styles.chipActive, pending && styles.chipPending]}
              onPress={() => {
                if (c.cropName === displayCrop && !pendingCrop) return;
                setPendingCrop(c.cropName);
              }}
              disabled={pending}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.icon ? `${c.icon} ` : ''}
                {cropTitle(c.cropName)}
                {isFavorite ? ' ★' : ''}
                {pending ? ' …' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {markets.length ? (
        <>
          <Text style={styles.sectionLabel}>{t('selectMarket', locale)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {markets.map((m) => {
              const active = m === displayMarket;
              const pending = pendingMarket === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.chip, styles.chipMarket, active && styles.chipActive, pending && styles.chipPending]}
                  onPress={() => {
                    if (m === displayMarket && !pendingMarket) return;
                    setPendingMarket(m);
                  }}
                  disabled={pending}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {m}
                    {pending ? ' …' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <HubTabs
        tabs={[
          { id: 'today' as MarketTab, label: t('marketOverview', locale) },
          { id: 'trends' as MarketTab, label: t('trendAnalytics', locale) },
          { id: 'comparison' as MarketTab, label: t('multiCropComparison', locale) },
          { id: 'markets' as MarketTab, label: t('mandiComparison', locale) },
        ]}
        active={tab}
        onChange={setTab}
      />

      <View style={styles.contentBlock}>
        {contentLoading ? (
          <View style={styles.contentLoadingOverlay} pointerEvents="none">
            <ActivityIndicator color={tokens.green700} size="small" />
          </View>
        ) : null}

        {tab === 'today' && dashboard?.todayPrice ? (
          <>
            <MarketRateCard
              crop={cropTitle(displayCrop)}
              marketName={dashboard.selectedMarket ?? dashboard.districtLabel}
              pricePerKg={dashboard.todayPrice}
              trend={dashboard.dailyTrend ?? dashboard.trend}
              dailyChangeInr={dashboard.dailyChangeInr}
              onPress={() => router.push(`/market/trends/${displayCrop}`)}
            />
            {dashboard.weeklyTrendPct != null ? (
              <Text style={styles.meta}>
                {t('weeklyTrend', locale)}: {dashboard.weeklyTrendPct > 0 ? '+' : ''}
                {dashboard.weeklyTrendPct}%
              </Text>
            ) : null}
            {dashboard.yoyPct != null ? (
              <Text style={styles.meta}>
                {t('thisYearVsLast', locale)}: {dashboard.yoyPct > 0 ? '+' : ''}
                {dashboard.yoyPct}%
              </Text>
            ) : null}
          </>
        ) : null}

        {tab === 'trends' ? (
          <>
            {overlayCurrent.length ? (
              <Panel title={t('thisYearVsLast', locale)}>
                <MarketTrendChart
                  chartKey={`${displayCrop}-${overlayCurrent.length}`}
                  current={overlayCurrent}
                  previous={overlayPrevious.length ? overlayPrevious : undefined}
                  showLegend
                  currentLabel={t('thisYearLine', locale)}
                  previousLabel={t('lastYearLine', locale)}
                />
              </Panel>
            ) : null}
            {trends?.insights?.length ? (
              <Panel title={t('trendAnalytics', locale)}>
                {trends.insights.map((line) => (
                  <Text key={line} style={styles.insight}>
                    • {line}
                  </Text>
                ))}
              </Panel>
            ) : null}
          </>
        ) : null}

        {tab === 'comparison' && cropCompare?.crops?.length ? (
          <Panel title={t('multiCropComparison', locale)}>
            {cropCompare.crops.map((c) => (
              <KeyValueRow
                key={c.crop}
                label={`${c.icon ?? ''} ${cropTitle(c.crop)}`.trim()}
                value={
                  c.pricePerKg != null
                    ? `₹${c.pricePerKg}/kg · ${signalLabel(c.signal, locale)}`
                    : '—'
                }
              />
            ))}
            {cropCompare.bestCrop ? (
              <Text style={styles.meta}>
                {t('opportunity', locale)}: {cropTitle(cropCompare.bestCrop)}
              </Text>
            ) : null}
          </Panel>
        ) : null}

        {tab === 'markets' && mandi?.rows?.length ? (
          <Panel title={t('mandiComparison', locale)}>
            {mandi.rows.map((r, index) => (
              <View key={`${r.marketName}-${index}`} style={r.isHighest ? styles.bestRow : undefined}>
                <KeyValueRow
                  label={`${r.marketName}${r.isHighest ? ` · ${t('bestPrice', locale)}` : ''}`}
                  value={`₹${r.pricePerKg}/kg${r.yoyPct != null ? ` (${r.yoyPct > 0 ? '+' : ''}${r.yoyPct}%)` : ''}`}
                />
              </View>
            ))}
          </Panel>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: tokens.textMuted, marginBottom: 8 },
  chipRow: { marginBottom: 12, maxHeight: 44 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    marginRight: 8,
  },
  chipMarket: { borderRadius: 12 },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green700 },
  chipPending: { opacity: 0.65 },
  chipText: { fontSize: 13, fontWeight: '600', color: tokens.text },
  chipTextActive: { color: tokens.green800 },
  contentBlock: { position: 'relative', minHeight: 120 },
  contentLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderRadius: tokens.radius,
  },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  insight: { fontSize: 14, color: tokens.text, lineHeight: 22, marginBottom: 6 },
  bestRow: {
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
});
