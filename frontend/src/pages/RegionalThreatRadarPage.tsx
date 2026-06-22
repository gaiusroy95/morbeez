import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PageShell } from '../components/ui';

type Threat = {
  id: string;
  district: string;
  cropType: string;
  issueLabel: string;
  threatLevel: string;
  caseCount7d: number;
  trendDirection: string;
  reasoning: string;
};

export function RegionalThreatRadarPage() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void api<{ ok: boolean; threats: Threat[] }>(
      '/morbeez-staff/api/v1/os/field/regional-threat-radar'
    )
      .then((r) => setThreats(r.threats ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  return (
    <PageShell title="Regional threat radar">
      {error ? <p className="text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {threats.map((t) => (
          <li key={t.id} className="rounded border p-3">
            <strong>{t.issueLabel}</strong> — {t.threatLevel.toUpperCase()}
            <div className="text-sm text-slate-600">
              {t.district} · {t.cropType} · {t.caseCount7d} cases (7d) · {t.trendDirection}
            </div>
            <div className="text-sm">{t.reasoning}</div>
          </li>
        ))}
        {!threats.length && !error ? <li className="text-slate-500">No active threats.</li> : null}
      </ul>
    </PageShell>
  );
}
