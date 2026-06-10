import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createQuickExpense, formatInr, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

const PRESETS = [200, 500, 1000, 2000];

export default function QuickExpenseAmountScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ typeId: string; typeName?: string; icon?: string }>();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const displayAmount = useMemo(() => (amount ? formatInr(Number(amount)) : '₹0'), [amount]);

  function appendDigit(d: string) {
    if (d === '.' && amount.includes('.')) return;
    setAmount((a) => (a === '0' && d !== '.' ? d : a + d));
  }

  function backspace() {
    setAmount((a) => a.slice(0, -1));
  }

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createQuickExpense({ expenseTypeId: String(params.typeId), amount: amt });
      router.replace('/(tabs)/roi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.icon}>{params.icon ?? '💰'}</Text>
      <Text style={styles.typeName}>{params.typeName ?? t('addExpense', locale)}</Text>
      <Text style={styles.amountDisplay} accessibilityLabel={t('enterAmount', locale)}>
        {displayAmount}
      </Text>

      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Pressable key={p} style={styles.preset} onPress={() => setAmount(String(p))}>
            <Text style={styles.presetText}>₹{p}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
          <Pressable
            key={key}
            style={styles.key}
            onPress={() => (key === '⌫' ? backspace() : appendDigit(key))}
            accessibilityLabel={key === '⌫' ? 'Backspace' : key}
          >
            <Text style={styles.keyText}>{key}</Text>
          </Pressable>
        ))}
      </View>

      <Btn label={t('saveExpense', locale)} onPress={() => void save()} disabled={saving} accessibilityLabel={t('saveExpense', locale)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 8 },
  typeName: { fontSize: 18, fontWeight: '600', color: tokens.textMuted, marginBottom: 12 },
  amountDisplay: { fontSize: 40, fontWeight: '800', color: tokens.green800, marginBottom: 16 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tokens.green100,
    borderWidth: 1,
    borderColor: tokens.green500,
  },
  presetText: { fontSize: 14, fontWeight: '600', color: tokens.green800 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 280, gap: 8, marginBottom: 20 },
  key: {
    width: 84,
    height: 56,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 22, fontWeight: '600', color: tokens.text },
});
