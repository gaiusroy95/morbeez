import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PageShell } from '../../components/ui';

type Stat = {
  issueLabel: string;
  protocolLabel: string;
  sampleCount: number;
  recoveryPct: number;
  avgRecoveryDays: number | null;
};

export function OutcomeIntelligencePage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void api<{ ok: boolean; stats: Stat[] }>('/morbeez-staff/api/v1/os/agronomist/outcome-intelligence')
      .then((r) => setStats(r.stats ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  return (
    <PageShell title="Outcome intelligence">
      {error ? <p className="text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {stats.map((s) => (
          <li key={`${s.issueLabel}-${s.protocolLabel}`} className="rounded border p-3">
            <strong>{s.issueLabel}</strong> — {s.protocolLabel}
            <div className="text-sm text-slate-600">
              Recovery {s.recoveryPct}% · {s.sampleCount} cases
              {s.avgRecoveryDays != null ? ` · ~${s.avgRecoveryDays} days` : ''}
            </div>
          </li>
        ))}
        {!stats.length && !error ? <li className="text-slate-500">No outcome data yet.</li> : null}
      </ul>
    </PageShell>
  );
}
