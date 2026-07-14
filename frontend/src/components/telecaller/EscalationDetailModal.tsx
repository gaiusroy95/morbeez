import { useEffect, useState } from 'react';
import { formatPhoneDisplay } from '@morbeez/shared';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';
import { Alert, Badge, Btn, Loading, StaticSelect } from '../ui';

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
  onSaved?: (opts?: { completed?: boolean }) => void;
  onCleared?: () => void;
};

function workflowBadgeTone(workflow: string): 'success' | 'warn' | 'neutral' {
  if (workflow === 'completed') return 'success';
  if (workflow === 'agronomist_review') return 'warn';
  return 'neutral';
}

function roleLabel(role: string): string {
  if (role === 'agronomist') return 'Agronomist';
  if (role === 'telecaller') return 'Telecaller';
  return 'Staff';
}

export function EscalationDetailModal({ row, canWrite, onClose, onSaved, onCleared }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
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
      onSaved?.({ completed: workflowStatus === 'completed' });
      if (workflowStatus !== 'completed') {
        await loadDetail();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function clearEscalation() {
    if (!canWrite || !detail) return;
    if (
      !window.confirm(
        'Clear this escalation? It will be removed from the completed list (record kept for audit).'
      )
    ) {
      return;
    }
    setClearing(true);
    setError('');
    try {
      await api(`${base}/escalations/${encodeURIComponent(detail.id)}/clear`, { method: 'POST' });
      onCleared?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear escalation');
    } finally {
      setClearing(false);
    }
  }

  return (
    <Modal title="Escalation details" onClose={onClose} wide>
      {loading ? <Loading label="Loading escalation…" /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={workflowBadgeTone(workflowStatus)}>{detail.statusLabel}</Badge>
            <Badge tone="neutral">{detail.priority} priority</Badge>
            <Badge tone="neutral">{detail.createdLabel}</Badge>
          </div>

          {detail.farmer ? (
            <p className="text-sm text-ink-secondary">
              <strong className="text-ink">{detail.farmer.name}</strong>
              {' · '}
              {formatPhoneDisplay(detail.farmer.phone)}
              {detail.farmer.district ? ` · ${detail.farmer.district}` : ''}
            </p>
          ) : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Reason</h3>
            <p className="mt-1 text-sm text-ink">{detail.reason}</p>
          </section>

          {detail.session ? (
            <dl className="grid gap-2 rounded-xl border border-border bg-surface-subtle/80 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Crop</dt>
                <dd>
                  {detail.session.cropType ?? '—'}
                  {detail.session.cropStage ? ` (${detail.session.cropStage})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">AI confidence</dt>
                <dd>
                  {detail.confidence != null
                    ? `${Math.round(Number(detail.confidence) * 100)}%`
                    : '—'}
                </dd>
              </div>
              {detail.session.symptomsText ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Symptoms</dt>
                  <dd>{detail.session.symptomsText}</dd>
                </div>
              ) : null}
              {detail.session.probableIssue || detail.session.summaryEn ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">AI summary</dt>
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Products suggested
              </h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink-secondary">
                {detail.productRecommendations.map((p, i) => (
                  <li key={i}>{p.title}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Comments (telecaller & agronomist)
            </h3>
            {detail.comments.length === 0 ? (
              <p className="text-sm text-ink-muted">No comments yet.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {detail.comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
                      <span className="font-medium text-ink-secondary">{roleLabel(c.authorRole)}</span>
                      <span>{c.author}</span>
                      <span>{c.createdLabel}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{c.body}</p>
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
              <p className="text-xs text-ink-secondary">
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
              <div className="flex flex-wrap gap-2">
                <Btn variant="primary" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save'}
                </Btn>
                {workflowStatus === 'completed' ? (
                  <Btn
                    variant="secondary"
                    disabled={clearing || saving}
                    onClick={() => void clearEscalation()}
                  >
                    {clearing ? 'Clearing…' : 'Clear escalation'}
                  </Btn>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-800">Read-only — you need write access to update.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
