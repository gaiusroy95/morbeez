import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createRoiEntry, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, Panel, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

const ENTRY_TYPES = ['labour', 'purchase', 'misc', 'harvest', 'income'] as const;

export default function RoiAddScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [entryType, setEntryType] = useState<(typeof ENTRY_TYPES)[number]>('purchase');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await createRoiEntry({ entryType, amount: amt, entryDate, comments: comments.trim() || undefined });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save entry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={t('addExpense', locale)}>
        <HubTabs
          tabs={ENTRY_TYPES.map((id) => ({ id, label: id }))}
          active={entryType}
          onChange={setEntryType}
        />
        <TextField label={t('amount', locale)} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel={t('amount', locale)} />
        <TextField label={t('entryDate', locale)} value={entryDate} onChangeText={setEntryDate} accessibilityLabel={t('entryDate', locale)} />
        <TextField label={t('comments', locale)} value={comments} onChangeText={setComments} accessibilityLabel={t('comments', locale)} />
      </Panel>
      <Btn label={t('save', locale)} onPress={() => void onSubmit()} disabled={loading} accessibilityLabel={t('save', locale)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
});
