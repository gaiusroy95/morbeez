import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { paths, toPath } from '../lib/routes';
import { PageShell, StatCard } from '../components/ui';

type Cockpit = {
  visits: number;
  recoveryRate: number | null;
  aiAccuracy: number | null;
  escalationRate: number | null;
  protocolSuccess: number | null;
  openEscalations: number;
};

type Regional = { district: string; threatCount: number; severity: string };

export function ExecutiveCockpitPage() {
  const auth = useAuth();
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [regional, setRegional] = useState<Regional[]>([]);

  useEffect(() => {
    const qs = auth?.admin?.email ? `?agentEmail=${encodeURIComponent(auth.admin.email)}` : '';
    void Promise.all([
      api<{ ok: boolean; cockpit: Cockpit }>(`/morbeez-staff/api/v1/os/analytics/executive-cockpit${qs}`),
      api<{ ok: boolean; threats: Regional[] }>('/morbeez-staff/api/v1/os/field/regional-threat-radar?limit=5').catch(
        () => ({ ok: true, threats: [] })
      ),
    ]).then(([c, r]) => {
      setCockpit(c.cockpit);
      setRegional((r as { threats?: Regional[] }).threats ?? []);
    });
  }, [auth?.admin?.email]);

  if (!cockpit) return <PageShell title="Executive cockpit">Loading…</PageShell>;

  return (
    <PageShell title="Executive cockpit">
      <div className="agro-ops-stats">
        <Link to={toPath(paths.agronomistVisitCommand)} className="no-underline">
          <StatCard label="Today's visits" value={String(cockpit.visits)} />
        </Link>
        <Link to={toPath(`${paths.analytics}?tab=maios`)} className="no-underline">
          <StatCard label="D14 recovery %" value={String(cockpit.recoveryRate ?? '—')} />
        </Link>
        <Link to={toPath(`${paths.analytics}?tab=ai_accuracy`)} className="no-underline">
          <StatCard label="AI EQS" value={String(cockpit.aiAccuracy ?? '—')} />
        </Link>
        <Link to={toPath(paths.escalationCommand)} className="no-underline">
          <StatCard label="Escalation rate" value={String(cockpit.escalationRate ?? '—')} />
        </Link>
        <Link to={toPath(paths.agronomistOutcomeIntelligence)} className="no-underline">
          <StatCard label="Protocol success %" value={String(cockpit.protocolSuccess ?? '—')} />
        </Link>
        <Link to={toPath(paths.escalationCommand)} className="no-underline">
          <StatCard label="Open escalations" value={String(cockpit.openEscalations)} />
        </Link>
      </div>
      {regional.length ? (
        <section className="mt-4 rounded border p-4">
          <h3 className="font-semibold mb-2">Regional threats (top districts)</h3>
          <ul>
            {regional.map((t) => (
              <li key={t.district}>
                <Link to={toPath(paths.regionalThreatRadar)}>{t.district}</Link> — {t.threatCount} threats (
                {t.severity})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-4 flex gap-4 flex-wrap">
        <Link to={toPath(paths.analytics)}>Analytics hub</Link>
        <Link to={toPath(paths.escalationCommand)}>Escalation command</Link>
        <Link to={toPath(paths.economicDashboard)}>Economic dashboard</Link>
        <Link to={toPath(paths.regionalThreatRadar)}>Threat radar</Link>
        <Link to={toPath(paths.communicationHub)}>Communication hub</Link>
      </div>
    </PageShell>
  );
}
