import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import {
  fetchRoiAnalytics,
  formatInr,
  t,
  tokens,
  type RoiAnalytics,
} from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { PieDonutChart } from '@/components/roi/PieDonutChart';
import { useRoiFilter } from '@/context/RoiFilterContext';
import { useLocale } from '@/context/LocaleContext';

export default function RoiAnalyticsScreen() {
  const { locale } = useLocale();
  const { filter } = useRoiFilter();
  const [data, setData] = useState<RoiAnalytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await fetchRoiAnalytics(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label={t('loading', locale)} />;

  const segments =
    data?.breakdown
      .filter((s) => s.value > 0)
      .map((s) => ({ label: s.label, value: s.value, color: s.color })) ?? [];

  const trendBars =
    data?.monthlyExpenseTrend.map((m) => ({
      value: m.amountInr,
      label: m.month.slice(5),
      frontColor: tokens.green700,
    })) ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}

      {segments.length ? (
        <Panel title={t('expenseBreakdown', locale)}>
          <PieDonutChart
            segments={segments}
            centerLabel={t('spent', locale)}
            centerValue={formatInr(segments.reduce((s, x) => s + x.value, 0))}
            formatValue={formatInr}
          />
          {data?.topCategory ? (
            <Text style={styles.top}>
              {t('topCategory', locale)}: {data.topCategory.label} ({formatInr(data.topCategory.value)})
            </Text>
          ) : null}
        </Panel>
      ) : null}

      {trendBars.length ? (
        <Panel title={t('monthlyExpenseTrend', locale)}>
          <BarChart data={trendBars} barWidth={28} spacing={16} height={160} noOfSections={4} />
        </Panel>
      ) : null}

      {data?.harvest ? (
        <Panel title={t('harvestStats', locale)}>
          <KeyValueRow label={t('harvestEntries', locale)} value={String(data.harvest.harvestCount)} />
          <KeyValueRow label={t('totalQty', locale)} value={`${data.harvest.totalQtyKg} kg`} />
          <KeyValueRow label={t('totalIncome', locale)} value={formatInr(data.harvest.totalIncomeInr)} />
          {data.harvest.averageRatePerKg != null ? (
            <KeyValueRow label={t('avgRate', locale)} value={`${formatInr(data.harvest.averageRatePerKg)}/kg`} />
          ) : null}
          {data.harvest.bestRatePerKg != null ? (
            <KeyValueRow label={t('bestRate', locale)} value={`${formatInr(data.harvest.bestRatePerKg)}/kg`} />
          ) : null}
          {data.harvest.lowestRatePerKg != null ? (
            <KeyValueRow label={t('lowestRate', locale)} value={`${formatInr(data.harvest.lowestRatePerKg)}/kg`} />
          ) : null}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  top: { fontSize: 13, color: tokens.textMuted, marginTop: 8 },
});
