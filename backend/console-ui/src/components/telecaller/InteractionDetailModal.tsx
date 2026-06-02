import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';

export type InteractionListRow = {
  id: string;
  interactionType?: string;
  typeLabel?: string;
  summary?: string;
  by?: string;
  doneBy?: string;
  role?: string;
  createdLabel?: string;
  atLabel?: string;
  source?: string;
  completionStatus?: 'pending' | 'completed' | null;
  isDueToday?: boolean;
  taskId?: string | null;
  canEdit?: boolean;
};

type InteractionDetail = {
  id: string;
  source: string;
  interactionType: string;
  summary: string;
  status: string;
  completionStatus?: 'pending' | 'completed' | null;
  canEdit?: boolean;
  taskId?: string | null;
  by: string;
  role: string;
  createdLabel: string;
  fields: Array<{ label: string; value: string }>;
  sections: Array<{ title: string; content: string }>;
  followUpTimeline: Array<{ label: string; status: string; atLabel: string; detail?: string }>;
  products: Array<{ name: string; detail?: string }>;
  editForm?: {
    kind: 'task' | 'log';
    title?: string;
    notes?: string;
    dueAt?: string;
    summary?: string;
    content?: string;
  };
};

type Props = {
  leadId: string;
  row: InteractionListRow;
  onClose: () => void;
  canWrite?: boolean;
  onSaved?: () => void;
};

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InteractionDetailModal({ leadId, row, onClose, canWrite, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<InteractionDetail | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [logSummary, setLogSummary] = useState('');
  const [logContent, setLogContent] = useState('');

  const base = '/morbeez-staff/api/v1/os/telecaller';

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; interaction: InteractionDetail }>(
        `${base}/leads/${leadId}/interactions/${encodeURIComponent(row.id)}`
      );
      setDetail(d.interaction);
      const form = d.interaction.editForm;
      if (form?.kind === 'task') {
        setTitle(form.title ?? '');
        setNotes(form.notes ?? '');
        setDueAt(toDatetimeLocalValue(form.dueAt));
      } else if (form?.kind === 'log') {
        setLogSummary(form.summary ?? '');
        setLogContent(form.content ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [leadId, row.id]);

  async function saveEdit() {
    if (!detail?.editForm || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      if (detail.editForm.kind === 'task' && detail.taskId) {
        await api(`${base}/tasks/${detail.taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: title.trim() || undefined,
            notes: notes.trim() || undefined,
            dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          }),
        });
      } else if (detail.editForm.kind === 'log') {
        await api(`${base}/interactions/${detail.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            summary: logSummary.trim() || undefined,
            content: logContent.trim() || undefined,
          }),
        });
      }
      setEditing(false);
      onSaved?.();
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    if (!detail?.taskId || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/tasks/${detail.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ markDone: true }),
      });
      onSaved?.();
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark complete');
    } finally {
      setSaving(false);
    }
  }

  const titleLabel =
    detail?.interactionType ??
    row.interactionType ??
    row.typeLabel ??
    'Interaction details';

  const completion =
    detail?.completionStatus ?? row.completionStatus ?? null;
  const showPending = completion === 'pending';
  const showCompleted = completion === 'completed';
  const dueToday = row.isDueToday && showPending;

  return (
    <Modal title={titleLabel} onClose={onClose} wide>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {showPending ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Pending
              </span>
            ) : null}
            {showCompleted ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                Completed
              </span>
            ) : null}
            {dueToday ? (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                Due today
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {detail.status}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-800">
              {detail.by}
              {detail.role ? ` · ${detail.role}` : ''}
            </span>
            <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
              {detail.createdLabel}
            </span>
            {canWrite && detail.canEdit && detail.editForm && !editing ? (
              <button
                type="button"
                className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : null}
          </div>

          {editing && detail.editForm ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              {detail.editForm.kind === 'task' ? (
                <>
                  <Field label="Title">
                    <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </Field>
                  <Field label="Due">
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Summary">
                    <input
                      className={inputClass}
                      value={logSummary}
                      onChange={(e) => setLogSummary(e.target.value)}
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={logContent}
                      onChange={(e) => setLogContent(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() => void saveEdit()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : detail.summary ? (
            <p className="text-sm leading-relaxed text-slate-800">{detail.summary}</p>
          ) : null}

          {canWrite && detail.taskId && showPending ? (
            <button
              type="button"
              disabled={saving}
              className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              onClick={() => void markComplete()}
            >
              Mark as completed
            </button>
          ) : null}

          {detail.fields.length > 0 ? (
            <dl className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm">
              {detail.fields.map((f) => (
                <div key={f.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
                  <dt className="font-medium text-slate-500">{f.label}</dt>
                  <dd className="text-slate-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {detail.sections.map((s) => (
            <div key={s.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {s.title}
              </h3>
              <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
                {s.content}
              </div>
            </div>
          ))}

          {detail.products.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Products
              </h3>
              <ul className="space-y-2">
                {detail.products.map((p, i) => (
                  <li
                    key={`${p.name}-${i}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <strong>{p.name}</strong>
                    {p.detail ? <p className="mt-1 text-slate-600">{p.detail}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.followUpTimeline.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                WhatsApp follow-up timeline
              </h3>
              <ul className="space-y-2 border-l-2 border-emerald-200 pl-4">
                {detail.followUpTimeline.map((f, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium text-slate-800">{f.label}</div>
                    <div className="text-xs text-slate-500">
                      {f.atLabel} · {f.status}
                      {f.detail ? ` · ${f.detail}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.source === 'rec_record' ? (
            <p className="text-xs text-slate-500">
              Full WhatsApp message history is on the <strong>WhatsApp</strong> tab.
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
