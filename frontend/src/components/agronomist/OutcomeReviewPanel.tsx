import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Loading } from '../ui';
import {
  RECOMMENDATION_OUTCOMES,
  RECOMMENDATION_OUTCOME_LABELS,
  type RecommendationOutcome,
} from '../../lib/ai-training-enums';
import { FollowUpKpiPanel } from './FollowUpKpiPanel';
import '../../styles/outcome-review.css';

const base = '/morbeez-staff/api/v1/os/agronomist';

type QueueItem = {
  id: string;
  farmerId: string;
  issueDetected: string | null;
  recommendationText: string;
  status: string;
  applicationStatus: string | null;
  communicatedAt: string | null;
  appliedAt: string | null;
  dapAtRecommendation: number | null;
  farmer: { name: string | null; phone: string | null; district: string | null } | null;
  block: { name: string; cropType: string; plotLabel: string | null } | null;
  pendingFollowUp: {
    status: string;
    scheduledAt: string;
    farmerResponse: string | null;
  } | null;
  outcomeKpi?: Record<string, unknown> | null;
  needsHumanOutcomeReview?: boolean;
  humanOutcomeReviewReason?: string | null;
};

type OutcomeDetail = {
  recommendation: QueueItem & {
    dosage: string | null;
    outcome: string | null;
    source: string | null;
  };
  application: Record<string, unknown> | null;
  followUps: Array<Record<string, unknown>>;
  session: { confidence_score?: number } | null;
};

type Filter = 'pending' | 'overdue' | 'needs_review' | 'all';

export function OutcomeReviewPanel({ canWrite }: { canWrite: boolean }) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OutcomeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [outcome, setOutcome] = useState<RecommendationOutcome>('better');
  const [recoveryDays, setRecoveryDays] = useState('');
  const [farmerFeedback, setFarmerFeedback] = useState('');
  const [agronomistFeedback, setAgronomistFeedback] = useState('');
  const [notes, setNotes] = useState('');
  const [issueResolved, setIssueResolved] = useState(true);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; items: QueueItem[]; pendingCount: number }>(
        `${base}/outcome-review?filter=${filter}&limit=40`
      );
      setItems(r.items ?? []);
      setPendingCount(r.pendingCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load outcome queue');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await api<{ ok: boolean } & OutcomeDetail>(`${base}/outcome-review/${id}`);
      setDetail(r);
      const fu = r.recommendation.pendingFollowUp;
      if (fu?.farmerResponse) {
        setFarmerFeedback(fu.farmerResponse.replace(/_/g, ' '));
      } else {
        setFarmerFeedback('');
      }
      setAgronomistFeedback('');
      setNotes('');
      setRecoveryDays('');
      setOutcome('better');
      setIssueResolved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendation');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    setIssueResolved(outcome === 'better' || outcome === 'partial');
  }, [outcome]);

  async function submitOutcome(reviewNext = false) {
    if (!selectedId || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/outcome-review/${selectedId}/record`, {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          notes: notes || undefined,
          recoveryDays: recoveryDays ? Number(recoveryDays) : undefined,
          farmerFeedback: farmerFeedback || undefined,
          agronomistFeedback: agronomistFeedback || undefined,
          issueResolved,
        }),
      });

      const remaining = items.filter((i) => i.id !== selectedId);
      setItems(remaining);
      setPendingCount((c) => Math.max(0, c - 1));

      if (reviewNext && remaining.length > 0) {
        setSelectedId(remaining[0]?.id ?? null);
      } else if (remaining.length > 0) {
        setSelectedId(remaining[0]?.id ?? null);
      } else {
        setSelectedId(null);
        setDetail(null);
        await loadQueue();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record outcome');
    } finally {
      setSaving(false);
    }
  }

  const rec = detail?.recommendation;
  const confPct =
    detail?.session?.confidence_score != null
      ? Math.round(Number(detail.session.confidence_score) * 100)
      : null;

  return (
    <div className="or-page mt-4">
      <FollowUpKpiPanel />
      {error ? (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      ) : null}

      <div className="or-shell">
        <aside className="or-queue">
          <div className="or-queue-head">
            <h3>
              Outcome review
              {pendingCount > 0 ? <span className="or-pending-badge">{pendingCount}</span> : null}
            </h3>
            <div className="or-filter-row">
              {(['pending', 'overdue', 'needs_review', 'all'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`or-filter-btn${filter === f ? ' is-active' : ''}`}
                  onClick={() => {
                    setFilter(f);
                    setSelectedId(null);
                  }}
                >
                  {f === 'pending'
                    ? 'Pending'
                    : f === 'overdue'
                      ? 'Overdue'
                      : f === 'needs_review'
                        ? 'Verify KPI'
                        : 'Recorded'}
                </button>
              ))}
            </div>
          </div>
          <div className="or-queue-list">
            {loading ? <Loading /> : null}
            {!loading && items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-muted">No recommendations in this filter.</p>
            ) : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`or-queue-item${selectedId === item.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="or-queue-item-title">
                  {item.farmer?.name ?? item.farmer?.phone ?? 'Farmer'}
                </div>
                <div className="or-queue-item-meta">
                  {item.block?.cropType ?? 'Crop'} · DAP {item.dapAtRecommendation ?? '—'}
                  {item.appliedAt
                    ? ` · Applied ${new Date(item.appliedAt).toLocaleDateString('en-IN')}`
                    : item.communicatedAt
                      ? ` · Sent ${new Date(item.communicatedAt).toLocaleDateString('en-IN')}`
                      : ''}
                </div>
                {item.issueDetected ? (
                  <div className="or-queue-item-issue">{item.issueDetected}</div>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <main className="or-workspace">
          {!selectedId ? (
            <div className="or-workspace-empty">Select a recommendation to record its outcome.</div>
          ) : detailLoading ? (
            <div className="or-workspace-empty">
              <Loading />
            </div>
          ) : rec ? (
            <>
              <h4 className="text-base font-semibold mb-3">Record recommendation effectiveness</h4>

              <div className="or-detail-grid">
                <div className="or-detail-card">
                  <span>Farmer</span>
                  {rec.farmer?.name ?? rec.farmer?.phone ?? '—'}
                  {rec.farmer?.district ? ` · ${rec.farmer.district}` : ''}
                </div>
                <div className="or-detail-card">
                  <span>Block / crop</span>
                  {rec.block?.plotLabel ?? rec.block?.name ?? '—'} · {rec.block?.cropType ?? '—'}
                </div>
                <div className="or-detail-card">
                  <span>Issue</span>
                  {rec.issueDetected ?? '—'}
                </div>
                <div className="or-detail-card">
                  <span>AI confidence</span>
                  {confPct != null ? `${confPct}%` : '—'}
                </div>
              </div>

              <div className="or-rec-box">
                <strong>Recommendation</strong>
                <p className="mt-2">{rec.recommendationText}</p>
                {rec.dosage ? <p className="mt-2 text-sm text-ink-secondary">Dosage: {rec.dosage}</p> : null}
              </div>

              {rec.pendingFollowUp ? (
                <div className="or-followup-hint">
                  WhatsApp outcome check: {rec.pendingFollowUp.status}
                  {rec.pendingFollowUp.farmerResponse
                    ? ` · Farmer said: ${rec.pendingFollowUp.farmerResponse.replace(/_/g, ' ')}`
                    : ''}
                </div>
              ) : null}

              {rec.needsHumanOutcomeReview ? (
                <div className="or-followup-hint or-followup-hint--warn">
                  <strong>Selective verification required</strong>
                  {rec.humanOutcomeReviewReason ? (
                    <p className="mt-1 text-sm">{rec.humanOutcomeReviewReason}</p>
                  ) : null}
                </div>
              ) : null}

              {rec.outcomeKpi && typeof rec.outcomeKpi === 'object' ? (
                <div className="or-followup-hint">
                  <strong>WhatsApp KPI (automated)</strong>
                  <p className="mt-1 text-sm">
                    Level: {String(rec.outcomeKpi.improvementLevel ?? '—').replace(/_/g, ' ')}
                    {rec.outcomeKpi.photoUploaded ? ' · Photo received' : ''}
                    {rec.outcomeKpi.aiClassification
                      ? ` · AI: ${String(rec.outcomeKpi.aiClassification)}`
                      : ''}
                  </p>
                </div>
              ) : null}

              {canWrite && filter !== 'all' ? (
                <>
                  <div className="or-outcome-row">
                    {RECOMMENDATION_OUTCOMES.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={`or-outcome-btn${o === 'no_improvement' ? ' or-outcome-btn--bad' : ''}${outcome === o ? ' is-active' : ''}`}
                        onClick={() => setOutcome(o)}
                      >
                        {RECOMMENDATION_OUTCOME_LABELS[o]}
                      </button>
                    ))}
                  </div>

                  <div className="or-field">
                    <label htmlFor="or-recovery">Recovery days</label>
                    <input
                      id="or-recovery"
                      type="number"
                      min={0}
                      max={365}
                      placeholder="e.g. 7"
                      value={recoveryDays}
                      onChange={(e) => setRecoveryDays(e.target.value)}
                    />
                  </div>

                  <div className="or-field">
                    <label htmlFor="or-farmer-fb">Farmer feedback</label>
                    <textarea
                      id="or-farmer-fb"
                      placeholder="What the farmer reported…"
                      value={farmerFeedback}
                      onChange={(e) => setFarmerFeedback(e.target.value)}
                    />
                  </div>

                  <div className="or-field">
                    <label htmlFor="or-agron-fb">Agronomist assessment</label>
                    <textarea
                      id="or-agron-fb"
                      placeholder="Field observation for AI training…"
                      value={agronomistFeedback}
                      onChange={(e) => setAgronomistFeedback(e.target.value)}
                    />
                  </div>

                  <div className="or-field">
                    <label htmlFor="or-notes">Notes</label>
                    <textarea
                      id="or-notes"
                      placeholder="Optional summary"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <label className="or-checkbox-row">
                    <input
                      type="checkbox"
                      checked={issueResolved}
                      onChange={(e) => setIssueResolved(e.target.checked)}
                    />
                    Issue resolved
                  </label>

                  <button
                    type="button"
                    className="or-submit"
                    disabled={saving}
                    onClick={() => void submitOutcome(true)}
                  >
                    Save outcome &amp; next
                  </button>
                </>
              ) : filter === 'all' && rec.outcome ? (
                <p className="text-sm text-ink-secondary">
                  Recorded outcome: <strong>{rec.outcome}</strong>
                </p>
              ) : (
                <p className="text-sm text-ink-muted">Read-only — agronomist write access required.</p>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
