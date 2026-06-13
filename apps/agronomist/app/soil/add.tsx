import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, DynamicSelect, KeyboardAwareScrollScreen, Loading, Panel, TextField } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

const METRIC_FIELDS = [
  { key: 'ph', label: 'pH' },
  { key: 'ec', label: 'EC (dS/m)' },
  { key: 'organicCarbon', label: 'Organic carbon (%)' },
  { key: 'nitrogen', label: 'Nitrogen (kg/ha)' },
  { key: 'phosphorus', label: 'Phosphorus (kg/ha)' },
  { key: 'potassium', label: 'Potassium (kg/ha)' },
];

function searchParam(value: string | string[] | undefined): string {
  if (value == null) return '';
  return String(Array.isArray(value) ? value[0] : value);
}

export default function AddSoilTestScreen() {
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const params = useLocalSearchParams<{ farmerId?: string; blockId?: string }>();
  const farmerId = searchParam(params.farmerId);
  const presetBlockId = searchParam(params.blockId);

  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; cropType: string }>>([]);
  const [blockId, setBlockId] = useState(presetBlockId);
  const [metrics, setMetrics] = useState<Record<string, string>>(() =>
    Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, '']))
  );
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!farmerId) {
      setLoading(false);
      setError('Missing farmer.');
      return;
    }
    void agronomistClient
      .getFarmerBlocks(farmerId)
      .then((rows) => {
        setBlocks(rows.map((b) => ({ id: b.id, name: b.name, cropType: b.cropType })));
        if (!blockId && rows[0]) setBlockId(rows[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load blocks'))
      .finally(() => setLoading(false));
  }, [farmerId, blockId]);

  const blockOptions = useMemo(
    () => blocks.map((b) => ({ key: b.id, value: b.id, label: `${b.cropType} · ${b.name}` })),
    [blocks]
  );

  async function save() {
    if (!canWrite || !farmerId || !blockId) return;
    setSaving(true);
    setError('');
    try {
      const filled: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(metrics)) {
        if (v.trim()) filled[k] = v.trim();
      }
      if (remarks.trim()) filled.remarks = remarks.trim();
      await agronomistClient.createSoilReport(farmerId, {
        blockId,
        metrics: filled,
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
    <KeyboardAwareScrollScreen contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Add soil test">
        <DynamicSelect label="Block" placeholder="Select block" value={blockId} options={blockOptions} onChange={setBlockId} />
        {METRIC_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            value={metrics[field.key] ?? ''}
            onChangeText={(text) => setMetrics((prev) => ({ ...prev, [field.key]: text }))}
            keyboardType="decimal-pad"
          />
        ))}
        <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline placeholder="Lab notes or interpretation" />
      </Panel>

      <Btn label={saving ? 'Saving…' : 'Save soil test'} onPress={() => void save()} disabled={saving || !canWrite || !blockId} />
    </KeyboardAwareScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40 },
});
