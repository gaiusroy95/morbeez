import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { SEO_API } from './seo-api';

type Link = {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  anchor_text: string;
  auto_generated: boolean;
};

export function SeoLinksPanel({ canWrite }: { canWrite: boolean }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageId, setPageId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; links: Link[] }>(`${SEO_API}/links`);
      setLinks(d.links ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function autoLink() {
    if (!canWrite || !pageId.trim()) return;
    await api(`${SEO_API}/links/auto/${pageId.trim()}`, { method: 'POST' });
    await load();
  }

  return (
    <Panel title="Internal linking engine" description="Auto-link products, related diseases, and advisory pages">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        <div className="seo-form-row mb-4">
          <input
            className={inputClass}
            placeholder="Content page UUID for auto-link"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
          />
          <Btn size="sm" onClick={() => void autoLink()}>
            Auto-link page
          </Btn>
        </div>
      ) : null}
      {loading ? <Loading /> : null}
      {!loading && links.length === 0 ? <EmptyState>No internal links yet.</EmptyState> : null}
      {!loading && links.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Anchor</th>
                <th>Auto</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.source_type}:{l.source_id.slice(0, 8)}
                  </td>
                  <td>
                    {l.target_type}:{l.target_id.slice(0, 8)}
                  </td>
                  <td>{l.anchor_text}</td>
                  <td>{l.auto_generated ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
