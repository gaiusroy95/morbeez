import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createFarmerSoilReport,
  fetchFieldBlocks,
  t,
  tokens,
  type FieldBlock,
} from '@morbeez/shared';
import { AlertBox, DynamicSelect, Loading, TextField } from '@morbeez/ui-native';
import { activityDap, cropEmoji } from '@/components/fields/FieldBlockUi';
import { StickySaveBar } from '@/components/roi/RoiFormFields';
import { useLocale } from '@/context/LocaleContext';

type SoilField = { key: string; label: string; unit?: string };

const PRIMARY_FIELDS: SoilField[] = [
  { key: 'ph', label: 'pH' },
  { key: 'ec', label: 'EC', unit: 'dS/m' },
  { key: 'organicCarbon', label: 'Organic Carbon', unit: '%' },
  { key: 'nitrogen', label: 'Nitrogen (N)', unit: 'kg/ha' },
  { key: 'phosphorus', label: 'Phosphorus (P)', unit: 'kg/ha' },
  { key: 'potassium', label: 'Potassium (K)', unit: 'kg/ha' },
];

const SECONDARY_FIELDS: SoilField[] = [
  { key: 'calcium', label: 'Calcium (Ca)' },
  { key: 'magnesium', label: 'Magnesium (Mg)' },
  { key: 'sulfur', label: 'Sulphur (S)' },
  { key: 'sodium', label: 'Sodium (Na)' },
];

const MICRO_FIELDS: SoilField[] = [
  { key: 'iron', label: 'Iron (Fe)', unit: 'ppm' },
  { key: 'manganese', label: 'Manganese (Mn)', unit: 'ppm' },
  { key: 'zinc', label: 'Zinc (Zn)', unit: 'ppm' },
  { key: 'copper', label: 'Copper (Cu)', unit: 'ppm' },
  { key: 'boron', label: 'Boron (B)', unit: 'ppm' },
  { key: 'molybdenum', label: 'Molybdenum (Mo)', unit: 'ppm' },
];

function emptyValues(fields: SoilField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, '']));
}

function CollapsibleSection({
  title,
  icon,
  unitHint,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  unitHint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <Text style={styles.sectionTitle}>
          {icon} {title}
        </Text>
        <Text style={styles.sectionChevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {unitHint ? <Text style={styles.unitHint}>{unitHint}</Text> : null}
      {open ? children : null}
    </View>
  );
}

function MetricGrid({
  fields,
  values,
  onChange,
}: {
  fields: SoilField[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <View style={styles.grid}>
      {fields.map((field) => (
        <View key={field.key} style={styles.gridCell}>
          <TextField
            label={field.unit ? `${field.label} (${field.unit})` : field.label}
            value={values[field.key] ?? ''}
            onChangeText={(text) => onChange({ ...values, [field.key]: text })}
            keyboardType="decimal-pad"
          />
        </View>
      ))}
    </View>
  );
}

export default function AddSoilTestScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [blockId, setBlockId] = useState('');
  const [reportedAt, setReportedAt] = useState(new Date().toISOString().slice(0, 10));
  const [macro, setMacro] = useState(() => ({
    ...emptyValues(PRIMARY_FIELDS),
    ...emptyValues(SECONDARY_FIELDS),
  }));
  const [micro, setMicro] = useState(() => emptyValues(MICRO_FIELDS));
  const [remarks, setRemarks] = useState('');
  const [reportFileName, setReportFileName] = useState('');
  const [imageData, setImageData] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [secondaryOpen, setSecondaryOpen] = useState(true);
  const [microOpen, setMicroOpen] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchFieldBlocks()
      .then((rows) => {
        setBlocks(rows);
        const bid = params.blockId ? String(params.blockId) : rows[0]?.id ?? '';
        setBlockId(bid);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load fields'))
      .finally(() => setLoading(false));
  }, [params.blockId]);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === blockId) ?? null, [blocks, blockId]);
  const dap = activityDap(selectedBlock?.plantingDate, reportedAt);

  const blockOptions = blocks.map((b) => ({
    key: b.id,
    value: b.id,
    label: `${cropEmoji(b.crop)} ${b.crop} · ${b.name}`,
  }));

  async function pickReport() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setImageData(asset.base64 ?? '');
    setMimeType(asset.mimeType ?? 'image/jpeg');
    setReportFileName(asset.fileName ?? 'Lab report');
  }

  function clearReport() {
    setImageData('');
    setReportFileName('');
    setMimeType('image/jpeg');
  }

  async function save() {
    if (!blockId) return;
    setSaving(true);
    setError('');
    try {
      await createFarmerSoilReport({
        blockId,
        reportedAt,
        macro,
        micro,
        remarks: remarks.trim() || undefined,
        imageData: imageData || undefined,
        mimeType: imageData ? mimeType : undefined,
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
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <DynamicSelect
          label={t('field', locale)}
          placeholder={t('selectBlock', locale)}
          value={blockId}
          options={blockOptions}
          onChange={setBlockId}
        />

        <TextField
          label={t('soilTestDate', locale)}
          value={reportedAt}
          onChangeText={setReportedAt}
          placeholder="YYYY-MM-DD"
        />

        {dap != null ? (
          <View style={styles.dapBox}>
            <Text style={styles.dapText}>{t('dapAuto', locale).replace('{dap}', String(dap))}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitleStatic}>🧪 {t('primaryParameters', locale)}</Text>
          <MetricGrid
            fields={PRIMARY_FIELDS}
            values={macro}
            onChange={(next) => setMacro((prev) => ({ ...prev, ...next }))}
          />
        </View>

        <CollapsibleSection
          title={t('secondaryParameters', locale)}
          icon="⚗️"
          unitHint="(meq/100g)"
          open={secondaryOpen}
          onToggle={() => setSecondaryOpen((v) => !v)}
        >
          <MetricGrid
            fields={SECONDARY_FIELDS}
            values={macro}
            onChange={(next) => setMacro((prev) => ({ ...prev, ...next }))}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={t('micronutrients', locale)}
          icon="🍃"
          open={microOpen}
          onToggle={() => setMicroOpen((v) => !v)}
        >
          <MetricGrid fields={MICRO_FIELDS} values={micro} onChange={setMicro} />
        </CollapsibleSection>

        <Text style={styles.uploadLabel}>{t('labReport', locale)}</Text>
        {reportFileName ? (
          <View style={styles.uploadBox}>
            <Text style={styles.uploadTitle}>📄 {reportFileName}</Text>
            <Pressable onPress={clearReport}>
              <Text style={styles.uploadRemove}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.uploadBox} onPress={() => void pickReport()}>
            <Text style={styles.uploadIcon}>☁️</Text>
            <Text style={styles.uploadTitle}>{t('uploadReport', locale)}</Text>
            <Text style={styles.uploadHint}>{t('uploadReportHint', locale)}</Text>
          </Pressable>
        )}

        <TextField
          label={t('remarks', locale)}
          value={remarks}
          onChangeText={setRemarks}
          multiline
          placeholder={t('remarksPlaceholder', locale)}
        />
      </ScrollView>

      <StickySaveBar
        label={saving ? t('loading', locale) : t('saveSoilTest', locale)}
        onPress={() => void save()}
        disabled={saving || !blockId}
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
  section: {
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: tokens.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: tokens.green800 },
  sectionTitleStatic: { fontSize: 15, fontWeight: '800', color: tokens.green800, marginBottom: 8 },
  sectionChevron: { fontSize: 18, color: tokens.textMuted, fontWeight: '700' },
  unitHint: { fontSize: 12, color: tokens.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridCell: { width: '47%' },
  uploadLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 8 },
  uploadBox: {
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.border,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: tokens.card,
  },
  uploadIcon: { fontSize: 28, marginBottom: 8 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: tokens.text },
  uploadHint: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  uploadRemove: { fontSize: 12, color: tokens.green800, fontWeight: '700', marginTop: 8 },
});
