import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agronomistClient } from '@morbeez/shared';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Alert, Btn, Loading, StatCard, StaticSelect } from '../../components/ui';
import '../../styles/agronomist-ops.css';

const agroBase = '/morbeez-staff/api/v1/os/agronomist';

type CommandCenter = {
  summary: {
    todaysVisits: number;
    openIssues: number;
    priorityCount: number;
    openEscalations: number;
    pendingFollowUps: number;
    aiReviewCases: number;
  };
  todaysVisits: Array<{
    id: string;
    title: string;
    dueLabel: string;
    farmerName: string;
    blockName: string | null;
    cropName: string | null;
  }>;
  priorityQueue: Array<{
    id: string;
    farmerId: string;
    farmerName: string;
    blockName: string | null;
    cropName: string | null;
    priority: string;
    issueSummary: string | null;
    visitedAt: string | null;
    monitoringRecovery?: { d3: string | null; d7: string | null; d14: string | null };
  }>;
};

export function VisitCommandCenterPage({ canWrite }: { canWrite: boolean }) {
  const [center, setCenter] = useState<CommandCenter | null>(null);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, draftRes] = await Promise.all([
        api<{ ok: boolean; center: CommandCenter }>(`${agroBase}/operations/visit-command-center`),
        agronomistClient.listVisitDrafts(10).catch(() => ({ ok: true, drafts: [] })),
      ]);
      setCenter(data.center);
      setDrafts(draftRes.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load visit command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !center) return <Loading label="Loading visit command center…" />;

  const s = center?.summary;

  return (
    <div className="agro-ops-page">
      <div className="agro-ops-head">
        <div>
          <h1 className="page-title">Visit command center</h1>
          <p className="page-subtitle">
            Today&apos;s visits, priority queue, and open field issues —{' '}
            <Link to={toPath(paths.agronomist)}>Operations</Link>
          </p>
        </div>
        <Btn variant="secondary" onClick={() => void load()}>
          Refresh
        </Btn>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {s ? (
        <div className="agro-ops-stats">
          <StatCard label="Today's visits" value={String(s.todaysVisits)} />
          <StatCard label="Open issues" value={String(s.openIssues)} />
          <StatCard label="Priority queue" value={String(s.priorityCount)} />
          <StatCard label="Open escalations" value={String(s.openEscalations)} />
          <StatCard label="Follow-ups due" value={String(s.pendingFollowUps)} />
          <StatCard label="AI review cases" value={String(s.aiReviewCases)} />
        </div>
      ) : null}

      <section className="agro-ops-panel mt-4">
        <h3>Priority queue</h3>
        <ul className="agro-ops-list">
          {(center?.priorityQueue ?? []).map((row) => (
            <li key={row.id}>
              <strong>{row.farmerName}</strong>
              {row.blockName ? ` · ${row.blockName}` : ''}
              {row.cropName ? ` · ${row.cropName}` : ''}
              {canWrite ? (
                <StaticSelect
                  className="ml-2 inline-block w-auto text-sm"
                  value={row.priority}
                  onChange={(e) => {
                    const priority = e.target.value as 'normal' | 'urgent' | 'emergency';
                    void agronomistClient.updateVisitPriority(row.id, priority).then(() => load());
                  }}
                >
                  <option value="normal">normal</option>
                  <option value="urgent">urgent</option>
                  <option value="emergency">emergency</option>
                </StaticSelect>
              ) : (
                <span className={`priority-badge priority-${row.priority}`}> {row.priority}</span>
              )}
              <div className="muted">{row.issueSummary ?? '—'}</div>
              {row.monitoringRecovery ? (
                <div className="text-xs muted">
                  Recovery: D3 {row.monitoringRecovery.d3 ?? '—'} · D7 {row.monitoringRecovery.d7 ?? '—'} · D14{' '}
                  {row.monitoringRecovery.d14 ?? '—'}
                </div>
              ) : null}
            </li>
          ))}
          {!center?.priorityQueue?.length ? <li className="muted">No urgent or emergency visits.</li> : null}
        </ul>
      </section>

      <section className="agro-ops-panel mt-4">
        <h3>Today&apos;s scheduled visits</h3>
        <ul className="agro-ops-list">
          {(center?.todaysVisits ?? []).map((v) => (
            <li key={v.id}>
              <strong>{v.farmerName}</strong> — {v.title}
              <div className="muted">
                {v.dueLabel}
                {v.blockName ? ` · ${v.blockName}` : ''}
                {v.cropName ? ` · ${v.cropName}` : ''}
              </div>
            </li>
          ))}
          {!center?.todaysVisits?.length ? <li className="muted">No visits scheduled for today.</li> : null}
        </ul>
      </section>

      <section className="agro-ops-panel mt-4">
        <h3>Resume draft visits</h3>
        <ul className="agro-ops-list">
          {drafts.map((d) => {
            const farmer = d.farmers as { name?: string } | null;
            const block = d.farm_blocks as { name?: string; crop_type?: string } | null;
            const farmerId = String(d.farmer_id ?? '');
            const blockId = String(d.block_id ?? '');
            return (
              <li key={String(d.id)}>
                <strong>{farmer?.name ?? 'Farmer'}</strong>
                {block?.name ? ` · ${block.name}` : ''}
                {block?.crop_type ? ` · ${block.crop_type}` : ''}
                <div className="muted">
                  Step: {String(d.current_step ?? 'intakeTriage')} · Updated{' '}
                  {String(d.updated_at ?? '').slice(0, 16).replace('T', ' ')}
                </div>
                {canWrite && farmerId && blockId ? (
                  <Link
                    className="link-btn text-sm"
                    to={toPath(
                      `${paths.agronomistVisit}?farmerId=${farmerId}&blockId=${blockId}&blockName=${encodeURIComponent(block?.name ?? '')}&cropType=${encodeURIComponent(block?.crop_type ?? '')}&farmerName=${encodeURIComponent(farmer?.name ?? '')}`
                    )}
                  >
                    Resume draft
                  </Link>
                ) : null}
              </li>
            );
          })}
          {!drafts.length ? <li className="muted">No in-progress visit drafts.</li> : null}
        </ul>
      </section>

      {canWrite ? (
        <p className="mt-4">
          <Link to={toPath(paths.agronomistVisit)} className="link-btn">
            Start new visit
          </Link>
        </p>
      ) : null}
    </div>
  );
}
