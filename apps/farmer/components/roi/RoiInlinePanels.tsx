import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import {
  fetchExpenseBook,
  fetchRoiAnalytics,
  fetchRoiHistoryV2,
  formatInr,
  t,
  tokens,
  type ExpenseBookGroup,
  type RoiAnalytics,
  type RoiFilterState,
} from '@morbeez/shared';
import { Btn, KeyValueRow, Panel } from '@morbeez/ui-native';
import { PieDonutChart } from './PieDonutChart';

export function RoiExpenseBookPreview({ filter, locale }: { filter: RoiFilterState; locale: Parameters<typeof t>[1] }) {
  const router = useRouter();
  const [groups, setGroups] = useState<ExpenseBookGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchExpenseBook(filter).then((g) => setGroups(g.slice(0, 6)));
  }, [filter]);

  return (
    <Panel title={t('expenseBook', locale)}>
      {groups.map((g) => (
        <View key={g.categoryId} style={styles.group}>
          <Pressable style={styles.groupHeader} onPress={() => setExpanded((e) => ({ ...e, [g.categoryId]: !e[g.categoryId] }))}>
            <Text style={styles.groupName}>
              {g.icon ?? '•'} {g.categoryName}
            </Text>
            <Text style={styles.groupTotal}>{formatInr(g.totalInr)}</Text>
          </Pressable>
          {expanded[g.categoryId]
            ? g.lines.slice(0, 5).map((line) => (
                <Text key={line.id} style={styles.lineMeta}>
                  {line.dateLabel} · {line.description} · {formatInr(line.amountInr)}
                </Text>
              ))
            : null}
        </View>
      ))}
      <Btn label={t('openFullLedger', locale)} variant="secondary" onPress={() => router.push('/roi/expense-book')} />
    </Panel>
  );
}

export function RoiAnalyticsPreview({ filter, locale }: { filter: RoiFilterState; locale: Parameters<typeof t>[1] }) {
  const router = useRouter();
  const [data, setData] = useState<RoiAnalytics | null>(null);

  const load = useCallback(async () => {
    setData(await fetchRoiAnalytics(filter));
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const segments =
    data?.breakdown.filter((s) => s.value > 0).map((s) => ({ label: s.label, value: s.value, color: s.color })) ?? [];
  const totalExpense = segments.reduce((s, x) => s + x.value, 0);
  const trendBars =
    data?.monthlyExpenseTrend.map((m) => ({
      value: m.amountInr,
      label: m.month.slice(5),
      frontColor: tokens.green700,
    })) ?? [];

  return (
    <>
      {segments.length ? (
        <Panel title={t('expenseBreakdown', locale)}>
          <PieDonutChart
            segments={segments}
            centerLabel={t('spent', locale)}
            centerValue={formatInr(totalExpense)}
            formatValue={formatInr}
          />
        </Panel>
      ) : null}
      {trendBars.length ? (
        <Panel title={t('monthlyExpenseTrend', locale)}>
          <BarChart data={trendBars} barWidth={24} spacing={12} height={140} noOfSections={4} />
        </Panel>
      ) : null}
      {data?.harvest ? (
        <Panel title={t('harvestStats', locale)}>
          <KeyValueRow label={t('harvestEntries', locale)} value={String(data.harvest.harvestCount)} />
          <KeyValueRow label={t('totalQty', locale)} value={`${data.harvest.totalQtyKg} kg`} />
        </Panel>
      ) : null}
      <Btn label={t('analytics', locale)} variant="secondary" onPress={() => router.push('/roi/analytics')} />
    </>
  );
}

export function RoiHistoryPreview({ locale }: { locale: Parameters<typeof t>[1] }) {
  const router = useRouter();
  const [active, setActive] = useState<Awaited<ReturnType<typeof fetchRoiHistoryV2>>['active']>([]);
  const [completed, setCompleted] = useState<Awaited<ReturnType<typeof fetchRoiHistoryV2>>['completed']>([]);

  useEffect(() => {
    void fetchRoiHistoryV2().then((h) => {
      setActive(h.active);
      setCompleted(h.completed.slice(0, 3));
    });
  }, []);

  return (
    <>
      {active.length ? (
        <Panel title={t('activeCycles', locale)}>
          {active.map((item) => (
            <Pressable key={item.id} style={styles.historyCard} onPress={() => router.push(`/roi/history/${item.id}`)}>
              <Text style={styles.historyTitle}>{item.seasonLabel}</Text>
              {item.blockName ? <Text style={styles.historyMeta}>{item.blockName}</Text> : null}
              {item.dap != null ? (
                <Text style={styles.historyMeta}>
                  DAP {item.dap}
                  {item.stageLabel ? ` · ${item.stageLabel}` : ''}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </Panel>
      ) : null}
      {completed.length ? (
        <Panel title={t('completedCycles', locale)}>
          {completed.map((item) => (
            <Pressable key={item.id} style={styles.historyCard} onPress={() => router.push(`/roi/history/${item.id}`)}>
              <Text style={styles.historyTitle}>{item.seasonLabel}</Text>
              <Text style={styles.historyMeta}>
                {t('spent', locale)} {formatInr(item.totalExpenseInr)} · {t('profit', locale)}{' '}
                {formatInr(item.netProfitInr)}
                {item.roiPercent != null ? ` · ${item.roiPercent}% ROI` : ''}
              </Text>
            </Pressable>
          ))}
        </Panel>
      ) : null}
      <Btn label={t('cropHistory', locale)} variant="secondary" onPress={() => router.push('/roi/history')} />
    </>
  );
}

export function ActiveCyclesScroller({
  items,
  locale,
}: {
  items: Awaited<ReturnType<typeof fetchRoiHistoryV2>>['active'];
  locale: Parameters<typeof t>[1];
}) {
  const router = useRouter();
  if (!items.length) return null;
  return (
    <View style={styles.scrollerWrap}>
      <Text style={styles.scrollerTitle}>{t('activeCycles', locale)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollerContent}>
        {items.map((item) => (
          <Pressable key={item.id} style={styles.cycleChip} onPress={() => router.push(`/roi/history/${item.id}`)}>
            <Text style={styles.cycleChipTitle}>{item.seasonLabel}</Text>
            {item.dap != null ? <Text style={styles.cycleChipMeta}>DAP {item.dap}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  txRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  txLabel: { flex: 1, fontSize: 13, color: tokens.text },
  txAmt: { fontSize: 13, fontWeight: '700' },
  income: { color: tokens.green800 },
  expense: { color: tokens.text },
  group: { marginBottom: 10 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 14, fontWeight: '600', color: tokens.text },
  groupTotal: { fontSize: 14, fontWeight: '700', color: tokens.text },
  lineMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 4, marginLeft: 8 },
  historyCard: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  historyTitle: { fontSize: 14, fontWeight: '700', color: tokens.text },
  historyMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  scrollerWrap: { marginBottom: 12 },
  scrollerTitle: { fontSize: 14, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  scrollerContent: { gap: 8 },
  cycleChip: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 10,
    padding: 12,
    minWidth: 140,
  },
  cycleChipTitle: { fontSize: 13, fontWeight: '700', color: tokens.text },
  cycleChipMeta: { fontSize: 11, color: tokens.textMuted, marginTop: 4 },
});
