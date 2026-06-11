import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createFieldBlock,
  fetchCropMasters,
  t,
  tokens,
  updateFieldBlock,
  type CropMaster,
} from '@morbeez/shared';
import { AlertBox, Btn, DynamicSelect, Loading, Panel, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

function matchCropName(crops: CropMaster[], value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return crops[0]?.name ?? '';
  const found = crops.find((c) => c.name.trim().toLowerCase() === v);
  return found?.name ?? value.trim();
}

export default function FieldFormScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const editing = Boolean(params.blockId);
  const [name, setName] = useState('');
  const [cropType, setCropType] = useState('');
  const [crops, setCrops] = useState<CropMaster[]>([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [acreage, setAcreage] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [irrigationType, setIrrigationType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchCropMasters()
      .then((rows) => {
        setCrops(rows);
        if (!params.blockId && rows[0]) {
          setCropType((current) => current || rows[0].name);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load crops'))
      .finally(() => setCropsLoading(false));
  }, [params.blockId]);

  useEffect(() => {
    if (!params.blockId || !crops.length) return;
    void (async () => {
      try {
        const { fetchFieldDetail } = await import('@morbeez/shared');
        const detail = await fetchFieldDetail(String(params.blockId));
        setName(detail.block.name);
        setCropType(matchCropName(crops, detail.block.crop));
        if (detail.block.acreage) setAcreage(String(detail.block.acreage));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load field');
      }
    })();
  }, [params.blockId, crops]);

  async function onSave() {
    if (!cropType.trim()) {
      setError(t('selectCrop', locale));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const body = {
        name: name.trim() || 'My block',
        cropType: cropType.trim(),
        acreage: acreage ? Number(acreage) : undefined,
        plantingDate: plantingDate.trim() || undefined,
        irrigationType: irrigationType.trim() || undefined,
      };
      if (editing && params.blockId) {
        await updateFieldBlock(String(params.blockId), body);
        router.back();
      } else {
        const block = await createFieldBlock(body);
        router.replace(`/fields/${block.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save field');
    } finally {
      setLoading(false);
    }
  }

  if ((loading && editing && !name) || (cropsLoading && !crops.length)) {
    return <Loading label={t('loading', locale)} />;
  }

  const cropOptions = crops.map((crop) => ({
    key: crop.id,
    value: crop.name,
    label: crop.name,
  }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={editing ? t('editField', locale) : t('addField', locale)}>
        <TextField label={t('fieldName', locale)} value={name} onChangeText={setName} accessibilityLabel={t('fieldName', locale)} />
        <DynamicSelect
          label={t('cropType', locale)}
          placeholder={t('selectCrop', locale)}
          value={cropType}
          options={cropOptions}
          loading={cropsLoading}
          onChange={setCropType}
        />
        <TextField label={t('acreage', locale)} value={acreage} onChangeText={setAcreage} keyboardType="decimal-pad" accessibilityLabel={t('acreage', locale)} />
        <TextField label={t('plantingDate', locale)} value={plantingDate} onChangeText={setPlantingDate} placeholder="YYYY-MM-DD" accessibilityLabel={t('plantingDate', locale)} />
        <TextField label={t('irrigation', locale)} value={irrigationType} onChangeText={setIrrigationType} accessibilityLabel={t('irrigation', locale)} />
      </Panel>
      <Btn label={t('save', locale)} onPress={() => void onSave()} disabled={loading || !cropType.trim()} accessibilityLabel={t('save', locale)} />
      <Btn label={t('cancel', locale)} variant="secondary" onPress={() => router.back()} accessibilityLabel={t('cancel', locale)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
});
