import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createFarmerFieldFinding, fetchFieldBlocks, t, tokens, type FieldBlock } from '@morbeez/shared';
import { AlertBox, HubTabs, Loading, TextField } from '@morbeez/ui-native';
import { StickySaveBar } from '@/components/roi/RoiFormFields';
import { useLocale } from '@/context/LocaleContext';

const TONES = ['healthy', 'warning', 'danger'] as const;

export default function AddFieldFindingScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [blockId, setBlockId] = useState('');
  const [diseasePest, setDiseasePest] = useState('');
  const [observations, setObservations] = useState('');
  const [diseaseTone, setDiseaseTone] = useState<(typeof TONES)[number]>('warning');
  const [actionTaken, setActionTaken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === blockId) ?? null, [blocks, blockId]);

  useEffect(() => {
    void fetchFieldBlocks()
      .then((rows) => {
        setBlocks(rows);
        const bid = params.blockId ? String(params.blockId) : rows[0]?.id ?? '';
        setBlockId(bid);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load blocks'))
      .finally(() => setLoading(false));
  }, [params.blockId]);

  async function save() {
    if (!blockId) {
      setError('Select a block');
      return;
    }
    if (!diseasePest.trim() && !observations.trim()) {
      setError('Describe the issue or observation');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createFarmerFieldFinding(blockId, {
        diseasePest: diseasePest.trim() || undefined,
        observations: observations.trim() || undefined,
        diseaseTone,
        actionTaken: actionTaken.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save field finding');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <AlertBox>{error}</AlertBox> : null}

        {blocks.length > 1 ? (
          <View style={styles.section}>
            <Text style={styles.label}>{t('field', locale)}</Text>
            <HubTabs
              tabs={blocks.map((b) => ({ id: b.id, label: b.name }))}
              active={blockId || blocks[0]?.id}
              onChange={setBlockId}
            />
          </View>
        ) : selectedBlock ? (
          <Text style={styles.blockName}>{selectedBlock.name}</Text>
        ) : null}

        <TextField
          label={t('issueDetected', locale)}
          value={diseasePest}
          onChangeText={setDiseasePest}
          placeholder="e.g. Leaf spot, wilting, pest damage"
        />

        <TextField
          label={t('activityDetails', locale)}
          value={observations}
          onChangeText={setObservations}
          multiline
          placeholder="What did you observe in the field?"
        />

        <View style={styles.section}>
          <Text style={styles.label}>{t('cropHealthStatus', locale)}</Text>
          <HubTabs
            tabs={[
              { id: 'healthy' as const, label: 'Good' },
              { id: 'warning' as const, label: 'Average' },
              { id: 'danger' as const, label: 'Need help' },
            ]}
            active={diseaseTone}
            onChange={setDiseaseTone}
          />
        </View>

        <TextField
          label={t('actionTaken', locale)}
          value={actionTaken}
          onChangeText={setActionTaken}
          multiline
          placeholder="Optional — any action already taken"
        />
      </ScrollView>

      <StickySaveBar
        label={saving ? t('loading', locale) : t('saveFieldFinding', locale)}
        onPress={() => void save()}
        disabled={saving || !blockId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  blockName: { fontSize: 16, fontWeight: '700', color: tokens.green800, marginBottom: 16 },
});
