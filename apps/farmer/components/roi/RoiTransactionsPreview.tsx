import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchRoiCategories,
  fetchRoiTransactions,
  formatInr,
  t,
  tokens,
  type RoiFilterState,
  type TransactionRow,
} from '@morbeez/shared';
import { Btn, DynamicSelect, EmptyState, HubTabs, Panel, TextField } from '@morbeez/ui-native';

type DatePreset = 'all' | '7d' | '30d' | 'custom';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: DatePreset): { from: string; to: string } {
  const to = todayIso();
  if (preset === '7d') return { from: daysAgoIso(7), to };
  if (preset === '30d') return { from: daysAgoIso(30), to };
  if (preset === 'all') return { from: '', to: '' };
  return { from: daysAgoIso(30), to };
}

export function RoiTransactionsPreview({
  filter,
  locale,
  limit = 10,
}: {
  filter: RoiFilterState;
  locale: Parameters<typeof t>[1];
  limit?: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [fromDate, setFromDate] = useState(daysAgoIso(30));
  const [toDate, setToDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);

  useEffect(() => {
    void fetchRoiCategories().then(setCategories);
  }, []);

  const categoryOptions = useMemo(
    () => [
      { key: 'all', value: '', label: t('allCategories', locale) },
      ...categories.map((c) => ({
        key: c.id,
        value: c.id,
        label: `${c.icon ? `${c.icon} ` : ''}${c.name}`.trim(),
      })),
    ],
    [categories, locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchRoiTransactions({
        crop: filter.crop ?? undefined,
        blockId: filter.blockId ?? undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        categoryId: categoryId || undefined,
        limit,
      });
      setRows(r.transactions);
    } finally {
      setLoading(false);
    }
  }, [filter, fromDate, toDate, categoryId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  function onDatePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const range = presetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  return (
    <Panel title={t('last10Transactions', locale)}>
      <HubTabs
        tabs={[
          { id: 'all' as const, label: t('filterAll', locale) },
          { id: '7d' as const, label: '7d' },
          { id: '30d' as const, label: '30d' },
          { id: 'custom' as const, label: t('customRange', locale) },
        ]}
        active={datePreset}
        onChange={onDatePresetChange}
      />
      {datePreset === 'custom' ? (
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <TextField label={t('dateFrom', locale)} value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.dateCol}>
            <TextField label={t('dateTo', locale)} value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" />
          </View>
        </View>
      ) : null}
      <DynamicSelect
        label={t('category', locale)}
        placeholder={t('allCategories', locale)}
        value={categoryId}
        options={categoryOptions}
        onChange={(id) => setCategoryId(id)}
      />
      {loading ? (
        <Text style={styles.loading}>{t('loading', locale)}</Text>
      ) : rows.length ? (
        rows.map((tx) => (
          <Pressable
            key={tx.id}
            style={styles.txRow}
            onPress={() => router.push(`/roi/transactions/edit/${tx.id}`)}
          >
            <View style={styles.txMain}>
              <Text style={styles.txLabel} numberOfLines={1}>
                {tx.label}
              </Text>
              <Text style={styles.txMeta}>
                {tx.dateLabel}
                {tx.note ? ` · ${tx.note}` : ''}
              </Text>
            </View>
            <Text style={[styles.txAmt, tx.type === 'income' ? styles.income : styles.expense]}>
              {tx.type === 'income' ? '+' : '-'}
              {formatInr(tx.amountInr)}
            </Text>
          </Pressable>
        ))
      ) : (
        <EmptyState>{t('noExpensesYet', locale)}</EmptyState>
      )}
      <Btn label={t('openFullLedger', locale)} variant="secondary" onPress={() => router.push('/roi/transactions')} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', gap: 8 },
  dateCol: { flex: 1 },
  loading: { fontSize: 13, color: tokens.textMuted, marginVertical: 12 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
    gap: 8,
  },
  txMain: { flex: 1 },
  txLabel: { fontSize: 14, fontWeight: '600', color: tokens.text },
  txMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '700' },
  income: { color: tokens.green800 },
  expense: { color: tokens.text },
});
