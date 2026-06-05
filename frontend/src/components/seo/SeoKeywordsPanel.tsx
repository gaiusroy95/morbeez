import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { SEO_API } from './seo-api';

type Keyword = {
  id: string;
  keyword: string;
  region: string | null;
  position: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
};

export function SeoKeywordsPanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ keyword: '', region: '', position: '', clicks: '', impressions: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; keywords: Keyword[] }>(`${SEO_API}/keywords`);
      setRows(d.keywords ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!canWrite || !draft.keyword.trim()) return;
    await api(`${SEO_API}/keywords`, {
      method: 'POST',
      body: JSON.stringify({
        keyword: draft.keyword,
        region: draft.region || undefined,
        position: draft.position ? Number(draft.position) : undefined,
        clicks: draft.clicks ? Number(draft.clicks) : undefined,
        impressions: draft.impressions ? Number(draft.impressions) : undefined,
      }),
    });
    setDraft({ keyword: '', region: '', position: '', clicks: '', impressions: '' });
    await load();
  }

  return (
    <Panel title="Keyword tracking" description="Rankings, impressions, CTR, organic traffic">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        <div className="seo-form-row mb-4">
          <input className={inputClass} placeholder="Keyword" value={draft.keyword} onChange={(e) => setDraft((s) => ({ ...s, keyword: e.target.value }))} />
          <input className={inputClass} placeholder="Region" value={draft.region} onChange={(e) => setDraft((s) => ({ ...s, region: e.target.value }))} />
          <input className={inputClass} placeholder="Position" value={draft.position} onChange={(e) => setDraft((s) => ({ ...s, position: e.target.value }))} />
          <input className={inputClass} placeholder="Clicks" value={draft.clicks} onChange={(e) => setDraft((s) => ({ ...s, clicks: e.target.value }))} />
          <Btn size="sm" onClick={() => void add()}>Add</Btn>
        </div>
      ) : null}
      {loading ? <Loading /> : null}
      {!loading && rows.length === 0 ? <EmptyState>No keywords tracked yet.</EmptyState> : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Region</th>
                <th>Position</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id}>
                  <td>{k.keyword}</td>
                  <td>{k.region ?? '—'}</td>
                  <td>{k.position ?? '—'}</td>
                  <td>{k.clicks}</td>
                  <td>{k.impressions}</td>
                  <td>{k.ctr != null ? `${(Number(k.ctr) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
