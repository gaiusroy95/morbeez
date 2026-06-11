import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createFieldBlock, t, tokens, updateFieldBlock } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function FieldFormScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const editing = Boolean(params.blockId);
  const [name, setName] = useState('');
  const [cropType, setCropType] = useState('ginger');
  const [acreage, setAcreage] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [irrigationType, setIrrigationType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params.blockId) return;
    void (async () => {
      try {
        const { fetchFieldDetail } = await import('@morbeez/shared');
        const detail = await fetchFieldDetail(String(params.blockId));
        setName(detail.block.name);
        setCropType(detail.block.crop);
        if (detail.block.acreage) setAcreage(String(detail.block.acreage));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load field');
      }
    })();
  }, [params.blockId]);

  async function onSave() {
    setError('');
    setLoading(true);
    try {
      const body = {
        name: name.trim() || 'My block',
        cropType: cropType.trim() || 'ginger',
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

  if (loading && editing && !name) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={editing ? t('editField', locale) : t('addField', locale)}>
        <TextField label={t('fieldName', locale)} value={name} onChangeText={setName} accessibilityLabel={t('fieldName', locale)} />
        <TextField label={t('cropType', locale)} value={cropType} onChangeText={setCropType} accessibilityLabel={t('cropType', locale)} />
        <TextField label={t('acreage', locale)} value={acreage} onChangeText={setAcreage} keyboardType="decimal-pad" accessibilityLabel={t('acreage', locale)} />
        <TextField label={t('plantingDate', locale)} value={plantingDate} onChangeText={setPlantingDate} placeholder="YYYY-MM-DD" accessibilityLabel={t('plantingDate', locale)} />
        <TextField label={t('irrigation', locale)} value={irrigationType} onChangeText={setIrrigationType} accessibilityLabel={t('irrigation', locale)} />
      </Panel>
      <Btn label={t('save', locale)} onPress={() => void onSave()} disabled={loading} accessibilityLabel={t('save', locale)} />
      <Btn label={t('cancel', locale)} variant="secondary" onPress={() => router.back()} accessibilityLabel={t('cancel', locale)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
});
