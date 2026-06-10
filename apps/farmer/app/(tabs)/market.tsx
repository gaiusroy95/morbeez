import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
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
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<MarketDashboard | null>(null);
  const [trends, setTrends] = useState<MarketTrends | null>(null);
  const [mandi, setMandi] = useState<MandiComparison | null>(null);
  const [cropCompare, setCropCompare] = useState<MultiCropComparison | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const crop = selectedCrop ?? dashboard?.crop ?? dashboard?.favoriteCrop ?? 'ginger';
  const market = selectedMarket ?? dashboard?.selectedMarket ?? undefined;

  const load = useCallback(async () => {
    setError('');
    try {
      const [d, tr, mc, cc] = await Promise.all([
        fetchMarketDashboard(crop, market),
        fetchMarketTrends(crop, '1Y', market),
        fetchMandiComparison(crop, market),
        fetchMultiCropComparison(market),
      ]);
      setDashboard(d);
      setTrends(tr);
      setMandi(mc);
      setCropCompare(cc);
      if (!selectedCrop && d.crop) setSelectedCrop(d.crop);
      if (!selectedMarket && d.selectedMarket) setSelectedMarket(d.selectedMarket);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load market data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [crop, market, selectedCrop, selectedMarket]);

  useEffect(() => {
    void load();
  }, [load]);

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
          const active = c.cropName === crop;
          const isFavorite = c.cropName === dashboard?.favoriteCrop;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setSelectedCrop(c.cropName);
                setLoading(true);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.icon ? `${c.icon} ` : ''}
                {cropTitle(c.cropName)}
                {isFavorite ? ' ★' : ''}
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
              const active = m === (selectedMarket ?? dashboard?.selectedMarket);
              return (
                <Pressable
                  key={m}
                  style={[styles.chip, styles.chipMarket, active && styles.chipActive]}
                  onPress={() => {
                    setSelectedMarket(m);
                    setLoading(true);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
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

      {tab === 'today' && dashboard?.todayPrice ? (
        <>
          <MarketRateCard
            crop={cropTitle(dashboard.crop)}
            marketName={dashboard.selectedMarket ?? dashboard.districtLabel}
            pricePerKg={dashboard.todayPrice}
            trend={dashboard.dailyTrend ?? dashboard.trend}
            dailyChangeInr={dashboard.dailyChangeInr}
            onPress={() => router.push(`/market/trends/${dashboard.crop}`)}
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
                <Text style={styles.legendCurrent}>● This year</Text>
                <Text style={styles.legendPrev}>● Last year</Text>
              </View>
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
          {mandi.rows.map((r) => (
            <View key={r.marketName} style={r.isHighest ? styles.bestRow : undefined}>
              <KeyValueRow
                label={`${r.marketName}${r.isHighest ? ` · ${t('bestPrice', locale)}` : ''}`}
                value={`₹${r.pricePerKg}/kg${r.yoyPct != null ? ` (${r.yoyPct > 0 ? '+' : ''}${r.yoyPct}%)` : ''}`}
              />
            </View>
          ))}
        </Panel>
      ) : null}
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
  chipText: { fontSize: 13, fontWeight: '600', color: tokens.text },
  chipTextActive: { color: tokens.green800 },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendCurrent: { fontSize: 12, color: tokens.green700 },
  legendPrev: { fontSize: 12, color: tokens.textMuted },
  insight: { fontSize: 14, color: tokens.text, lineHeight: 22, marginBottom: 6 },
  bestRow: {
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
});
