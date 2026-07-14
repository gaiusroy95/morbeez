import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  FilterBar,
  Input,
  Loading,
  Panel,
  TableWrap,
} from '../ui';

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
    <div className="mt-4 space-y-4">
      <Panel
        title="Visit AI case library"
        description="Search submitted field visits with AI hypotheses, Q&A, recommendations, and agronomist review decisions."
      >
        {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
        <FilterBar>
          <Input placeholder="Crop type" value={cropType} onChange={(e) => setCropType(e.target.value)} />
          <Input placeholder="Issue / diagnosis" value={issue} onChange={(e) => setIssue(e.target.value)} />
          <Input placeholder="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          <Input placeholder="DAP bucket" value={dapBucket} onChange={(e) => setDapBucket(e.target.value)} />
          <Input placeholder="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} />
          <Input
            placeholder="Review action"
            value={reviewAction}
            onChange={(e) => setReviewAction(e.target.value)}
          />
          <Btn type="button" onClick={() => void load()} disabled={loading}>
            Search
          </Btn>
        </FilterBar>
        {loading ? <Loading label="Loading cases…" /> : null}
        {!loading && !rows.length ? (
          <EmptyState>No submitted visit AI cases yet.</EmptyState>
        ) : null}
        {!loading && rows.length > 0 ? (
          <TableWrap>
            <DataTable>
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
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-surface-subtle"
                    onClick={() => void openDetail(row)}
                  >
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
            </DataTable>
          </TableWrap>
        ) : null}
      </Panel>

      {selected ? (
        <Panel
          title={selected.finalDiagnosis ?? selected.issueName}
          actions={
            <Btn type="button" variant="secondary" size="sm" onClick={() => setSelected(null)}>
              Close
            </Btn>
          }
        >
          {selected.fieldFindingId ? (
            <p className="mb-4 text-sm text-ink-muted">
              Field finding:{' '}
              <Link
                className="text-brand-700 hover:underline"
                to={toPath(paths.agronomistVisitDetail.replace(':findingId', selected.fieldFindingId))}
              >
                Open visit record
              </Link>
            </p>
          ) : null}
          {detailLoading ? <Loading label="Loading case detail…" /> : null}
          {detail ? (
            <div className="space-y-4 text-sm text-ink-secondary">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Hypotheses
                </h4>
                <ul className="list-inside list-disc space-y-1">
                  {(detail.hypotheses ?? []).map((h) => (
                    <li key={h.label}>
                      {h.label} ({Math.round(h.confidence * 100)}%){h.selected ? ' · selected' : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Follow-up Q&amp;A
                </h4>
                <ul className="list-inside list-disc space-y-1">
                  {(detail.questions ?? []).map((q, i) => (
                    <li key={`${q.questionText}-${i}`}>
                      {q.questionText} — {q.answer ?? 'unanswered'}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Recommendation
                </h4>
                {(detail.recommendations ?? []).map((rec, i) => (
                  <p key={i}>
                    {rec.humanText ?? rec.aiText}
                    {rec.reviewAction ? ` (${rec.reviewAction.replace(/_/g, ' ')})` : ''}
                  </p>
                ))}
              </div>
              {detail.metadata?.imageSignal ? (
                <p className="text-sm text-ink-muted">
                  Image signal: {JSON.stringify(detail.metadata.imageSignal)}
                </p>
              ) : null}
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
