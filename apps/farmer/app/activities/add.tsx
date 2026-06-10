import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createActivity, fetchFieldBlocks, fetchRoiActivityTypes, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, Loading, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type ActType = 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'irrigation' | 'other';

function mapActivityType(name: string, category?: string): ActType {
  const n = name.toLowerCase();
  const c = (category ?? '').toLowerCase();
  if (n.includes('spray') || c.includes('spray')) return 'spray_applied';
  if (n.includes('fert') || c.includes('fert')) return 'fertigation';
  if (n.includes('drench')) return 'drench';
  if (n.includes('scout')) return 'scouting';
  if (n.includes('irrig')) return 'irrigation';
  return 'other';
}

export default function AddActivityScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; crop: string }>>([]);
  const [activityTypes, setActivityTypes] = useState<Array<{ id: string; label: string; mapped: ActType }>>([]);
  const [blockId, setBlockId] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
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
      .then(async (b) => {
        setBlocks(b.map((x) => ({ id: x.id, name: x.name, crop: x.crop })));
        const bid = params.blockId ? String(params.blockId) : b[0]?.id ?? '';
        setBlockId(bid);
        const crop = b.find((x) => x.id === bid)?.crop;
        const types = await fetchRoiActivityTypes(crop);
        const mapped = types.map((t) => ({
          id: t.id,
          label: t.activityName,
          mapped: mapActivityType(t.activityName, t.category),
        }));
        setActivityTypes(mapped.length ? mapped : [
          { id: 'spray', label: 'Spray', mapped: 'spray_applied' as ActType },
          { id: 'fert', label: 'Fertigation', mapped: 'fertigation' as ActType },
          { id: 'scout', label: 'Scouting', mapped: 'scouting' as ActType },
        ]);
        setActivityTypeId(mapped[0]?.id ?? 'spray');
        setActivityType(mapped[0]?.mapped ?? 'spray_applied');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load fields'))
      .finally(() => setLoading(false));
  }, [params.blockId]);

  function onTypeChange(id: string) {
    setActivityTypeId(id);
    const found = activityTypes.find((t) => t.id === id);
    if (found) setActivityType(found.mapped);
  }

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
        activityTypeId: activityTypeId && !['spray', 'fert', 'scout'].includes(activityTypeId) ? activityTypeId : undefined,
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
      {blocks.length ? (
        <HubTabs tabs={blocks.map((b) => ({ id: b.id, label: b.name }))} active={blockId} onChange={setBlockId} />
      ) : null}
      <HubTabs
        tabs={activityTypes.map((t) => ({ id: t.id, label: t.label }))}
        active={activityTypeId}
        onChange={onTypeChange}
      />
      <TextField label={t('entryDate', locale)} value={activityDate} onChangeText={setActivityDate} />
      <TextField label="Product used" value={productUsed} onChangeText={setProductUsed} autoCapitalize="words" />
      <TextField label="Quantity" value={quantity} onChangeText={setQuantity} />
      <TextField label={t('amount', locale)} value={costInr} onChangeText={setCostInr} keyboardType="numeric" />
      <TextField label={t('comments', locale)} value={notes} onChangeText={setNotes} autoCapitalize="sentences" />
      <Btn label={t('save', locale)} onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
});
