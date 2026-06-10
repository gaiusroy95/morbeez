import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchActiveSeasonRoi, formatInr, t, tokens, type ActiveSeasonDashboard } from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  DonutChart,
  FinanceSummaryRow,
  Loading,
  Panel,
  StageProgressBar,
} from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function RoiTabScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [data, setData] = useState<ActiveSeasonDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await fetchActiveSeasonRoi());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ROI');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label={t('loading', locale)} />;

  const segments =
    data?.breakdown
      .filter((s) => s.value > 0)
      .map((s) => ({ label: s.label, value: s.value, color: s.color })) ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}

      {data ? (
        <>
          <Text style={styles.blockName}>{data.blockName}</Text>
          <Text style={styles.sub}>
            DAP {data.dap} · {data.stageLabel}
          </Text>
          <StageProgressBar dap={data.dap} stage={data.stageLabel} />

          <FinanceSummaryRow
            items={[
              { label: t('spent', locale), value: formatInr(data.spentInr) },
              { label: t('expected', locale), value: formatInr(data.expectedIncomeInr) },
              { label: t('profit', locale), value: formatInr(data.netProfitInr), highlight: true },
            ]}
          />

          <View style={styles.roiBadge}>
            <Text style={styles.roiBadgeText}>{data.roiPercent}% ROI</Text>
          </View>

          {segments.length ? (
            <Panel title={data.seasonLabel}>
              <DonutChart segments={segments} />
            </Panel>
          ) : null}

          {data.recentEntries.length ? (
            <Panel title={t('recentExpenses', locale)}>
              {data.recentEntries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <Text style={styles.entryIcon}>{e.icon ?? '•'}</Text>
                  <View style={styles.entryMain}>
                    <Text style={styles.entryLabel}>{e.label}</Text>
                    <Text style={styles.entryMeta}>{e.dateLabel}</Text>
                  </View>
                  <Text style={styles.entryAmt}>{formatInr(e.amountInr)}</Text>
                </View>
              ))}
            </Panel>
          ) : null}

          {data.marketNote ? <Text style={styles.marketNote}>{data.marketNote}</Text> : null}
        </>
      ) : null}

      <Btn
        label={t('addExpense', locale)}
        onPress={() => router.push('/roi/quick-expense')}
        accessibilityLabel={t('addExpense', locale)}
      />
      <Btn label={t('addLabour', locale)} variant="secondary" onPress={() => router.push('/roi/labour-add')} />
      <Btn label={t('harvest', locale)} variant="secondary" onPress={() => router.push('/roi/harvest')} />
      <Btn label={t('cropHistory', locale)} variant="secondary" onPress={() => router.push('/roi/history')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  blockName: { fontSize: 22, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 8 },
  roiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.green500,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  roiBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  entryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  entryIcon: { fontSize: 22, width: 32 },
  entryMain: { flex: 1 },
  entryLabel: { fontSize: 14, fontWeight: '600', color: tokens.text },
  entryMeta: { fontSize: 12, color: tokens.textMuted },
  entryAmt: { fontSize: 14, fontWeight: '700', color: tokens.green800 },
  marketNote: { fontSize: 12, color: tokens.textMuted, fontStyle: 'italic' },
});
