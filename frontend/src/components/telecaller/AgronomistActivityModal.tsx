import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import { Alert, Loading } from '../ui';
import type { AgronomistActivityRow } from './AgronomistTab';

type Props = {
  leadId: string;
  activity: AgronomistActivityRow;
  onClose: () => void;
};

export function AgronomistActivityModal({ leadId, activity, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(activity.activity);
  const [body, setBody] = useState(activity.notes);
  const [meta, setMeta] = useState('');

  const base = '/morbeez-staff/api/v1/os/telecaller';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        if (activity.source === 'field_finding') {
          const d = await api<{ ok: boolean; finding: Record<string, unknown> }>(
            `${base}/leads/${leadId}/field-findings/${activity.id}`
          );
          const f = d.finding;
          if (!cancelled) {
            setTitle('Field visit');
            setBody(String(f.observations ?? f.actionTaken ?? activity.notes));
            setMeta(
              [
                f.blockName ? `Block: ${f.blockName}` : '',
                f.cropType ? `Crop: ${f.cropType}` : '',
                f.diseasePest ? `Issue: ${f.diseasePest}` : '',
                f.actionTaken ? `Action: ${f.actionTaken}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            );
          }
        } else {
          const d = await api<{ ok: boolean; recommendations: Array<Record<string, unknown>> }>(
            `${base}/leads/${leadId}/recommendations?limit=50`
          );
          const rec = (d.recommendations ?? []).find((r) => String(r.id) === activity.id);
          if (!cancelled) {
            setTitle('Recommendation shared');
            setBody(String(rec?.recommendation ?? rec?.problem ?? activity.notes));
            setMeta(
              [
                rec?.status ? `Status: ${rec.status}` : '',
                rec?.dosage ? `Dosage: ${rec.dosage}` : '',
                rec?.applicationMethod ? `Application: ${rec.applicationMethod}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            );
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId, activity]);

  return (
    <Modal title={title} onClose={onClose} wide>
      {loading ? <Loading label="Loading activity…" /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!loading ? (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-ink-muted">
            {activity.dateLabel} · {activity.block}
          </p>
          <p className="whitespace-pre-wrap text-ink">{body || '—'}</p>
          {meta ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-subtle p-3 text-xs text-ink-secondary">
              {meta}
            </pre>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
