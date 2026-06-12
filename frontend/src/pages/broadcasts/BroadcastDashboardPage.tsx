import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BROADCAST_API,
  fetchBroadcastAnalytics,
  fetchBroadcastDashboard,
  fetchBroadcastRules,
  type BroadcastCampaign,
} from '../../lib/broadcast-api';
import { paths, toPath } from '../../lib/routes';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, PageShell, Panel, ReadOnlyBanner } from '../../components/ui';
import { StatIcon } from '../../components/NavIcon';

export function BroadcastDashboardPage({ canWrite }: { canWrite: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sentToday, setSentToday] = useState(0);
  const [failureRate, setFailureRate] = useState(0);
  const [activeRules, setActiveRules] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState<BroadcastCampaign[]>([]);
  const [scheduled, setScheduled] = useState<BroadcastCampaign[]>([]);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([fetchBroadcastAnalytics(30), fetchBroadcastRules(), fetchBroadcastDashboard()])
      .then(([analyticsRes, rulesRes, dash]) => {
        const t = analyticsRes.analytics?.totals;
        const sent = t?.sent ?? 0;
        const failed = t?.failed ?? 0;
        const total = sent + failed + (t?.skipped ?? 0);
        setSentToday(sent);
        setFailureRate(total > 0 ? failed / total : 0);
        setActiveRules((rulesRes.rules ?? []).filter((r) => r.active).length);
        setRecentCampaigns(dash.recentCampaigns ?? []);
        setScheduled(dash.scheduledCampaigns ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="muted" style={{ marginBottom: 8 }}>
        WhatsApp broadcast campaigns, automation rules, and delivery tracking
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      <BroadcastSubNav />
      <PageShell loading={loading} error={error || null} loadingLabel="Loading broadcast hub…">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Broadcasts (period)" value={String(sentToday)} icon="analytics" />
          <KpiCard label="Failure rate" value={`${(failureRate * 100).toFixed(1)}%`} icon="analytics" />
          <KpiCard label="Active automation rules" value={String(activeRules)} icon="operations" />
          <KpiCard label="Scheduled campaigns" value={String(scheduled.length)} icon="operations" />
        </div>

        {canWrite ? (
          <Panel title="Quick actions">
            <div className="flex flex-wrap gap-3">
              <Link
                to={toPath(paths.broadcastsNew)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Create broadcast
              </Link>
              <Link
                to={toPath(paths.broadcastsAutomation)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Run automation
              </Link>
              <Link
                to={toPath(paths.broadcastsTemplates)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Template library
              </Link>
              <a
                href={`${BROADCAST_API}/deliveries/export`}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Export deliveries CSV
              </a>
            </div>
          </Panel>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Recent campaigns">
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-slate-500">No campaigns yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {recentCampaigns.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <span>
                      <strong>{c.name}</strong>
                      <span className="ml-2 capitalize text-slate-500">{c.status}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.updatedAt).toLocaleDateString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Upcoming scheduled">
            {scheduled.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {scheduled.map((c) => (
                  <li key={c.id} className="py-2">
                    <strong>{c.name}</strong>
                    <span className="block text-xs text-slate-500">
                      {c.scheduledAt
                        ? new Date(c.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </PageShell>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
        <StatIcon name={icon} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
