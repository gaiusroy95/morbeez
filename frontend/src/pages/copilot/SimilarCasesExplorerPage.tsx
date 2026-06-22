import { useState } from 'react';
import { agronomistClient } from '@morbeez/shared';
import { PageShell, Btn, Input } from '../../components/ui';

type CaseRow = {
  issueLabel?: string;
  score?: number;
  confidence?: number;
  outcome?: string | null;
};

export function SimilarCasesExplorerPage() {
  const [crop, setCrop] = useState('ginger');
  const [issue, setIssue] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [error, setError] = useState('');

  async function search() {
    setError('');
    try {
      const r = await agronomistClient.getSimilarVisitCases(
        farmerId || '00000000-0000-4000-8000-000000000001',
        crop,
        issue || 'deficiency'
      );
      setRows(r as CaseRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    }
  }

  return (
    <PageShell title="Similar cases explorer">
      <div className="flex gap-2 mb-3 flex-wrap">
        <Input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="Crop" />
        <Input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Issue" />
        <Input value={farmerId} onChange={(e) => setFarmerId(e.target.value)} placeholder="Farmer ID (optional)" />
        <Btn onClick={() => void search()}>Search</Btn>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Score</th>
            <th>Confidence</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.issueLabel ?? '—'}</td>
              <td>{r.score != null ? Math.round(r.score * 100) : '—'}%</td>
              <td>{r.confidence != null ? Math.round(r.confidence * 100) : '—'}%</td>
              <td>{r.outcome ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && !error ? <p className="muted">No similar cases found.</p> : null}
    </PageShell>
  );
}
