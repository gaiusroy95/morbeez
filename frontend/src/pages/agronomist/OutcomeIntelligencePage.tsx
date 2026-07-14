import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, PageShell } from '../../components/ui';

type Stat = {
  issueLabel: string;
  protocolLabel: string;
  sampleCount: number;
  recoveryPct: number;
  avgRecoveryDays: number | null;
};

type Funnel = {
  d3: { sent: number; responded: number };
  d7: { sent: number; responded: number };
  d14: { sent: number; responded: number };
};

type VariantRow = {
  variantKey: string;
  sampleCount: number;
  recoveryPct: number;
};

type AdaptiveRow = {
  failureType: string;
  issueLabel: string;
  cropType: string;
  district: string;
  alternateTemplates: Array<{ templateKey: string; label: string; score: number }>;
};

export function OutcomeIntelligencePage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [adaptive, setAdaptive] = useState<AdaptiveRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      api<{ ok: boolean; stats: Stat[] }>('/morbeez-staff/api/v1/os/agronomist/outcome-intelligence'),
      api<{ ok: boolean; funnel: Funnel }>('/morbeez-staff/api/v1/os/analytics/protocol-funnel'),
      api<{ ok: boolean; experiments: Array<{ id: string; experiment_key: string; status: string }> }>(
        '/morbeez-staff/api/v1/os/experiments?status=running'
      ),
      api<{ ok: boolean; suggestions: AdaptiveRow[] }>('/morbeez-staff/api/v1/os/analytics/adaptive-protocols'),
    ])
      .then(async ([s, f, ex, ad]) => {
        setStats(s.stats ?? []);
        setFunnel(f.funnel ?? null);
        setAdaptive(ad.suggestions ?? []);
        const running = ex.experiments?.[0];
        if (running) {
          const detail = await api<{ ok: boolean; variantComparison: VariantRow[] }>(
            `/morbeez-staff/api/v1/os/experiments/${running.id}`
          );
          setVariants(detail.variantComparison ?? []);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  const lowRecovery = stats.filter((s) => s.recoveryPct < 40);

  return (
    <PageShell title="Outcome intelligence">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {funnel ? (
        <section className="mb-6 rounded border p-4">
          <h3 className="font-semibold mb-2">Protocol recovery funnel (90d)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Checkpoint</th>
                <th>Sent</th>
                <th>Responded</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {(['d3', 'd7', 'd14'] as const).map((k) => {
                const row = funnel[k];
                const rate = row.sent ? Math.round((row.responded / row.sent) * 100) : 0;
                return (
                  <tr key={k}>
                    <td>{k.toUpperCase()}</td>
                    <td>{row.sent}</td>
                    <td>{row.responded}</td>
                    <td>{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
      {adaptive.length ? (
        <section className="mb-6 rounded border p-4">
          <h3 className="font-semibold mb-2">Adaptive protocol suggestions (worse outcomes)</h3>
          <ul>
            {adaptive.map((a, i) => (
              <li key={i} className="mb-2">
                <strong>{a.issueLabel}</strong> ({a.failureType}) — {a.cropType} / {a.district}
                <ul className="ml-4 text-sm text-ink-secondary">
                  {a.alternateTemplates.map((t) => (
                    <li key={t.templateKey}>
                      {t.label} — score {Math.round(t.score * 100)}%
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {variants.length ? (
        <section className="mb-6 rounded border p-4">
          <h3 className="font-semibold mb-2">A/B variant recovery</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Cases</th>
                <th>Recovery %</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.variantKey}>
                  <td>{v.variantKey}</td>
                  <td>{v.sampleCount}</td>
                  <td>{v.recoveryPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {lowRecovery.length ? (
        <section className="mb-6 rounded border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold mb-2">Adaptive protocol candidates (low recovery)</h3>
          <ul>
            {lowRecovery.map((s) => (
              <li key={`${s.issueLabel}-${s.protocolLabel}`}>
                {s.issueLabel} / {s.protocolLabel} — consider alternate template in Intelligence Hub
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="space-y-3">
        {stats.map((s) => (
          <li key={`${s.issueLabel}-${s.protocolLabel}`} className="rounded border p-3">
            <strong>{s.issueLabel}</strong> — {s.protocolLabel}
            <div className="text-sm text-ink-secondary">
              Recovery {s.recoveryPct}% · {s.sampleCount} cases
              {s.avgRecoveryDays != null ? ` · ~${s.avgRecoveryDays} days` : ''}
            </div>
          </li>
        ))}
        {!stats.length && !error ? <li className="text-ink-muted">No outcome data yet.</li> : null}
      </ul>
    </PageShell>
  );
}
