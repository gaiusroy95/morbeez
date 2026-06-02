import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';

export type NoteListRow = {
  id: string;
  summary?: string;
  author?: string;
  createdLabel?: string;
  canEdit?: boolean;
  isLegacy?: boolean;
};

type NoteDetail = {
  id: string;
  summary: string;
  note: string;
  author: string;
  createdLabel: string;
  canEdit: boolean;
  isLegacy: boolean;
};

type Props = {
  leadId: string;
  row: NoteListRow;
  canWrite?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function NoteDetailModal({ leadId, row, canWrite, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [noteText, setNoteText] = useState('');

  const base = '/morbeez-staff/api/v1/os/telecaller';

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; note: NoteDetail }>(
        `${base}/leads/${leadId}/notes/${encodeURIComponent(row.id)}`
      );
      setDetail(d.note);
      setNoteText(d.note.note ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load note');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [leadId, row.id]);

  async function save() {
    if (!detail || !canWrite || !detail.canEdit) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/notes/${encodeURIComponent(detail.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setEditing(false);
      onSaved?.();
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save note');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Note details" onClose={onClose} wide>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {detail && !loading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-800">
              {detail.author}
            </span>
            <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
              {detail.createdLabel}
            </span>
            {detail.isLegacy ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                Historical (read-only)
              </span>
            ) : null}
            {canWrite && detail.canEdit && !editing ? (
              <button
                type="button"
                className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : null}
          </div>

          {editing ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <Field label="Note">
                <textarea
                  className={inputClass}
                  rows={8}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving || !noteText.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                  onClick={() => {
                    setEditing(false);
                    setNoteText(detail.note);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">
              {detail.note || '—'}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
