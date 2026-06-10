import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createLabourExpense, fetchRoiLabourTypes, t, tokens, type RoiLabourType } from '@morbeez/shared';
import { AlertBox, Btn, Loading, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function LabourAddScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [types, setTypes] = useState<RoiLabourType[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [workers, setWorkers] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchRoiLabourTypes()
      .then((t) => {
        setTypes(t);
        setSelectedId(t[0]?.id ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!selectedId) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter amount');
      return;
    }
    setSaving(true);
    try {
      await createLabourExpense({
        labourTypeId: selectedId,
        amount: amt,
        workers: workers ? Number(workers) : undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>{t('addLabour', locale)}</Text>
      <View style={styles.grid}>
        {types.map((type) => (
          <Pressable
            key={type.id}
            style={[styles.tile, selectedId === type.id && styles.tileActive]}
            onPress={() => setSelectedId(type.id)}
          >
            <Text style={styles.tileIcon}>{type.icon ?? '👷'}</Text>
            <Text style={styles.tileLabel}>{type.name}</Text>
          </Pressable>
        ))}
      </View>
      <TextField label={t('workers', locale)} value={workers} onChangeText={setWorkers} keyboardType="number-pad" />
      <TextField label={t('amount', locale)} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Btn label={t('save', locale)} onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  tile: {
    width: '47%',
    padding: 12,
    borderRadius: tokens.radiusSm,
    borderWidth: 2,
    borderColor: tokens.border,
    alignItems: 'center',
    backgroundColor: tokens.card,
  },
  tileActive: { borderColor: tokens.green500, backgroundColor: tokens.green100 },
  tileIcon: { fontSize: 28, marginBottom: 4 },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center', color: tokens.text },
});
