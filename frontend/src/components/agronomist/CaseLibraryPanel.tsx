import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Loading } from '../ui';

const FIELD_BASE = '/morbeez-staff/api/v1/os/field';

type CaseLibraryRow = {
  id: string;
  category: string;
  issueName: string;
  finalDiagnosis: string | null;
  confidence: number | null;
  visitedAt: string;
  reviewAction: string | null;
  fieldFindingId?: string | null;
  dap?: number | null;
  dapBucket?: string | null;
  severity?: string | null;
  outcome?: string | null;
  cropType?: string | null;
};

type CaseDetail = {
  id: string;
  issueName: string;
  finalDiagnosis: string | null;
  hypotheses: Array<{ label: string; confidence: number; rationale?: string; selected?: boolean }>;
  questions: Array<{ questionText: string; answer?: string }>;
  recommendations: Array<{ aiText: string; humanText: string | null; reviewAction: string | null }>;
  metadata: Record<string, unknown>;
};

export function CaseLibraryPanel({ canWrite: _canWrite }: { canWrite: boolean }) {
  const [cropType, setCropType] = useState('');
  const [issue, setIssue] = useState('');
  const [outcome, setOutcome] = useState('');
  const [dapBucket, setDapBucket] = useState('');
  const [severity, setSeverity] = useState('');
  const [reviewAction, setReviewAction] = useState('');
  const [rows, setRows] = useState<CaseLibraryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState<CaseLibraryRow | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (cropType.trim()) params.set('cropType', cropType.trim());
      if (issue.trim()) params.set('issue', issue.trim());
      if (outcome.trim()) params.set('outcome', outcome.trim());
      if (dapBucket.trim()) params.set('dapBucket', dapBucket.trim());
      if (severity.trim()) params.set('severity', severity.trim());
      if (reviewAction.trim()) params.set('reviewAction', reviewAction.trim());
      params.set('limit', '40');
      const r = await api<{ ok: boolean; cases: CaseLibraryRow[] }>(
        `${FIELD_BASE}/visits/case-library?${params}`
      );
      setRows(r.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load case library');
    } finally {
      setLoading(false);
    }
  }, [cropType, issue, outcome, dapBucket, severity, reviewAction]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(row: CaseLibraryRow) {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; case: CaseDetail }>(
        `${FIELD_BASE}/visits/ai-case/${encodeURIComponent(row.id)}`
      );
      setDetail(r.case ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load case detail');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="agronomist-panel">
      <h2>Visit AI case library</h2>
      <p className="text-muted">
        Search submitted field visits with AI hypotheses, Q&amp;A, recommendations, and agronomist review
        decisions.
      </p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div className="agronomist-filter-row" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="form-control" placeholder="Crop type" value={cropType} onChange={(e) => setCropType(e.target.value)} />
        <input className="form-control" placeholder="Issue / diagnosis" value={issue} onChange={(e) => setIssue(e.target.value)} />
        <input className="form-control" placeholder="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        <input className="form-control" placeholder="DAP bucket" value={dapBucket} onChange={(e) => setDapBucket(e.target.value)} />
        <input className="form-control" placeholder="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} />
        <input className="form-control" placeholder="Review action" value={reviewAction} onChange={(e) => setReviewAction(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={() => void load()} disabled={loading}>
          Search
        </button>
      </div>
      {loading ? <Loading label="Loading cases…" /> : null}
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Visited</th>
            <th>Crop</th>
            <th>Issue</th>
            <th>Diagnosis</th>
            <th>DAP</th>
            <th>Confidence</th>
            <th>Outcome</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => void openDetail(row)}>
              <td>{new Date(row.visitedAt).toLocaleDateString('en-IN')}</td>
              <td>{row.cropType ?? '—'}</td>
              <td>{row.issueName}</td>
              <td>{row.finalDiagnosis ?? '—'}</td>
              <td>{row.dap ?? row.dapBucket ?? '—'}</td>
              <td>{row.confidence != null ? `${Math.round(row.confidence * 100)}%` : '—'}</td>
              <td>{row.outcome ?? '—'}</td>
              <td>{row.reviewAction?.replace(/_/g, ' ') ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && !rows.length ? <p className="text-muted">No submitted visit AI cases yet.</p> : null}

      {selected ? (
        <div className="agronomist-panel" style={{ marginTop: 16, border: '1px solid #ddd', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{selected.finalDiagnosis ?? selected.issueName}</h3>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {selected.fieldFindingId ? (
            <p className="text-muted">
              Field finding:{' '}
              <a href={`/agronomist/visits/${selected.fieldFindingId}`}>Open visit record</a>
            </p>
          ) : null}
          {detailLoading ? <Loading label="Loading case detail…" /> : null}
          {detail ? (
            <>
              <h4>Hypotheses</h4>
              <ul>
                {(detail.hypotheses ?? []).map((h) => (
                  <li key={h.label}>
                    {h.label} ({Math.round(h.confidence * 100)}%){h.selected ? ' · selected' : ''}
                  </li>
                ))}
              </ul>
              <h4>Follow-up Q&amp;A</h4>
              <ul>
                {(detail.questions ?? []).map((q, i) => (
                  <li key={`${q.questionText}-${i}`}>
                    {q.questionText} — {q.answer ?? 'unanswered'}
                  </li>
                ))}
              </ul>
              <h4>Recommendation</h4>
              {(detail.recommendations ?? []).map((rec, i) => (
                <p key={i}>
                  {rec.humanText ?? rec.aiText}
                  {rec.reviewAction ? ` (${rec.reviewAction.replace(/_/g, ' ')})` : ''}
                </p>
              ))}
              {detail.metadata?.imageSignal ? (
                <p className="text-muted">Image signal: {JSON.stringify(detail.metadata.imageSignal)}</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
