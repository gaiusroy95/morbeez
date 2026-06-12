import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBroadcastRules } from '../../lib/broadcast-api';
import { paths, toPath } from '../../lib/routes';
import { AutomationJobsPanel } from './OperationsMessagingExtras';

type AutoJob = {
  id: string;
  job_type: string;
  status: string;
  scheduled_at: string;
  attempts: number;
  last_error: string | null;
  farmerName: string;
  farmerPhone: string | null;
  payload: Record<string, unknown>;
};

export function OperationsAutomationSection({
  subTab,
  canWrite,
  canIntelligence,
  jobs,
  stats,
  jobStatus,
  jobType,
  onJobStatusChange,
  onJobTypeChange,
  onRefresh,
}: {
  subTab: 'campaignRules' | 'weatherAdvisory' | 'jobMonitor';
  canWrite: boolean;
  canIntelligence: boolean;
  jobs: AutoJob[];
  stats: Record<string, number> | null;
  jobStatus: string;
  jobType: string;
  onJobStatusChange: (s: string) => void;
  onJobTypeChange: (t: string) => void;
  onRefresh: () => void;
}) {
  if (subTab === 'campaignRules') {
    return <CampaignRulesPanel canWrite={canWrite} />;
  }
  if (subTab === 'weatherAdvisory') {
    return <WeatherAdvisoryPanel canIntelligence={canIntelligence} />;
  }
  return (
    <AutomationJobsPanel
      jobs={jobs}
      stats={stats}
      canWrite={canWrite}
      statusFilter={jobStatus}
      jobTypeFilter={jobType}
      onStatusChange={onJobStatusChange}
      onJobTypeChange={onJobTypeChange}
      onRefresh={onRefresh}
    />
  );
}

function CampaignRulesPanel({ canWrite }: { canWrite: boolean }) {
  const [activeRules, setActiveRules] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBroadcastRules()
      .then((res) => setActiveRules((res.rules ?? []).filter((r) => r.active).length))
      .catch(() => setActiveRules(0))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Campaign rules</h2>
        <p className="mt-1 text-sm text-slate-600">
          Automatic WhatsApp broadcasts triggered by crop stage (DAP), season, or custom schedules.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <p className="mt-4 text-2xl font-semibold text-emerald-700">
            {activeRules} active rule{activeRules === 1 ? '' : 's'}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to={toPath(paths.broadcastsAutomation)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Manage campaign rules
          </Link>
          <Link
            to={toPath(paths.broadcasts)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Broadcast dashboard
          </Link>
        </div>
        {!canWrite ? (
          <p className="mt-3 text-xs text-slate-500">Read-only — contact operations admin to change rules.</p>
        ) : null}
      </section>
    </div>
  );
}

function WeatherAdvisoryPanel({ canIntelligence }: { canIntelligence: boolean }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Weather & advisory rules</h2>
        <p className="mt-2 text-sm text-slate-600">
          Weather-driven disease boosts, cultivation tasks, and advisory automation are configured in the{' '}
          <strong>Intelligence hub</strong> — the single source of truth for rule definitions.
        </p>
        {canIntelligence ? (
          <Link
            to={`${toPath(paths.intelligence)}?tab=weather`}
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Manage weather rules
          </Link>
        ) : (
          <p className="mt-4 text-sm text-amber-800">
            You need Intelligence hub access to edit rules. Ask an admin if you need to change advisory automation.
          </p>
        )}
        <ul className="mt-4 list-inside list-disc text-sm text-slate-600">
          <li>Monsoon humidity → disease priority adjustments</li>
          <li>Crop-specific weather gates for AI advisory</li>
          <li>Cultivation follow-up and advisory automation toggles (system config in Settings)</li>
        </ul>
      </section>
    </div>
  );
}
