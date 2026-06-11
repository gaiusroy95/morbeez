import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createQuickExpense, createFarmerCategory, fetchRoiCategories, tokens } from '@morbeez/shared';
import { AlertBox, Btn, TextField } from '@morbeez/ui-native';
import { RoiFormPickers, StickySaveBar, useRoiFormContext } from '@/components/roi/RoiFormFields';

export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const { crop, blockId, blocks, crops, entryDate, setEntryDate, setBlockId, onCropChange } = useRoiFormContext(
    params.blockId ? String(params.blockId) : undefined
  );
  const [categories, setCategories] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchRoiCategories().then((cats) => {
      setCategories(cats);
      if (cats[0]) setCategoryId(cats[0].id);
    });
  }, []);

  async function save() {
    const amt = Number(amount);
    if (!amt || !categoryId || !blockId) {
      setError('Enter amount and select category');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createQuickExpense({ categoryId, amount: amt, blockId, entryDate, note: note.trim() || undefined });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!customName.trim()) return;
    const cat = await createFarmerCategory({ name: customName.trim() });
    setCategories((c) => [...c, cat]);
    setCategoryId(cat.id);
    setCustomName('');
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}
        <RoiFormPickers
          crop={crop}
          blockId={blockId}
          blocks={blocks}
          crops={crops}
          entryDate={entryDate}
          cropLabel="Crop"
          blockLabel="Block"
          dateLabel="Date"
          onCropChange={(c) => void onCropChange(c)}
          onBlockChange={setBlockId}
          onDateChange={setEntryDate}
        />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, categoryId === c.id && styles.chipOn]}
              onPress={() => setCategoryId(c.id)}
            >
              <Text>{c.icon ?? '•'} {c.name}</Text>
            </Pressable>
          ))}
        </View>
        <TextField label="Custom category" value={customName} onChangeText={setCustomName} />
        <Btn label="Add category" variant="secondary" onPress={() => void addCategory()} />
        <TextField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <TextField label="Description" value={note} onChangeText={setNote} />
      </ScrollView>
      <StickySaveBar label={saving ? 'Saving…' : 'Save expense'} onPress={() => void save()} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.green100 },
  chipOn: { backgroundColor: tokens.green500 },
});
