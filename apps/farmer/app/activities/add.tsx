import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createActivity,
  createFarmerActivityType,
  fetchFieldBlocks,
  fetchRoiActivityTypes,
  t,
  tokens,
  type FieldBlock,
  type RoiActivityType,
} from '@morbeez/shared';
import { AlertBox, DynamicSelect, Loading, TextField } from '@morbeez/ui-native';
import { activityDap } from '@/components/fields/FieldBlockUi';
import { StickySaveBar } from '@/components/roi/RoiFormFields';
import { useLocale } from '@/context/LocaleContext';

type ActType = 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'irrigation' | 'other';

type ActivityTypeOption = RoiActivityType & { mapped: ActType };

function mapActivityType(name: string, category?: string): ActType {
  const n = name.toLowerCase();
  const c = (category ?? '').toLowerCase();
  if (n.includes('spray') || c.includes('spray')) return 'spray_applied';
  if (n.includes('fert') || c.includes('fert')) return 'fertigation';
  if (n.includes('drench')) return 'drench';
  if (n.includes('scout') || n.includes('observation')) return 'scouting';
  if (n.includes('irrig')) return 'irrigation';
  return 'other';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

const DEFAULT_TYPES: ActivityTypeOption[] = [
  { id: 'spray', activityName: 'Spray', icon: '🧴', mapped: 'spray_applied' },
  { id: 'drench', activityName: 'Drenching', icon: '🚿', mapped: 'drench' },
  { id: 'fert', activityName: 'Fertigation', icon: '💧', mapped: 'fertigation' },
  { id: 'scout', activityName: 'Observation', icon: '👁', mapped: 'scouting' },
];

function toOptions(types: ActivityTypeOption[]) {
  return types.map((type) => ({
    key: type.id,
    value: type.id,
    label: `${type.icon ? `${type.icon} ` : ''}${type.activityName}`.trim(),
  }));
}

export default function AddActivityScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeOption[]>(DEFAULT_TYPES);
  const [blockId, setBlockId] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [activityType, setActivityType] = useState<ActType>('spray_applied');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityDetails, setActivityDetails] = useState('');
  const [costInr, setCostInr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [typesLoading, setTypesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === blockId) ?? null, [blocks, blockId]);

  const loadTypes = useCallback(async (crop?: string, keepId?: string) => {
    setTypesLoading(true);
    try {
      const types = await fetchRoiActivityTypes(crop);
      const mapped = (types.length ? types : DEFAULT_TYPES).map((type) => ({
        ...type,
        mapped: mapActivityType(type.activityName, type.category),
      }));
      setActivityTypes(mapped);
      const current = keepId ?? activityTypeId;
      if (!mapped.some((type) => type.id === current)) {
        const first = mapped[0];
        if (first) {
          setActivityTypeId(first.id);
          setActivityType(first.mapped);
        }
      }
    } finally {
      setTypesLoading(false);
    }
  }, [activityTypeId]);

  useEffect(() => {
    void fetchFieldBlocks()
      .then(async (rows) => {
        setBlocks(rows);
        const bid = params.blockId ? String(params.blockId) : rows[0]?.id ?? '';
        setBlockId(bid);
        const crop = rows.find((b) => b.id === bid)?.crop;
        await loadTypes(crop);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load fields'))
      .finally(() => setLoading(false));
  }, [params.blockId, loadTypes]);

  const dap = activityDap(selectedBlock?.plantingDate, activityDate);

  function onBlockChange(id: string) {
    setBlockId(id);
    const crop = blocks.find((b) => b.id === id)?.crop;
    void loadTypes(crop, activityTypeId);
  }

  function onTypeChange(id: string) {
    setActivityTypeId(id);
    const found = activityTypes.find((type) => type.id === id);
    if (found) setActivityType(found.mapped);
  }

  async function addActivityType(name: string) {
    const created = await createFarmerActivityType({
      activityName: name,
      crop: selectedBlock?.crop,
    });
    const option: ActivityTypeOption = {
      ...created,
      mapped: mapActivityType(created.activityName, created.category),
    };
    setActivityTypes((prev) => [...prev, option]);
    setActivityTypeId(option.id);
    setActivityType(option.mapped);
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
        productUsed: activityDetails.trim() || undefined,
        notes: activityDetails.trim() || undefined,
        costInr: costInr ? Number(costInr) : undefined,
        activityTypeId: isUuid(activityTypeId) ? activityTypeId : undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  const blockOptions = blocks.map((b) => ({
    key: b.id,
    value: b.id,
    label: `${b.crop} · ${b.name}`,
  }));

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <DynamicSelect
          label={t('field', locale)}
          placeholder={t('selectBlock', locale)}
          value={blockId}
          options={blockOptions}
          onChange={onBlockChange}
        />

        <DynamicSelect
          label={t('activityType', locale)}
          placeholder={t('activityType', locale)}
          value={activityTypeId}
          options={toOptions(activityTypes)}
          loading={typesLoading}
          allowAdd
          addPlaceholder={t('activityType', locale)}
          addButtonLabel={t('addActivityType', locale)}
          onChange={onTypeChange}
          onAdd={addActivityType}
        />

        <TextField label={t('activityDate', locale)} value={activityDate} onChangeText={setActivityDate} placeholder="YYYY-MM-DD" />

        {dap != null ? (
          <View style={styles.dapBox}>
            <Text style={styles.dapText}>
              {t('dapAuto', locale).replace('{dap}', String(dap))}
            </Text>
          </View>
        ) : null}

        <TextField
          label={t('activityDetails', locale)}
          value={activityDetails}
          onChangeText={setActivityDetails}
          multiline
          maxLength={250}
          autoCapitalize="sentences"
          placeholder={'MKP 1kg\nSeaweed 250ml'}
        />
        <Text style={styles.charCount}>{activityDetails.length}/250</Text>

        <TextField label={t('amount', locale)} value={costInr} onChangeText={setCostInr} keyboardType="numeric" />
      </ScrollView>

      <StickySaveBar
        label={saving ? t('loading', locale) : t('saveActivity', locale)}
        onPress={() => void save()}
        disabled={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100, gap: 4 },
  dapBox: {
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    padding: 12,
    marginBottom: 8,
  },
  dapText: { fontSize: 14, fontWeight: '700', color: tokens.green800 },
  charCount: { fontSize: 12, color: tokens.textMuted, textAlign: 'right', marginTop: -8, marginBottom: 8 },
});
