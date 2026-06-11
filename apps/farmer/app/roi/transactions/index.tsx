import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  deleteRoiTransaction,
  fetchRoiTransactions,
  formatInr,
  t,
  tokens,
  type TransactionRow,
} from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, Loading } from '@morbeez/ui-native';
import { useRoiFilter } from '@/context/RoiFilterContext';
import { useLocale } from '@/context/LocaleContext';

type TxFilter = 'all' | 'expense' | 'income';

export default function TransactionsScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { filter } = useRoiFilter();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetchRoiTransactions({
        crop: filter.crop ?? undefined,
        blockId: filter.blockId ?? undefined,
        type: txFilter === 'all' ? undefined : txFilter,
        limit: 100,
      });
      setRows(r.transactions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [filter, txFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function onRowPress(item: TransactionRow) {
    Alert.alert(item.label, undefined, [
      { text: t('cancel', locale), style: 'cancel' },
      {
        text: t('editTransaction', locale),
        onPress: () => router.push(`/roi/transactions/edit/${item.id}`),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteRoiTransaction(item.id)
            .then(() => void load())
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not delete'));
        },
      },
    ]);
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <HubTabs
        tabs={[
          { id: 'all', label: t('allTransactions', locale) },
          { id: 'expense', label: t('spent', locale) },
          { id: 'income', label: t('totalIncome', locale) },
        ]}
        active={txFilter}
        onChange={(id) => setTxFilter(id as TxFilter)}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
        ListHeaderComponent={
          <View style={styles.addRow}>
            <View style={styles.addBtn}>
              <Btn label={t('income', locale)} onPress={() => router.push('/roi/transactions/add-income')} />
            </View>
            <View style={styles.addBtn}>
              <Btn
                label={t('expense', locale)}
                variant="secondary"
                onPress={() => router.push('/roi/transactions/add-expense')}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onRowPress(item)} onLongPress={() => onRowPress(item)}>
            <View style={styles.main}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.meta}>{item.dateLabel}</Text>
            </View>
            <Text style={[styles.amt, item.type === 'income' ? styles.income : styles.expense]}>
              {item.type === 'income' ? '+' : '-'}
              {formatInr(item.amountInr)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('noExpensesYet', locale)}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16, gap: 10 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addBtn: { flex: 1 },
  row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border },
  main: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: tokens.text },
  meta: { fontSize: 12, color: tokens.textMuted },
  amt: { fontSize: 15, fontWeight: '700' },
  income: { color: tokens.green800 },
  expense: { color: tokens.text },
  empty: { textAlign: 'center', color: tokens.textMuted, marginTop: 24 },
});
