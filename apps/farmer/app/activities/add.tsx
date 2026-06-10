import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createActivity, fetchFieldBlocks, tokens } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, Loading, TextField } from '@morbeez/ui-native';

type ActType = 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'irrigation' | 'other';

export default function AddActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string }>>([]);
  const [blockId, setBlockId] = useState('');
  const [activityType, setActivityType] = useState<ActType>('spray_applied');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [productUsed, setProductUsed] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [costInr, setCostInr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchFieldBlocks()
      .then((b) => {
        setBlocks(b.map((x) => ({ id: x.id, name: x.name })));
        setBlockId(params.blockId ? String(params.blockId) : b[0]?.id ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load fields'))
      .finally(() => setLoading(false));
  }, [params.blockId]);

  async function save() {
    if (!blockId) return;
    setSaving(true);
    setError('');
    try {
      await createActivity({
        blockId,
        activityType,
        activityDate,
        productUsed: productUsed.trim() || undefined,
        quantity: quantity.trim() || undefined,
        notes: notes.trim() || undefined,
        costInr: costInr ? Number(costInr) : undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {blocks.length ? (
        <HubTabs tabs={blocks.map((b) => ({ id: b.id, label: b.name }))} active={blockId} onChange={setBlockId} />
      ) : null}
      <HubTabs
        tabs={[
          { id: 'spray_applied' as ActType, label: 'Spray' },
          { id: 'fertigation' as ActType, label: 'Fertigation' },
          { id: 'drench' as ActType, label: 'Drench' },
          { id: 'scouting' as ActType, label: 'Scouting' },
          { id: 'irrigation' as ActType, label: 'Irrigation' },
        ]}
        active={activityType}
        onChange={setActivityType}
      />
      <TextField label="Date (YYYY-MM-DD)" value={activityDate} onChangeText={setActivityDate} />
      <TextField label="Product used" value={productUsed} onChangeText={setProductUsed} autoCapitalize="words" />
      <TextField label="Quantity" value={quantity} onChangeText={setQuantity} />
      <TextField label="Cost (₹)" value={costInr} onChangeText={setCostInr} keyboardType="numeric" />
      <TextField label="Notes" value={notes} onChangeText={setNotes} autoCapitalize="sentences" />
      <Btn label={saving ? 'Saving…' : 'Save activity'} onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
});
