import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';
import { StaticSelect } from '../ui';

export type EscalationListRow = {
  id: string;
  summary?: string;
  reason?: string;
  statusLabel?: string;
  workflowStatus?: 'pending' | 'agronomist_review' | 'completed';
  priority?: string;
  createdLabel?: string;
};

type EscalationComment = {
  id: string;
  author: string;
  authorRole: 'telecaller' | 'agronomist' | 'system';
  body: string;
  createdLabel: string;
};

type EscalationDetail = {
  id: string;
  reason: string;
  workflowStatus: 'pending' | 'agronomist_review' | 'completed';
  statusLabel: string;
  priority: string;
  confidence: number | null;
  createdLabel: string;
  resolution: string | null;
  farmer: { name: string; phone: string; district: string } | null;
  session: {
    cropType?: string;
    cropStage?: string;
    symptomsText?: string;
    probableIssue?: string;
    summaryEn?: string;
  } | null;
  productRecommendations: Array<{ title: string; handle?: string }>;
  comments: EscalationComment[];
};

const WORKFLOW_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'agronomist_review', label: 'Needs agronomist review' },
  { value: 'completed', label: 'Completed' },
] as const;

type Props = {
  row: EscalationListRow;
  canWrite?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

function statusBadgeClass(workflow: string): string {
  if (workflow === 'completed') return 'bg-emerald-100 text-emerald-900';
  if (workflow === 'agronomist_review') return 'bg-amber-100 text-amber-900';
  return 'bg-slate-100 text-slate-800';
}

function roleLabel(role: string): string {
  if (role === 'agronomist') return 'Agronomist';
  if (role === 'telecaller') return 'Telecaller';
  return 'Staff';
}

export function EscalationDetailModal({ row, canWrite, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<EscalationDetail | null>(null);
  const [workflowStatus, setWorkflowStatus] =
    useState<'pending' | 'agronomist_review' | 'completed'>('pending');
  const [comment, setComment] = useState('');
  const [resolution, setResolution] = useState('');

  const base = '/morbeez-staff/api/v1/os/telecaller';

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; escalation: EscalationDetail }>(
        `${base}/escalations/${encodeURIComponent(row.id)}`
      );
      setDetail(d.escalation);
      setWorkflowStatus(d.escalation.workflowStatus);
      setResolution(d.escalation.resolution ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load escalation');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [row.id]);

  async function save() {
    if (!canWrite || !detail) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/escalations/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          workflowStatus,
          comment: comment.trim() || undefined,
          commentRole: 'telecaller',
          resolution: resolution.trim() || undefined,
        }),
      });
      setComment('');
      onSaved?.();
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Escalation details" onClose={onClose} wide>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(workflowStatus)}`}
            >
              {detail.statusLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs capitalize text-slate-700">
              {detail.priority} priority
            </span>
            <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
              {detail.createdLabel}
            </span>
          </div>

          {detail.farmer ? (
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{detail.farmer.name}</strong>
              {' · '}
              {detail.farmer.phone}
              {detail.farmer.district ? ` · ${detail.farmer.district}` : ''}
            </p>
          ) : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</h3>
            <p className="mt-1 text-sm text-slate-800">{detail.reason}</p>
          </section>

          {detail.session ? (
            <dl className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Crop</dt>
                <dd>
                  {detail.session.cropType ?? '—'}
                  {detail.session.cropStage ? ` (${detail.session.cropStage})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">AI confidence</dt>
                <dd>
                  {detail.confidence != null
                    ? `${Math.round(Number(detail.confidence) * 100)}%`
                    : '—'}
                </dd>
              </div>
              {detail.session.symptomsText ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Symptoms</dt>
                  <dd>{detail.session.symptomsText}</dd>
                </div>
              ) : null}
              {detail.session.probableIssue || detail.session.summaryEn ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">AI summary</dt>
                  <dd>
                    {detail.session.probableIssue ? (
                      <span className="font-medium">{detail.session.probableIssue}. </span>
                    ) : null}
                    {detail.session.summaryEn}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {detail.productRecommendations.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Products suggested
              </h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {detail.productRecommendations.map((p, i) => (
                  <li key={i}>{p.title}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comments (telecaller & agronomist)
            </h3>
            {detail.comments.length === 0 ? (
              <p className="text-sm text-slate-500">No comments yet.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {detail.comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{roleLabel(c.authorRole)}</span>
                      <span>{c.author}</span>
                      <span>{c.createdLabel}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canWrite ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <Field label="Status">
                <StaticSelect
                  className={inputClass}
                  value={workflowStatus}
                  onChange={(value) =>
                    setWorkflowStatus(
                      value as 'pending' | 'agronomist_review' | 'completed'
                    )
                  }
                  options={WORKFLOW_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>
              <p className="text-xs text-slate-600">
                Set <strong>Needs agronomist review</strong> when the case should be reviewed by an
                agronomist. Mark <strong>Completed</strong> once resolved.
              </p>
              <Field label="Your comment">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Telecaller note for agronomist or follow-up…"
                />
              </Field>
              {workflowStatus === 'completed' ? (
                <Field label="Resolution summary">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="What was decided / told to farmer"
                  />
                </Field>
              ) : null}
              <button
                type="button"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => void save()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-800">Read-only — you need write access to update.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
