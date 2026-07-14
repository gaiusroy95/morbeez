import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';
import { Alert, Badge, Btn, Loading } from '../ui';
import { OperationalChainPanel, type OperationalChain } from './OperationalChainPanel';

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
  operationalChain?: OperationalChain;
};

type Props = {
  leadId: string;
  row: InteractionListRow;
  onClose: () => void;
  canWrite?: boolean;
  onSaved?: () => void;
  onOpenFinding?: (findingId: string) => void;
  onOpenRecommendation?: (recommendationId: string) => void;
};

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InteractionDetailModal({
  leadId,
  row,
  onClose,
  canWrite,
  onSaved,
  onOpenFinding,
  onOpenRecommendation,
}: Props) {
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
      {loading ? <Loading label="Loading interaction…" /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {showPending ? <Badge tone="warn">Pending</Badge> : null}
            {showCompleted ? <Badge tone="success">Completed</Badge> : null}
            {dueToday ? (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-600/10">
                Due today
              </span>
            ) : null}
            {detail.status === 'Escalated' ? (
              <Badge tone="role">Escalated · case review</Badge>
            ) : null}
            <Badge tone="neutral">{detail.status}</Badge>
            <Badge tone="info">
              {detail.by}
              {detail.role ? ` · ${detail.role}` : ''}
            </Badge>
            <Badge tone="neutral">{detail.createdLabel}</Badge>
            {canWrite && detail.canEdit && detail.editForm && !editing ? (
              <Btn size="sm" variant="ghost" className="ml-auto text-brand-700" onClick={() => setEditing(true)}>
                Edit
              </Btn>
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
                <Btn size="sm" variant="primary" disabled={saving} onClick={() => void saveEdit()}>
                  {saving ? 'Saving…' : 'Save'}
                </Btn>
                <Btn size="sm" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Btn>
              </div>
            </div>
          ) : detail.summary ? (
            <p className="text-sm leading-relaxed text-ink">{detail.summary}</p>
          ) : null}

          {detail.operationalChain ? (
            <OperationalChainPanel
              chain={detail.operationalChain}
              onOpenFinding={onOpenFinding}
              onOpenRecommendation={onOpenRecommendation}
            />
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
            <dl className="grid gap-2 rounded-xl border border-border bg-surface-subtle/80 p-4 text-sm">
              {detail.fields.map((f) => (
                <div key={f.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
                  <dt className="font-medium text-ink-muted">{f.label}</dt>
                  <dd className="text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {detail.sections.map((s) => (
            <div key={s.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {s.title}
              </h3>
              <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface-elevated p-4 text-sm text-ink">
                {s.content}
              </div>
            </div>
          ))}

          {detail.products.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Products
              </h3>
              <ul className="space-y-2">
                {detail.products.map((p, i) => (
                  <li
                    key={`${p.name}-${i}`}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <strong>{p.name}</strong>
                    {p.detail ? <p className="mt-1 text-ink-secondary">{p.detail}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.followUpTimeline.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                WhatsApp follow-up timeline
              </h3>
              <ul className="space-y-2 border-l-2 border-emerald-200 pl-4">
                {detail.followUpTimeline.map((f, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium text-ink">{f.label}</div>
                    <div className="text-xs text-ink-muted">
                      {f.atLabel} · {f.status}
                      {f.detail ? ` · ${f.detail}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.source === 'rec_record' ? (
            <p className="text-xs text-ink-muted">
              Full WhatsApp message history is on the <strong>WhatsApp</strong> tab.
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
