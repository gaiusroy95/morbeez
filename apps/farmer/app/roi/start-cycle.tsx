import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRoiContext, startCropCycle, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, TextField } from '@morbeez/ui-native';
import { useRoiFilter } from '@/context/RoiFilterContext';
import { useLocale } from '@/context/LocaleContext';

export default function StartCycleScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { filter, setBlockId } = useRoiFilter();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; crop: string }>>([]);
  const [crops, setCrops] = useState<string[]>(['ginger', 'turmeric', 'cardamom']);
  const [blockId, setLocalBlockId] = useState('');
  const [crop, setCrop] = useState('');
  const [acreage, setAcreage] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const f = params.blockId ? { ...filter, blockId: String(params.blockId) } : filter;
    void fetchRoiContext(f).then((ctx) => {
      setBlocks(ctx.blocksForCrop);
      setLocalBlockId(ctx.blockId);
      setCrop(ctx.crop ?? 'ginger');
      const cropSet = new Set(ctx.blocksForCrop.map((b) => b.crop));
      if (cropSet.size) setCrops([...cropSet]);
    });
  }, [filter, params.blockId]);

  async function save() {
    if (!blockId || !crop.trim()) {
      setError('Select block and crop');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await startCropCycle({
        blockId,
        crop: crop.trim(),
        acreage: acreage ? Number(acreage) : undefined,
        plantingDate: plantingDate.trim() || undefined,
      });
      setBlockId(blockId);
      router.replace('/(tabs)/roi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start cycle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.label}>{t('selectField', locale)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {blocks.map((b) => (
          <Pressable
            key={b.id}
            style={[styles.chip, blockId === b.id && styles.chipOn]}
            onPress={() => setLocalBlockId(b.id)}
          >
            <Text>{b.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.label}>{t('selectCrop', locale)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {crops.map((c) => (
          <Pressable key={c} style={[styles.chip, crop === c && styles.chipOn]} onPress={() => setCrop(c)}>
            <Text>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextField label={t('cropType', locale)} value={crop} onChangeText={setCrop} />
      <TextField label={t('acreage', locale)} value={acreage} onChangeText={setAcreage} keyboardType="decimal-pad" />
      <TextField label={t('plantingDate', locale)} value={plantingDate} onChangeText={setPlantingDate} placeholder="YYYY-MM-DD" />
      <Btn label={saving ? t('loading', locale) : t('startNewCycle', locale)} onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.green100 },
  chipOn: { backgroundColor: tokens.green500 },
});
