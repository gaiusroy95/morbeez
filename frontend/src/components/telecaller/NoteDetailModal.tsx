import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';
import { Alert, Badge, Btn, Loading } from '../ui';

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
      {loading ? <Loading label="Loading note…" /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {detail && !loading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{detail.author}</Badge>
            <Badge tone="neutral">{detail.createdLabel}</Badge>
            {detail.isLegacy ? <Badge tone="archived">Historical (read-only)</Badge> : null}
            {canWrite && detail.canEdit && !editing ? (
              <Btn size="sm" variant="ghost" className="ml-auto text-brand-700" onClick={() => setEditing(true)}>
                Edit
              </Btn>
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
                <Btn size="sm" variant="primary" disabled={saving || !noteText.trim()} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save'}
                </Btn>
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setNoteText(detail.note);
                  }}
                >
                  Cancel
                </Btn>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface-elevated p-4 text-sm leading-relaxed text-ink">
              {detail.note || '—'}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
