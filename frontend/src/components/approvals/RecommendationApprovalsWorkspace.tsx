import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Badge, Btn, EmptyState, Loading, SearchSelect } from '../ui';

export type ApprovalListItem = {
  id: string;
  status: string;
  issueDetected: string | null;
  recommendationText: string;
  dosage: string | null;
  language: string;
  createdBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  farmerName: string | null;
  farmerPhone: string | null;
  blockLabel: string | null;
  cropType: string | null;
  lastAudit: string | null;
};

type ApprovalDetail = ApprovalListItem & {
  canEdit: boolean;
  auditLog: Array<{ action: string; by: string; at: string; label: string; note?: string | null }>;
};

type Props = {
  canWrite: boolean;
  canApprove: boolean;
  /** Super admin sees all; agronomist sees own via mine=1 */
  mineOnly: boolean;
};

function statusTone(status: string): 'warn' | 'ok' | 'neutral' | 'error' {
  if (status === 'pending_approval') return 'warn';
  if (status === 'approved' || status === 'communicated') return 'ok';
  if (status === 'rejected') return 'error';
  return 'neutral';
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function RecommendationApprovalsWorkspace({ canWrite, canApprove, mineOnly }: Props) {
  const [statusFilter, setStatusFilter] = useState(
    mineOnly ? 'all' : 'pending'
  );
  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [rejectNotes, setRejectNotes] = useState('');

  const [form, setForm] = useState({
    issueDetected: '',
    recommendationText: '',
    dosage: '',
    language: 'en',
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const mine = mineOnly ? '1' : '0';
      const r = await api<{ ok: boolean; items: ApprovalListItem[] }>(
        `/morbeez-staff/api/v1/os/recommendations/approvals?status=${encodeURIComponent(statusFilter)}&mine=${mine}`
      );
      setItems(r.items ?? []);
      if (r.items?.length && !selectedId) setSelectedId(r.items[0].id);
      else if (selectedId && !r.items?.some((i) => i.id === selectedId)) {
        setSelectedId(r.items?.[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, mineOnly]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await api<{ ok: boolean; recommendation: ApprovalDetail }>(
        `/morbeez-staff/api/v1/os/recommendations/${id}/approval-detail`
      );
      setDetail(r.recommendation);
      setForm({
        issueDetected: r.recommendation.issueDetected ?? '',
        recommendationText: r.recommendation.recommendationText ?? '',
        dosage: r.recommendation.dosage ?? '',
        language: r.recommendation.language ?? 'en',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load detail');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const editable = Boolean(detail?.canEdit && canWrite);

  async function saveEdit() {
    if (!selectedId || !editable) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api(`/morbeez-staff/api/v1/os/recommendations/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSuccess('Saved.');
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function act(action: 'approve' | 'reject') {
    if (!selectedId || !canApprove) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (action === 'approve') {
        const d = await api<{ ok: boolean; whatsapp?: { sent: boolean; reason?: string } }>(
          `/morbeez-staff/api/v1/os/recommendations/${selectedId}/approve`,
          { method: 'POST', body: JSON.stringify({ sendWhatsApp }) }
        );
        if (d.whatsapp?.sent) setSuccess('Approved and sent via WhatsApp.');
        else setSuccess('Approved.');
      } else {
        await api(`/morbeez-staff/api/v1/os/recommendations/${selectedId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ notes: rejectNotes || undefined }),
        });
        setSuccess('Rejected.');
      }
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="approvals-workspace">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="approvals-toolbar">
        <SearchSelect
          label="Status"
          className="approvals-select"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'pending', label: 'Pending approval' },
            { value: 'open', label: 'Draft + pending' },
            { value: 'all', label: 'All' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'communicated', label: 'Communicated' },
          ]}
        />
        {canApprove ? (
          <label className="approvals-check">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
            />
            Send WhatsApp on approve
          </label>
        ) : null}
      </div>

      {loading ? <Loading label="Loading approvals…" /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState>No recommendations in this filter.</EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="approvals-split">
          <div className="approvals-list-panel">
            <table className="approvals-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Farmer</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Created by</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedId ? 'is-selected' : ''}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="approvals-dt">{fmt(row.updatedAt)}</td>
                    <td>
                      <div className="approvals-farmer">
                        {row.farmerName ?? row.farmerPhone ?? '—'}
                      </div>
                      {row.cropType ? (
                        <div className="approvals-sub">{row.cropType}</div>
                      ) : null}
                    </td>
                    <td className="approvals-issue">{row.issueDetected ?? '—'}</td>
                    <td>
                      <Badge tone={statusTone(row.status)}>
                        {row.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="approvals-by">{row.createdBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="approvals-detail-panel">
            {detailLoading || !detail ? (
              <Loading label="Loading detail…" />
            ) : (
              <>
                <header className="approvals-detail-head">
                  <div>
                    <h2 className="approvals-detail-title">
                      {detail.farmerName ?? detail.farmerPhone ?? 'Farmer'}
                    </h2>
                    <p className="approvals-detail-meta">
                      {detail.cropType ?? 'Crop'}
                      {detail.blockLabel ? ` · ${detail.blockLabel}` : ''}
                    </p>
                  </div>
                  <Badge tone={statusTone(detail.status)}>{detail.status.replace(/_/g, ' ')}</Badge>
                </header>

                <div className="approvals-audit">
                  <h3 className="approvals-section-title">Activity log</h3>
                  <ol className="approvals-audit-list">
                    {detail.auditLog.map((e, i) => (
                      <li key={`${e.at}-${i}`}>
                        <span className="approvals-audit-dot" />
                        <div>
                          <p className="approvals-audit-text">{e.label}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {detail.approvedBy ? (
                    <p className="approvals-meta-line">
                      <strong>Approved by:</strong> {detail.approvedBy}
                      {detail.approvedAt ? ` · ${fmt(detail.approvedAt)}` : ''}
                    </p>
                  ) : null}
                  {detail.createdBy ? (
                    <p className="approvals-meta-line">
                      <strong>Created by:</strong> {detail.createdBy} · {fmt(detail.createdAt)}
                    </p>
                  ) : null}
                </div>

                <div className="approvals-editor">
                  <h3 className="approvals-section-title">
                    Recommendation {editable ? '(editable)' : '(read-only)'}
                  </h3>
                  <label className="approvals-field">
                    <span>Issue</span>
                    <input
                      className="approvals-input"
                      value={form.issueDetected}
                      onChange={(e) => setForm((f) => ({ ...f, issueDetected: e.target.value }))}
                      readOnly={!editable}
                    />
                  </label>
                  <label className="approvals-field">
                    <span>WhatsApp message</span>
                    <textarea
                      className="approvals-textarea"
                      rows={14}
                      value={form.recommendationText}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, recommendationText: e.target.value }))
                      }
                      readOnly={!editable}
                    />
                  </label>
                  <label className="approvals-field">
                    <span>Dosage</span>
                    <textarea
                      className="approvals-textarea approvals-textarea--sm"
                      rows={2}
                      value={form.dosage}
                      onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                      readOnly={!editable}
                    />
                  </label>
                  {editable ? (
                    <Btn variant="secondary" disabled={saving} onClick={() => void saveEdit()}>
                      Save changes
                    </Btn>
                  ) : null}
                </div>

                {canApprove && detail.status === 'pending_approval' ? (
                  <div className="approvals-actions">
                    <Btn variant="primary" disabled={saving} onClick={() => void act('approve')}>
                      Approve
                    </Btn>
                    <Btn variant="secondary" disabled={saving} onClick={() => void act('reject')}>
                      Reject
                    </Btn>
                    <label className="approvals-field approvals-field--reject">
                      <span>Rejection note (optional)</span>
                      <input
                        className="approvals-input"
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
