import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '../../lib/api';
import { Alert, Loading, SearchSelect } from '../ui';
import '../../styles/training-export.css';

const base = '/morbeez-staff/api/v1/os/agronomist';

type DashboardStats = {
  periodDays: number;
  trainingEvents: {
    total: number;
    corrections: number;
    correctionRatePct: number;
    labelAccuracyPct: number;
    qaNeedsReview: number;
  };
  cropImages: {
    total: number;
    pending: number;
    reviewed: number;
    correctionRatePct: number;
  };
  learningSamples: {
    total: number;
    withOutcome: number;
    outcomeCoveragePct: number;
  };
  recommendationOutcomes: {
    total: number;
    successRatePct: number;
    counts: Record<string, number>;
  };
};

type QaFlagRow = {
  entityType: 'training_event' | 'crop_image';
  entityId: string;
  reason: string;
  aiLabel: string | null;
  humanLabel: string | null;
  reviewedAt: string | null;
  qaFlag: string | null;
};

type WeatherAnalytics = {
  snapshotCount: number;
  fieldFindingsAnalyzed: number;
  findingsWeatherCoveragePct: number;
  rainfallBands: Array<{
    key: string;
    label: string;
    findingCount: number;
    diseaseRatePct: number;
  }>;
  postHeavyRain: { visits: number; diseaseRatePct: number; liftVsDryPct: number };
  highHumidity: { visits: number; ratePct: number };
  captureCoverage: {
    trainingEvents: { pct: number };
    cropImages: { pct: number };
    fieldActivities: { pct: number };
  };
  insights: string[];
};

async function downloadExport(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText || 'Export failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function TrainingExportPanel({ canWrite }: { canWrite: boolean }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [flags, setFlags] = useState<QaFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [flagBusy, setFlagBusy] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherAnalytics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, qa, wx] = await Promise.all([
        api<{ ok: boolean; stats: DashboardStats }>(
          `${base}/training-export/dashboard?days=${days}`
        ),
        api<{ ok: boolean; flags: QaFlagRow[] }>(`${base}/training-export/qa-flags?limit=30`),
        api<{ ok: boolean; analytics: WeatherAnalytics }>(
          `${base}/weather-correlation?days=${Math.max(days, 30)}`
        ),
      ]);
      setStats(dash.stats);
      setFlags(qa.flags ?? []);
      setWeather(wx.analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load training export data');
      setStats(null);
      setFlags([]);
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runExport(
    dataset: 'all' | 'events' | 'images' | 'samples' | 'weather',
    format: 'json' | 'csv'
  ) {
    setExporting(`${dataset}-${format}`);
    setError('');
    try {
      const params = new URLSearchParams({
        dataset,
        format,
        limit: '5000',
      });
      const date = new Date().toISOString().slice(0, 10);
      const ext = format === 'json' ? 'json' : 'csv';
      await downloadExport(
        `${base}/training-export?${params}`,
        `morbeez-training-${dataset}-${date}.${ext}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  async function setFlag(row: QaFlagRow, flag: 'needs_review' | 'approved' | 'excluded') {
    if (!canWrite) return;
    setFlagBusy(row.entityId);
    setError('');
    try {
      await api(`${base}/training-export/qa-flag`, {
        method: 'PATCH',
        body: JSON.stringify({
          entityType: row.entityType,
          entityId: row.entityId,
          flag,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update QA flag');
    } finally {
      setFlagBusy(null);
    }
  }

  if (loading && !stats) return <Loading label="Loading training export…" />;

  return (
    <div className="te-page">
      <header className="te-header">
        <div>
          <h2 className="te-title">Training export</h2>
          <p className="te-subtitle">
            Export labeled corrections, crop images, and outcome samples for model training and QA.
          </p>
        </div>
        <SearchSelect
          label="Period"
          className="te-period"
          value={String(days)}
          onChange={(value) => setDays(Number(value))}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
            { value: '180', label: '180 days' },
          ]}
        />
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {stats ? (
        <div className="te-kpi-grid">
          <article className="te-kpi">
            <span className="te-kpi-label">Training events</span>
            <strong>{stats.trainingEvents.total}</strong>
            <em>{stats.trainingEvents.correctionRatePct}% corrected</em>
          </article>
          <article className="te-kpi">
            <span className="te-kpi-label">Label accuracy</span>
            <strong>{stats.trainingEvents.labelAccuracyPct}%</strong>
            <em>AI vs human final label</em>
          </article>
          <article className="te-kpi">
            <span className="te-kpi-label">Crop images</span>
            <strong>{stats.cropImages.pending} pending</strong>
            <em>{stats.cropImages.correctionRatePct}% image corrections</em>
          </article>
          <article className="te-kpi">
            <span className="te-kpi-label">Outcome success</span>
            <strong>{stats.recommendationOutcomes.successRatePct}%</strong>
            <em>
              {stats.recommendationOutcomes.counts.better ?? 0} better ·{' '}
              {stats.recommendationOutcomes.counts.partial ?? 0} partial
            </em>
          </article>
          <article className="te-kpi">
            <span className="te-kpi-label">Learning samples</span>
            <strong>{stats.learningSamples.total}</strong>
            <em>{stats.learningSamples.outcomeCoveragePct}% with outcome</em>
          </article>
          <article className="te-kpi te-kpi--warn">
            <span className="te-kpi-label">QA queue</span>
            <strong>{stats.trainingEvents.qaNeedsReview + flags.length}</strong>
            <em>Flagged + auto-detected mismatches</em>
          </article>
        </div>
      ) : null}

      <section className="te-export-section">
        <h3>Download datasets</h3>
        <div className="te-export-actions">
          <button
            type="button"
            className="te-btn te-btn--primary"
            disabled={!!exporting}
            onClick={() => void runExport('all', 'json')}
          >
            {exporting === 'all-json' ? 'Exporting…' : 'Export all (JSON)'}
          </button>
          {(['events', 'images', 'samples', 'weather'] as const).map((ds) => (
            <button
              key={ds}
              type="button"
              className="te-btn"
              disabled={!!exporting}
              onClick={() => void runExport(ds, 'csv')}
            >
              {exporting === `${ds}-csv` ? '…' : `CSV: ${ds}`}
            </button>
          ))}
        </div>
        <p className="te-export-hint">
          JSON includes events, images, samples, and weather snapshots. CSV is one dataset at a time (max
          5,000 rows). All exports include rainfall, humidity, and risk columns where linked.
        </p>
      </section>

      {weather ? (
        <section className="te-weather-section">
          <h3>Weather correlation</h3>
          <p className="te-qa-desc">
            {weather.snapshotCount} snapshots · {weather.findingsWeatherCoveragePct}% of field findings
            linked to weather · {weather.fieldFindingsAnalyzed} findings analyzed
          </p>
          <div className="te-weather-kpis">
            <div className="te-weather-kpi">
              <span>After heavy rain</span>
              <strong>{weather.postHeavyRain.diseaseRatePct}%</strong>
              <em>disease/pest rate (+{weather.postHeavyRain.liftVsDryPct}% vs dry)</em>
            </div>
            <div className="te-weather-kpi">
              <span>High humidity (≥80%)</span>
              <strong>{weather.highHumidity.ratePct}%</strong>
              <em>visits with disease signals</em>
            </div>
            <div className="te-weather-kpi">
              <span>Event weather capture</span>
              <strong>{weather.captureCoverage.trainingEvents.pct}%</strong>
              <em>training events</em>
            </div>
          </div>
          {weather.rainfallBands.some((b) => b.findingCount > 0) ? (
            <table className="te-weather-table">
              <thead>
                <tr>
                  <th>Rainfall band</th>
                  <th>Visits</th>
                  <th>Disease/pest rate</th>
                </tr>
              </thead>
              <tbody>
                {weather.rainfallBands.map((b) => (
                  <tr key={b.key}>
                    <td>{b.label}</td>
                    <td>{b.findingCount}</td>
                    <td>{b.findingCount > 0 ? `${b.diseaseRatePct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {weather.insights.length > 0 ? (
            <ul className="te-weather-insights">
              {weather.insights.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="te-qa-section">
        <h3>Label QA flags</h3>
        <p className="te-qa-desc">
          Mismatched AI vs human labels, missing final labels, and pending image reviews.
        </p>
        {flags.length === 0 ? (
          <p className="te-empty">No QA issues detected in the latest review window.</p>
        ) : (
          <div className="te-qa-table-wrap">
            <table className="te-qa-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>AI label</th>
                  <th>Human label</th>
                  <th>When</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {flags.map((row) => (
                  <tr key={`${row.entityType}-${row.entityId}`}>
                    <td>{row.entityType === 'training_event' ? 'Event' : 'Image'}</td>
                    <td>{row.reason}</td>
                    <td className="te-qa-label">{row.aiLabel ?? '—'}</td>
                    <td className="te-qa-label">{row.humanLabel ?? '—'}</td>
                    <td className="te-qa-date">
                      {row.reviewedAt ? new Date(row.reviewedAt).toLocaleDateString() : '—'}
                    </td>
                    {canWrite ? (
                      <td className="te-qa-actions">
                        <button
                          type="button"
                          className="te-qa-btn"
                          disabled={flagBusy === row.entityId}
                          onClick={() => void setFlag(row, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="te-qa-btn te-qa-btn--muted"
                          disabled={flagBusy === row.entityId}
                          onClick={() => void setFlag(row, 'needs_review')}
                        >
                          Flag
                        </button>
                        <button
                          type="button"
                          className="te-qa-btn te-qa-btn--danger"
                          disabled={flagBusy === row.entityId}
                          onClick={() => void setFlag(row, 'excluded')}
                        >
                          Exclude
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
