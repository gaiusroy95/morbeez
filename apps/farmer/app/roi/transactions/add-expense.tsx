import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createQuickExpense,
  createFarmerCategory,
  fetchRoiCategories,
  tokens,
  type FarmerCategory,
} from '@morbeez/shared';
import { AlertBox, DynamicSelect, TextField } from '@morbeez/ui-native';
import { RoiFormPickers, StickySaveBar, useRoiFormContext } from '@/components/roi/RoiFormFields';

export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const { crop, blockId, blocks, crops, entryDate, setEntryDate, setBlockId, onCropChange } = useRoiFormContext(
    params.blockId ? String(params.blockId) : undefined
  );
  const [categories, setCategories] = useState<FarmerCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchRoiCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats[0]) setCategoryId(cats[0].id);
      })
      .finally(() => setLoadingCategories(false));
  }, []);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        key: c.id,
        value: c.id,
        label: `${c.icon ? `${c.icon} ` : ''}${c.name}`.trim(),
      })),
    [categories]
  );

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

  async function addCategory(name: string) {
    const cat = await createFarmerCategory({ name });
    setCategories((prev) => [...prev, cat]);
    setCategoryId(cat.id);
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
        <DynamicSelect
          label="Category"
          placeholder="Select category"
          value={categoryId}
          options={categoryOptions}
          loading={loadingCategories}
          allowAdd
          addPlaceholder="Custom category"
          addButtonLabel="Add category"
          onChange={(id) => setCategoryId(id)}
          onAdd={addCategory}
        />
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
});
