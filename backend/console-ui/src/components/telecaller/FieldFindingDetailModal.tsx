import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';

export type FieldFindingListRow = {
  id: string;
  visitedLabel?: string;
  blockName?: string;
  cropType?: string;
};

type FieldFindingDetail = {
  id: string;
  visitedLabel: string;
  blockName: string;
  cropType: string;
  agronomistName: string;
  agronomistRole: string;
  agronomistInitials: string;
  observations: string;
  parameters: Array<{ label: string; value: string }>;
  diseasePest: string;
  diseaseTone: string;
  actionTaken: string;
  followUpLabel: string;
  followUpAt: string | null;
  photoUrls: string[];
};

type Props = {
  leadId: string;
  row: FieldFindingListRow;
  canWrite?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

function diseaseClass(tone: string): string {
  return `tc-ff-disease tc-ff-disease--${tone}`;
}

export function FieldFindingDetailModal({ leadId, row, canWrite, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<FieldFindingDetail | null>(null);
  const [observations, setObservations] = useState('');
  const [diseasePest, setDiseasePest] = useState('');
  const [diseaseTone, setDiseaseTone] = useState('warning');
  const [actionTaken, setActionTaken] = useState('');

  const base = '/morbeez-staff/api/v1/os/telecaller';

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; finding: FieldFindingDetail }>(
        `${base}/leads/${leadId}/field-findings/${encodeURIComponent(row.id)}`
      );
      setDetail(d.finding);
      setObservations(String(d.finding.observations ?? ''));
      setDiseasePest(String(d.finding.diseasePest ?? ''));
      setDiseaseTone(String(d.finding.diseaseTone ?? 'warning'));
      setActionTaken(String(d.finding.actionTaken ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load field finding');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [leadId, row.id]);

  async function save() {
    if (!detail || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/field-findings/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          observations: observations.trim(),
          diseasePest: diseasePest.trim(),
          diseaseTone,
          actionTaken: actionTaken.trim(),
        }),
      });
      setEditing(false);
      onSaved?.();
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Field finding details" onClose={onClose} wide>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
              {detail.visitedLabel}
            </span>
            <span className={diseaseClass(detail.diseaseTone)}>{detail.diseasePest}</span>
            {canWrite && !editing ? (
              <button
                type="button"
                className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="tc-ff-avatar">{detail.agronomistInitials}</div>
            <div>
              <p className="font-semibold text-slate-900">{String(detail.agronomistName)}</p>
              <p className="text-xs text-slate-500">{String(detail.agronomistRole)}</p>
            </div>
            <div className="ml-auto text-right text-sm">
              <p className="font-medium text-slate-800">{detail.blockName}</p>
              <p className="text-slate-500">{detail.cropType}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <Field label="Observations">
                <textarea
                  className={inputClass}
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </Field>
              <Field label="Disease / pest">
                <input
                  className={inputClass}
                  value={diseasePest}
                  onChange={(e) => setDiseasePest(e.target.value)}
                />
              </Field>
              <Field label="Severity">
                <select
                  className={inputClass}
                  value={diseaseTone}
                  onChange={(e) => setDiseaseTone(e.target.value)}
                >
                  <option value="healthy">Healthy</option>
                  <option value="warning">Warning / deficiency</option>
                  <option value="danger">Disease / pest</option>
                </select>
              </Field>
              <Field label="Action taken">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Observations</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                  {detail.observations || '—'}
                </p>
              </section>

              {detail.parameters.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-slate-500">Parameters</h3>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {detail.parameters.map((p, i) => (
                      <li key={i} className="text-slate-700">
                        <span className="text-slate-500">{p.label}:</span> {p.value}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.actionTaken ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-slate-500">Action taken</h3>
                  <p className="mt-1 text-sm text-slate-800">{detail.actionTaken}</p>
                </section>
              ) : null}

              <p className="text-sm text-slate-600">
                <strong>Next follow-up:</strong> {detail.followUpLabel}
              </p>
            </>
          )}

          {detail.photoUrls.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Photos</h3>
              <div className="tc-ff-photo-grid">
                {detail.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="tc-ff-photo">
                    <img src={url} alt={`Field photo ${i + 1}`} />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
