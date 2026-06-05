import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap } from '../ui';
import { SEO_API } from './seo-api';

type Sitemap = {
  id: string;
  sitemap_type: string;
  url: string;
  url_count: number;
  status: string;
  last_generated_at: string | null;
  submitted_at: string | null;
};

export function SeoSitemapPanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Sitemap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; sitemaps: Sitemap[] }>(`${SEO_API}/sitemaps`);
      setRows(d.sitemaps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sitemaps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!canWrite) return;
    const d = await api<{ ok: boolean; note?: string }>(`${SEO_API}/sitemaps/generate`, { method: 'POST' });
    setMsg(d.note ?? 'Sitemaps regenerated');
    await load();
  }

  async function submit(id: string) {
    if (!canWrite) return;
    await api(`${SEO_API}/sitemaps/${id}/submit`, { method: 'POST' });
    await load();
  }

  return (
    <Panel
      title="Sitemap manager"
      description="Product, blog, category, image, and custom content sitemaps"
      actions={
        canWrite ? (
          <Btn size="sm" onClick={() => void generate()}>
            Regenerate all
          </Btn>
        ) : null
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {msg ? <Alert tone="success">{msg}</Alert> : null}
      {loading ? <Loading /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState>No sitemaps registered — click Regenerate all.</EmptyState>
      ) : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Type</th>
                <th>URL</th>
                <th>URLs</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.sitemap_type}</td>
                  <td className="mono text-sm">{s.url}</td>
                  <td>{s.url_count}</td>
                  <td>{s.status}</td>
                  <td>
                    {canWrite && s.status !== 'submitted' ? (
                      <Btn size="sm" variant="secondary" onClick={() => void submit(s.id)}>
                        Mark submitted
                      </Btn>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
