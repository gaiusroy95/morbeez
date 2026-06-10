import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { formatInr, submitHarvest, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function HarvestScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [yieldKg, setYieldKg] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totalIncome = useMemo(() => {
    const y = Number(yieldKg);
    const p = Number(price);
    if (!y || !p) return 0;
    return Math.round(y * p * 100) / 100;
  }, [yieldKg, price]);

  async function save() {
    const y = Number(yieldKg);
    const p = Number(price);
    if (!y || !p) {
      setError('Enter yield and price');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await submitHarvest({ yieldKg: y, sellingPricePerKg: p });
      router.replace('/roi/history');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save harvest');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>{t('harvest', locale)}</Text>
      <TextField label={t('yieldKg', locale)} value={yieldKg} onChangeText={setYieldKg} keyboardType="decimal-pad" />
      <TextField label={t('sellingPrice', locale)} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      {totalIncome > 0 ? (
        <Text style={styles.total}>
          {t('totalIncome', locale)}: {formatInr(totalIncome)}
        </Text>
      ) : null}
      <Btn label={t('closeSeason', locale)} onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  total: { fontSize: 18, fontWeight: '700', color: tokens.green800, marginVertical: 8 },
});
