import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchRoiTransactions,
  formatInr,
  t,
  tokens,
  updateRoiTransaction,
  type TransactionRow,
} from '@morbeez/shared';
import { AlertBox, Loading, TextField } from '@morbeez/ui-native';
import { StickySaveBar } from '@/components/roi/RoiFormFields';
import { FarmConfirmedSourceMeta } from '@/components/FarmConfirmedSourceMeta';
import { useLocale } from '@/context/LocaleContext';

export default function EditTransactionScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<TransactionRow | null>(null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void fetchRoiTransactions({ limit: 200 })
      .then((r) => {
        const match = r.transactions.find((tx) => tx.id === id);
        if (!match) throw new Error('Transaction not found');
        setRow(match);
        setAmount(String(match.amountInr));
        setEntryDate(match.date);
        setNote(match.note ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!id || !row) return;
    const amt = Number(amount);
    if (!amt) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateRoiTransaction(id, {
        amount: amt,
        entryDate: entryDate || undefined,
        note: note.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}
        {row ? (
          <>
            <Text style={styles.type}>{row.label}</Text>
            <Text style={styles.meta}>
              {row.type === 'income' ? t('totalIncome', locale) : t('spent', locale)} · {formatInr(row.amountInr)}
            </Text>
            <FarmConfirmedSourceMeta
              input={row}
              locale={locale}
              kind="roi"
              id={row.id}
              label={row.label}
            />
          </>
        ) : null}
        <TextField label={t('amount', locale)} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <TextField label={t('entryDate', locale)} value={entryDate} onChangeText={setEntryDate} placeholder="YYYY-MM-DD" />
        <TextField label={t('comments', locale)} value={note} onChangeText={setNote} />
      </ScrollView>
      <StickySaveBar label={saving ? t('loading', locale) : t('save', locale)} onPress={() => void save()} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100, gap: 8 },
  type: { fontSize: 18, fontWeight: '700', color: tokens.text },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
});
