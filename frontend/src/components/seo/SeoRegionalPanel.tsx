import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { SEO_API } from './seo-api';

type Trend = {
  id: string;
  region: string;
  keyword: string;
  trend_score: number;
  search_volume_estimate: number | null;
  notes: string | null;
  suggested_page_slug: string | null;
};

export function SeoRegionalPanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ region: 'Karnataka', keyword: '', trendScore: '50', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; trends: Trend[] }>(`${SEO_API}/regional`);
      setRows(d.trends ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load regional trends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!canWrite || !draft.keyword.trim()) return;
    await api(`${SEO_API}/regional`, {
      method: 'POST',
      body: JSON.stringify({
        region: draft.region,
        keyword: draft.keyword,
        trendScore: Number(draft.trendScore) || 0,
        notes: draft.notes || undefined,
      }),
    });
    setDraft((s) => ({ ...s, keyword: '', notes: '' }));
    await load();
  }

  return (
    <Panel title="Regional SEO intelligence" description="Karnataka, Kerala, Tamil Nadu search trends">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        <div className="seo-form-row mb-4">
          <input className={inputClass} value={draft.region} onChange={(e) => setDraft((s) => ({ ...s, region: e.target.value }))} />
          <input className={inputClass} placeholder="Keyword" value={draft.keyword} onChange={(e) => setDraft((s) => ({ ...s, keyword: e.target.value }))} />
          <input className={inputClass} placeholder="Trend score" value={draft.trendScore} onChange={(e) => setDraft((s) => ({ ...s, trendScore: e.target.value }))} />
          <Btn size="sm" onClick={() => void add()}>Add trend</Btn>
        </div>
      ) : null}
      {loading ? <Loading /> : null}
      {!loading && rows.length === 0 ? <EmptyState>No regional trends.</EmptyState> : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Region</th>
                <th>Keyword</th>
                <th>Score</th>
                <th>Volume est.</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.region}</td>
                  <td>{t.keyword}</td>
                  <td>{t.trend_score}</td>
                  <td>{t.search_volume_estimate ?? '—'}</td>
                  <td className="text-sm">{t.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
