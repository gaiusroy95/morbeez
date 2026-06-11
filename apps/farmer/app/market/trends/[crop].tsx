import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MarketTrendChart } from '@/components/market/MarketTrendChart';
import { fetchMarketTrends, t, tokens, type MarketTrends } from '@morbeez/shared';
import { AlertBox, HubTabs, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type Range = '1M' | '3M' | '1Y' | '5Y';

export default function MarketTrendDetailScreen() {
  const { crop } = useLocalSearchParams<{ crop: string }>();
  const { locale } = useLocale();
  const cropName = String(crop ?? 'ginger');
  const [range, setRange] = useState<Range>('1Y');
  const [trends, setTrends] = useState<MarketTrends | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setTrends(await fetchMarketTrends(cropName, range));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load trends');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cropName, range]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading) return <Loading label={t('loading', locale)} />;

  const overlayCurrent =
    trends?.overlayCurrent?.map((p) => ({ value: p.value, label: p.label })) ?? [];
  const overlayPrevious =
    trends?.overlayPrevious?.map((p) => ({ value: p.value, label: p.label })) ?? [];

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

      <Text style={styles.title}>
        {cropName} · {trends?.marketName ?? 'Market'}
      </Text>
      <Text style={styles.sub}>Updated {trends?.date ?? '—'}</Text>

      <HubTabs
        tabs={[
          { id: '1M' as Range, label: '1M' },
          { id: '3M' as Range, label: '3M' },
          { id: '1Y' as Range, label: '1Y' },
          { id: '5Y' as Range, label: '5Y' },
        ]}
        active={range}
        onChange={setRange}
      />

      {overlayCurrent.length ? (
        <Panel title={t('thisYearVsLast', locale)}>
          <MarketTrendChart
            chartKey={`${cropName}-${range}-${overlayCurrent.length}`}
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

      {trends?.points?.length ? (
        <Panel title="Monthly detail">
          {trends.points.map((p) => (
            <KeyValueRow
              key={p.monthLabel}
              label={p.monthLabel}
              value={`${p.currentYear != null ? `₹${p.currentYear}` : '—'} / ${p.previousYear != null ? `₹${p.previousYear}` : '—'}`}
            />
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.text, textTransform: 'capitalize' },
  sub: { fontSize: 13, color: tokens.textMuted, marginBottom: 12 },
  insight: { fontSize: 14, color: tokens.text, lineHeight: 22, marginBottom: 6 },
});

