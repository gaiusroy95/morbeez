import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, Loading, Panel, inputClass } from '../ui';
import { SEO_API } from './seo-api';

type GscState = {
  config: {
    configured: boolean;
    siteUrl: string | null;
    lastSyncAt: string | null;
    syncStatus: string;
  };
  snapshot: {
    snapshot_date: string;
    indexed_pages: number;
    total_clicks: number;
    total_impressions: number;
    top_queries: Array<{ keyword: string; clicks: number }>;
  } | null;
};

export function SeoGscPanel({ canWrite }: { canWrite: boolean }) {
  const [data, setData] = useState<GscState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean } & GscState>(`${SEO_API}/gsc`);
      setData(d);
      if (d.config.siteUrl) setSiteUrl(d.config.siteUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GSC');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveConfig() {
    if (!canWrite || !siteUrl.trim()) return;
    await api(`${SEO_API}/gsc/config`, {
      method: 'POST',
      body: JSON.stringify({ siteUrl: siteUrl.trim() }),
    });
    await load();
  }

  async function sync() {
    if (!canWrite) return;
    const r = await api<{ ok: boolean; reason?: string }>(`${SEO_API}/gsc/sync`, { method: 'POST' });
    setSyncMsg(r.ok ? 'GSC sync completed' : r.reason ?? 'Sync failed');
    await load();
  }

  if (loading) return <Loading label="Loading Search Console…" />;

  return (
    <div className="seo-gsc">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {syncMsg ? <Alert tone="success">{syncMsg}</Alert> : null}

      <Panel title="Google Search Console">
        <p className="muted text-sm mb-3">
          Connect GSC via <code>GSC_SITE_URL</code> and <code>GSC_REFRESH_TOKEN</code> on the API server.
          Until then, sync aggregates keyword data from the SEO panel.
        </p>
        <p>
          Status:{' '}
          <strong>{data?.config.syncStatus ?? 'unknown'}</strong>
          {data?.config.configured ? ' (credentials detected)' : ' (not configured)'}
        </p>
        {canWrite ? (
          <div className="seo-form-row mt-4">
            <input className={inputClass} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://your-store.com" />
            <Btn size="sm" variant="secondary" onClick={() => void saveConfig()}>
              Save site URL
            </Btn>
            <Btn size="sm" onClick={() => void sync()}>
              Sync now
            </Btn>
          </div>
        ) : null}
      </Panel>

      {data?.snapshot ? (
        <Panel title={`Latest snapshot — ${data.snapshot.snapshot_date}`} className="mt-4">
          <ul className="warehouse-kpi-list">
            <li>
              <span>Indexed pages</span>
              <strong>{data.snapshot.indexed_pages}</strong>
            </li>
            <li>
              <span>Clicks</span>
              <strong>{data.snapshot.total_clicks}</strong>
            </li>
            <li>
              <span>Impressions</span>
              <strong>{data.snapshot.total_impressions}</strong>
            </li>
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
