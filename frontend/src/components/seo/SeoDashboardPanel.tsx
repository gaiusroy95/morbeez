import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Loading, Panel } from '../ui';
import { SEO_API } from './seo-api';

type Dashboard = {
  indexedPages: number;
  missingSeoCount: number;
  brokenLinksCount: number;
  schemaErrorsCount: number;
  openHealthIssues: number;
  contentPageCount: number;
  publishedPageCount: number;
  cropProblemCount: number;
  topProductTraffic: Array<{ id: string; title: string; score: number }>;
  trafficByKeyword: Array<{ keyword: string; clicks: number; impressions: number; position: number | null }>;
  lowCtrPages: Array<{ keyword?: string; query?: string; impressions: number; clicks: number }>;
  topRankingPages: unknown[];
  regionalHighlights: Array<{ region: string; keyword: string; trend_score: number }>;
  gscLastSync: string | null;
  gscTotals: { clicks: number; impressions: number; avgCtr: number; avgPosition: number } | null;
};

export function SeoDashboardPanel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean; dashboard: Dashboard }>(`${SEO_API}/dashboard`)
      .then((d) => setData(d.dashboard))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load SEO dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading SEO dashboard…" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="seo-dashboard">
      <div className="seo-kpi-grid">
        <div className="seo-kpi-card">
          <strong>{data.indexedPages}</strong>
          <span>Indexed pages</span>
        </div>
        <div className="seo-kpi-card">
          <strong>{data.missingSeoCount}</strong>
          <span>Missing SEO</span>
        </div>
        <div className="seo-kpi-card">
          <strong>{data.brokenLinksCount}</strong>
          <span>Broken links</span>
        </div>
        <div className="seo-kpi-card">
          <strong>{data.schemaErrorsCount}</strong>
          <span>Schema issues</span>
        </div>
        <div className="seo-kpi-card">
          <strong>{data.openHealthIssues}</strong>
          <span>Open health issues</span>
        </div>
        <div className="seo-kpi-card">
          <strong>{data.publishedPageCount}/{data.contentPageCount}</strong>
          <span>Published content pages</span>
        </div>
        <div className="seo-kpi-card">
          <strong>{data.cropProblemCount}</strong>
          <span>Crop problem pages</span>
        </div>
        {data.gscTotals ? (
          <div className="seo-kpi-card">
            <strong>{data.gscTotals.clicks}</strong>
            <span>Organic clicks (GSC)</span>
          </div>
        ) : null}
      </div>

      <div className="seo-kpi-grid">
        <Panel title="Top product SEO scores">
          <ul className="warehouse-kpi-list">
            {(data.topProductTraffic ?? []).map((p) => (
              <li key={p.id}>
                <span>{p.title}</span>
                <strong>{p.score}%</strong>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Traffic by keyword">
          <ul className="warehouse-kpi-list">
            {(data.trafficByKeyword ?? []).slice(0, 8).map((k) => (
              <li key={k.keyword}>
                <span>{k.keyword}</span>
                <strong>{k.clicks} clicks</strong>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Low CTR opportunities">
          <ul className="warehouse-kpi-list">
            {(data.lowCtrPages ?? []).slice(0, 6).map((p, i) => (
              <li key={i}>
                <span>{p.keyword ?? p.query ?? '—'}</span>
                <strong>{p.impressions} imp</strong>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Regional intelligence">
          <ul className="warehouse-kpi-list">
            {(data.regionalHighlights ?? []).map((r) => (
              <li key={`${r.region}-${r.keyword}`}>
                <span>
                  {r.region}: {r.keyword}
                </span>
                <strong>{r.trend_score}</strong>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
