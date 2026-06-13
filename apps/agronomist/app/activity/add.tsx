import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, DynamicSelect, KeyboardAwareScrollScreen, Loading, Panel, TextField } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

const ACTIVITY_TYPES = [
  { key: 'spray_applied', label: '🧴 Spray' },
  { key: 'drench', label: '🚿 Drenching' },
  { key: 'fertigation', label: '💧 Fertigation' },
  { key: 'scouting', label: '👁 Scouting' },
  { key: 'other', label: 'Other' },
] as const;

type ActType = (typeof ACTIVITY_TYPES)[number]['key'];

function searchParam(value: string | string[] | undefined): string {
  if (value == null) return '';
  return String(Array.isArray(value) ? value[0] : value);
}

export default function AddActivityScreen() {
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const params = useLocalSearchParams<{ farmerId?: string; blockId?: string; blockName?: string }>();
  const farmerId = searchParam(params.farmerId);
  const presetBlockId = searchParam(params.blockId);

  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; cropType: string }>>([]);
  const [blockId, setBlockId] = useState(presetBlockId);
  const [activityType, setActivityType] = useState<ActType>('spray_applied');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityLabel, setActivityLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [costInr, setCostInr] = useState('');
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
    () =>
      blocks.map((b) => ({
        key: b.id,
        value: b.id,
        label: `${b.cropType} · ${b.name}`,
      })),
    [blocks]
  );

  async function save() {
    if (!canWrite || !farmerId || !blockId) return;
    setSaving(true);
    setError('');
    try {
      await agronomistClient.createFieldActivity(farmerId, {
        blockId,
        activityType,
        activityLabel: activityLabel.trim() || undefined,
        activityDate,
        notes: notes.trim() || undefined,
        costInr: costInr ? Number(costInr) : undefined,
        status: 'completed',
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

      <Panel title="Add field activity">
        <DynamicSelect
          label="Block"
          placeholder="Select block"
          value={blockId}
          options={blockOptions}
          onChange={setBlockId}
        />
        <DynamicSelect
          label="Activity type"
          placeholder="Select type"
          value={activityType}
          options={ACTIVITY_TYPES.map((t) => ({ key: t.key, value: t.key, label: t.label }))}
          onChange={(v) => setActivityType(v as ActType)}
        />
        <TextField label="Activity date" value={activityDate} onChangeText={setActivityDate} placeholder="YYYY-MM-DD" />
        <TextField label="Label (optional)" value={activityLabel} onChangeText={setActivityLabel} placeholder="Product or method" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What was done on the field?" />
        <TextField label="Cost (₹)" value={costInr} onChangeText={setCostInr} keyboardType="numeric" />
      </Panel>

      <Btn label={saving ? 'Saving…' : 'Save activity'} onPress={() => void save()} disabled={saving || !canWrite || !blockId} />
    </KeyboardAwareScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40 },
});
