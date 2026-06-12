import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createFarmerBlockRecommendation,
  fetchApplicationMethods,
  fetchFieldBlocks,
  t,
  tokens,
  type ApplicationMethodMaster,
  type FieldBlock,
} from '@morbeez/shared';
import { AlertBox, DynamicSelect, HubTabs, Loading, TextField } from '@morbeez/ui-native';
import { StickySaveBar } from '@/components/roi/RoiFormFields';
import { useLocale } from '@/context/LocaleContext';

function toMethodOptions(methods: ApplicationMethodMaster[]) {
  return methods.map((m) => ({
    key: m.id,
    value: m.id,
    label: m.name,
  }));
}

export default function AddBlockRecommendationScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [methods, setMethods] = useState<ApplicationMethodMaster[]>([]);
  const [blockId, setBlockId] = useState('');
  const [applicationMethodId, setApplicationMethodId] = useState('');
  const [applicationMethodName, setApplicationMethodName] = useState('');
  const [problem, setProblem] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [dosage, setDosage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === blockId) ?? null, [blocks, blockId]);
  const methodOptions = useMemo(() => toMethodOptions(methods), [methods]);

  useEffect(() => {
    void Promise.all([fetchFieldBlocks(), fetchApplicationMethods()])
      .then(([rows, methodRows]) => {
        setBlocks(rows);
        setMethods(methodRows);
        const bid = params.blockId ? String(params.blockId) : rows[0]?.id ?? '';
        setBlockId(bid);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load form'))
      .finally(() => setLoading(false));
  }, [params.blockId]);

  async function save() {
    if (!blockId) {
      setError('Select a block');
      return;
    }
    if (!recommendation.trim()) {
      setError('Recommendation details are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createFarmerBlockRecommendation(blockId, {
        problem: problem.trim() || undefined,
        recommendation: recommendation.trim(),
        dosage: dosage.trim() || undefined,
        applicationMethod: applicationMethodName.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save recommendation');
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
          value={problem}
          onChangeText={setProblem}
          placeholder="Optional — crop issue or concern"
        />

        <TextField
          label={t('recommendationDetails', locale)}
          value={recommendation}
          onChangeText={setRecommendation}
          multiline
          placeholder="Describe the advice or treatment to record"
        />

        <TextField
          label="Dosage"
          value={dosage}
          onChangeText={setDosage}
          placeholder="Optional — quantity or rate"
        />

        <DynamicSelect
          label={t('applicationMethod', locale)}
          placeholder={t('applicationMethod', locale)}
          value={applicationMethodId}
          options={methodOptions}
          onChange={(value, option) => {
            setApplicationMethodId(value);
            setApplicationMethodName(option?.label ?? '');
          }}
        />
      </ScrollView>

      <StickySaveBar
        label={saving ? t('loading', locale) : t('saveRecommendation', locale)}
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
