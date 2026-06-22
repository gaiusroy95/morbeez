import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CommunicationTimeline } from '../components/intelligence/CommunicationTimeline';
import { PageShell, StatCard, Loading } from '../components/ui';

type Profile = {
  name: string;
  phone: string | null;
  district: string | null;
  village: string | null;
  healthBand: string | null;
  retentionBand: string | null;
  complianceScore: number;
  riskScore: number;
  opportunityScore: number | null;
  purchaseSummary: { orderCount: number; totalValue: number | null };
  timeline: Array<{ at: string; kind: string; summary: string }>;
};

export function Farmer360Page() {
  const { farmerId } = useParams<{ farmerId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!farmerId) return;
    void Promise.all([
      api<{ ok: boolean; profile: Profile }>(`/morbeez-staff/api/v1/os/intelligence/farmers/${farmerId}/360`),
      api<{ ok: boolean; rows: Array<Record<string, unknown>> }>(
        `/morbeez-staff/api/v1/os/farmers/${farmerId}/application-history`
      ),
    ])
      .then(([p, h]) => {
        setProfile(p.profile);
        setApps(h.rows ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [farmerId]);

  if (!profile) return <Loading label="Loading farmer 360…" />;

  return (
    <PageShell title={`Farmer 360 — ${profile.name}`}>
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="agro-ops-stats">
        <StatCard label="Compliance" value={String(profile.complianceScore)} />
        <StatCard label="Risk" value={String(profile.riskScore)} />
        <StatCard label="Opportunity" value={String(profile.opportunityScore ?? '—')} />
        <StatCard label="Orders" value={String(profile.purchaseSummary.orderCount)} />
      </div>
      <p className="muted mt-3">
        {profile.phone} · {profile.district} · {profile.village} · Health {profile.healthBand ?? '—'} · Retention{' '}
        {profile.retentionBand ?? '—'}
      </p>
      <h3 className="mt-4">Communication timeline</h3>
      <CommunicationTimeline entries={profile.timeline} />
      <h3 className="mt-4">Application history</h3>
      <ul className="visit-detail-list">
        {apps.map((a) => (
          <li key={String(a.id)}>
            {String(a.product_name)} · {String(a.method)} · {String(a.dose ?? '—')}
            <div className="muted">{String(a.applied_at).slice(0, 10)}</div>
          </li>
        ))}
        {!apps.length ? <li className="muted">No applications recorded.</li> : null}
      </ul>
    </PageShell>
  );
}
