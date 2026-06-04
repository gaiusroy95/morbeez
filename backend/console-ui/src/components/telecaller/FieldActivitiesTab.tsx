import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { FieldActivityPhase2Panel } from '../operations/field-activities/FieldActivityPhase2Panel';
import {
  type FieldActivity,
  type FieldActivityBlock,
  type FieldActivityForm,
  type FieldActivityType,
} from '../operations/field-activities/field-activity-utils';

type Props = {
  leadId: string;
  farmerName: string;
  canWrite: boolean;
};

const defaultForm = (): FieldActivityForm => ({
  activityTypeId: '',
  activityType: 'other',
  activityLabel: '',
  activityDate: new Date().toISOString().slice(0, 10),
  dap: '',
  notes: '',
  costInr: '',
  followUpRequired: false,
  followUpDate: '',
  status: 'completed',
});

export function FieldActivitiesTab({ leadId, farmerName, canWrite }: Props) {
  const telecallerBase = '/morbeez-staff/api/v1/os/telecaller';
  const apiBase = `${telecallerBase}/leads/${leadId}`;
  const breadcrumbLabel = `Telecaller CRM / ${farmerName} / Field activity`;

  const [blocks, setBlocks] = useState<FieldActivityBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [activities, setActivities] = useState<FieldActivity[]>([]);
  const [activityTypes, setActivityTypes] = useState<FieldActivityType[]>([]);
  const [form, setForm] = useState<FieldActivityForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivitiesForBlock = useCallback(
    async (blockId: string, cropType: string) => {
      const [typesRes, activitiesRes] = await Promise.all([
        api<{ ok: boolean; types: FieldActivityType[] }>(
          `${apiBase}/field-activity-types?cropType=${encodeURIComponent(cropType)}&activeOnly=true`
        ),
        api<{ ok: boolean; activities: FieldActivity[] }>(
          `${apiBase}/field-activities?blockId=${encodeURIComponent(blockId)}&limit=200`
        ),
      ]);
      const types = typesRes.types ?? [];
      setActivityTypes(types);
      setActivities(activitiesRes.activities ?? []);
      if (types.length > 0) {
        setForm((f) => {
          if (types.some((t) => t.id === f.activityTypeId)) return f;
          const first = types[0];
          const category = first.category?.toLowerCase() ?? '';
          const activityType = category.includes('nutrition')
            ? 'fertigation'
            : category.includes('protection')
              ? 'spray_applied'
              : category.includes('observation')
                ? 'scouting'
                : 'other';
          return {
            ...f,
            activityTypeId: first.id,
            activityLabel: f.activityLabel || first.activity_name,
            activityType,
          };
        });
      }
    },
    [apiBase]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const b = await api<{ ok: boolean; blocks: FieldActivityBlock[] }>(
        `${apiBase}/field-activities/blocks`
      );
      const nextBlocks = b.blocks ?? [];
      setBlocks(nextBlocks);
      const blockId = selectedBlockId && nextBlocks.some((x) => x.id === selectedBlockId)
        ? selectedBlockId
        : nextBlocks[0]?.id ?? '';
      if (blockId !== selectedBlockId) setSelectedBlockId(blockId);
      const selected = nextBlocks.find((x) => x.id === blockId);
      if (blockId) {
        await loadActivitiesForBlock(blockId, selected?.crop_type ?? '');
      } else {
        setActivities([]);
        setActivityTypes([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load field activities');
    } finally {
      setLoading(false);
    }
  }, [apiBase, selectedBlockId, loadActivitiesForBlock]);

  useEffect(() => {
    setSelectedBlockId('');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when lead changes
  }, [leadId]);

  async function onBlockChange(blockId: string) {
    setSelectedBlockId(blockId);
    const selected = blocks.find((b) => b.id === blockId);
    try {
      await loadActivitiesForBlock(blockId, selected?.crop_type ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load block activities');
    }
  }

  async function onSave(e: FormEvent): Promise<boolean> {
    e.preventDefault();
    if (!canWrite || !selectedBlockId) return false;
    setError('');
    try {
      await api(`${apiBase}/field-activities`, {
        method: 'POST',
        body: JSON.stringify({
          blockId: selectedBlockId,
          activityTypeId: form.activityTypeId || undefined,
          activityType: form.activityType,
          activityLabel: form.activityLabel.trim() || undefined,
          activityDate: form.activityDate,
          dap: form.dap ? Number(form.dap) : undefined,
          notes: form.notes.trim() || undefined,
          costInr: form.costInr ? Number(form.costInr) : undefined,
          followUpRequired: form.followUpRequired,
          followUpDate: form.followUpRequired ? form.followUpDate || undefined : undefined,
          status: form.status,
        }),
      });
      setForm((f) => ({
        ...f,
        activityLabel: '',
        notes: '',
        costInr: '',
        dap: '',
        followUpRequired: false,
        followUpDate: '',
      }));
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save field activity');
      return false;
    }
  }

  if (loading && blocks.length === 0) {
    return <p className="tc-muted">Loading field activities…</p>;
  }

  return (
    <div className="tc-field-activities-tab">
      {error ? <p className="tc-error-banner">{error}</p> : null}
      <FieldActivityPhase2Panel
        canWrite={canWrite}
        apiBase={apiBase}
        breadcrumbLabel={breadcrumbLabel}
        blocks={blocks}
        selectedBlockId={selectedBlockId}
        activities={activities}
        activityTypes={activityTypes}
        form={form}
        onFormChange={setForm}
        onActivityTypesChange={setActivityTypes}
        onSave={onSave}
        onBlockChange={onBlockChange}
      />
    </div>
  );
}
