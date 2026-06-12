import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Loading, StaticSelect } from '../ui';

const base = '/morbeez-staff/api/v1/os/telecaller';

type QcOverview = {
  callsToday: number;
  totalCalls: number;
  averageScore: number;
  interested: number;
  soilTestInterest: number;
  flaggedCalls: number;
};

type FlaggedCall = {
  id: string;
  lead_id: string;
  agent_email: string;
  qc_score: number | null;
  qc_flag_reason: string | null;
  ai_summary: string | null;
  transcript: string | null;
  created_at: string;
  farmers?: { name: string | null; phone: string | null };
};

export function TelecallerQcDashboard() {
  const [days, setDays] = useState('7');
  const [overview, setOverview] = useState<QcOverview | null>(null);
  const [flagged, setFlagged] = useState<FlaggedCall[]>([]);
  const [selected, setSelected] = useState<FlaggedCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, fl] = await Promise.all([
        api<{ ok: boolean; overview: QcOverview }>(`${base}/qc/overview?days=${days}`),
        api<{ ok: boolean; calls: FlaggedCall[] }>(`${base}/qc/flagged?days=${days}`),
      ]);
      setOverview(ov.overview);
      setFlagged(fl.calls ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load QC dashboard');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) return <Loading label="Loading QC dashboard…" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="tc-qc-dashboard">
      <div className="tc-qc-toolbar">
        <StaticSelect
          value={days}
          onChange={setDays}
          options={[
            { value: '1', label: 'Today' },
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
          ]}
        />
      </div>

      {overview ? (
        <div className="tc-kpi-strip">
          <article className="tc-kpi-card">
            <span className="tc-kpi-label">Calls</span>
            <strong className="tc-kpi-value">{overview.totalCalls}</strong>
          </article>
          <article className="tc-kpi-card">
            <span className="tc-kpi-label">Avg QC score</span>
            <strong className="tc-kpi-value">{overview.averageScore}</strong>
          </article>
          <article className="tc-kpi-card">
            <span className="tc-kpi-label">Interested</span>
            <strong className="tc-kpi-value">{overview.interested}</strong>
          </article>
          <article className="tc-kpi-card">
            <span className="tc-kpi-label">Flagged</span>
            <strong className="tc-kpi-value">{overview.flaggedCalls}</strong>
          </article>
        </div>
      ) : null}

      <section className="tc-dashboard-card">
        <div className="tc-card-head">
          <h3>Flagged calls</h3>
        </div>
        {flagged.length === 0 ? (
          <p className="tc-empty-row">No flagged calls in this period.</p>
        ) : (
          <div className="tc-qc-split">
            <ul className="tc-compact-list">
              {flagged.map((c) => (
                <li key={c.id}>
                  <button type="button" className="tc-inline-link" onClick={() => setSelected(c)}>
                    <strong>{c.farmers?.name ?? c.agent_email}</strong>
                    <span>
                      QC {c.qc_score ?? '—'} · {new Date(c.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selected ? (
              <article className="tc-qc-detail">
                <h4>{selected.farmers?.name ?? 'Call review'}</h4>
                <p className="muted">{selected.qc_flag_reason ?? 'Flagged for review'}</p>
                {selected.ai_summary ? (
                  <>
                    <p className="tc-call-summary-label">Summary</p>
                    <p>{selected.ai_summary}</p>
                  </>
                ) : null}
                {selected.transcript ? (
                  <>
                    <p className="tc-call-summary-label">Transcript excerpt</p>
                    <pre className="tc-qc-transcript">{selected.transcript.slice(0, 2000)}</pre>
                  </>
                ) : null}
              </article>
            ) : (
              <p className="tc-empty-row">Select a flagged call to review transcript.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
