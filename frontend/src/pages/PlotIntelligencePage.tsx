import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { agronomistClient } from '@morbeez/shared';
import { api } from '../lib/api';
import { MiniTrendChart } from '../components/intelligence/MiniTrendChart';
import { HubTabs, PageShell, Loading } from '../components/ui';
import { paths, toPath } from '../lib/routes';

type Trends = {
  recurringIssues: Array<{ label: string; count: number }>;
  soilTrend?: { nitrogen?: number[]; potassium?: number[]; ph?: number[] };
  waterReadings?: Array<{ key: string; value: string; at: string }>;
  yieldHistory?: Array<{ cropType: string; yieldKgPerAcre: number | null; harvestDate: string | null }>;
  satelliteOverlays?: Array<{ ndvi: number | null; capturedAt: string; provider: string }>;
  regionalRiskFlags?: string[];
  outcomeHistory: Array<{ issue: string; outcome: string | null; at: string }>;
  visitCount12m: number;
};

type Tab = 'overview' | 'applications';

export function PlotIntelligencePage() {
  const { farmerId, blockId } = useParams<{ farmerId: string; blockId: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [trends, setTrends] = useState<Trends | null>(null);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!farmerId || !blockId) return;
    void agronomistClient
      .getPlotIntelligence(blockId)
      .then((t) => setTrends(t as unknown as Trends))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
    void api<{ ok: boolean; rows: Array<Record<string, unknown>> }>(
      `/morbeez-staff/api/v1/os/farmers/${farmerId}/application-history?blockId=${blockId}`
    )
      .then((r) => setApps(r.rows ?? []))
      .catch(() => setApps([]));
  }, [farmerId, blockId]);

  if (!trends) return <Loading label="Loading plot intelligence…" />;

  return (
    <PageShell title="Plot intelligence">
      {error ? <p className="text-red-600">{error}</p> : null}
      <p className="muted">Visits (12m): {trends.visitCount12m}</p>
      {farmerId ? (
        <p>
          <Link to={toPath(paths.farmer360.replace(':farmerId', farmerId))}>Farmer 360</Link>
        </p>
      ) : null}
      <HubTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'applications', label: 'Application history' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' ? (
        <>
          <h3 className="mt-4">Recurring issues</h3>
          <ul>
            {trends.recurringIssues.map((r) => (
              <li key={r.label}>
                {r.label} ({r.count}x)
              </li>
            ))}
          </ul>
          <h3 className="mt-4">Soil trends</h3>
          <MiniTrendChart label="Nitrogen" values={trends.soilTrend?.nitrogen ?? []} />
          <MiniTrendChart label="Potassium" values={trends.soilTrend?.potassium ?? []} />
          <MiniTrendChart label="pH" values={trends.soilTrend?.ph ?? []} />
          <h3 className="mt-4">Yield history</h3>
          {(trends.yieldHistory ?? []).length ? (
            <MiniTrendChart
              label="Yield (kg/acre)"
              values={(trends.yieldHistory ?? []).map((y) => y.yieldKgPerAcre ?? 0)}
            />
          ) : null}
          <ul>
            {(trends.yieldHistory ?? []).map((y, i) => (
              <li key={i}>
                {y.cropType}: {y.yieldKgPerAcre ?? '—'} kg/acre ({y.harvestDate ?? '—'})
              </li>
            ))}
            {!trends.yieldHistory?.length ? <li className="muted">No yield records yet.</li> : null}
          </ul>
          <h3 className="mt-4">Water readings</h3>
          {(trends.waterReadings ?? []).length ? (
            <MiniTrendChart
              label="Water level (parsed)"
              values={(trends.waterReadings ?? []).map((w) => {
                const n = parseFloat(String(w.value).replace(/[^\d.]/g, ''));
                return Number.isNaN(n) ? 0 : n;
              })}
            />
          ) : null}
          <ul>
            {(trends.waterReadings ?? []).map((w, i) => (
              <li key={i}>
                {w.key}: {w.value} ({w.at})
              </li>
            ))}
          </ul>
          <h3 className="mt-4">Regional risk flags</h3>
          <ul>
            {(trends.regionalRiskFlags ?? []).map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
            {!trends.regionalRiskFlags?.length ? <li className="muted">No active regional threats.</li> : null}
          </ul>
          <h3 className="mt-4">Satellite overlay</h3>
          <ul>
            {(trends.satelliteOverlays ?? []).map((s, i) => (
              <li key={i}>
                NDVI {s.ndvi ?? '—'} · {s.provider} ({s.capturedAt})
              </li>
            ))}
            {!trends.satelliteOverlays?.length ? (
              <li className="muted">No satellite captures yet (stub provider).</li>
            ) : null}
          </ul>
          <h3 className="mt-4">Outcome history</h3>
          <ul>
            {trends.outcomeHistory.map((o, i) => (
              <li key={i}>
                {o.issue} — {o.outcome ?? 'pending'} ({o.at})
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className="visit-detail-list mt-4">
          {apps.map((a) => (
            <li key={String(a.id)}>
              {String(a.product_name)} · {String(a.method)} · {String(a.dose ?? '—')}
              <div className="muted">{String(a.applied_at).slice(0, 10)}</div>
            </li>
          ))}
          {!apps.length ? <li className="muted">No applications for this plot.</li> : null}
        </ul>
      )}
    </PageShell>
  );
}
