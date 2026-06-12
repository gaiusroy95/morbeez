import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { BROADCAST_API } from '../../lib/broadcast-api';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, PageShell, Panel } from '../../components/ui';

type Analytics = {
  totals: {
    sent: number;
    failed: number;
    skipped: number;
    delivered: number;
    read: number;
    replied: number;
  };
  byKind: Array<{ kind: string; sent: number; failed: number; skipped: number; total: number }>;
  periodDays: number;
};

export function BroadcastAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState('30');

  useEffect(() => {
    setLoading(true);
    api<{ ok: boolean; analytics: Analytics }>(`${BROADCAST_API}/analytics?days=${days}`)
      .then((d) => setAnalytics(d.analytics))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [days]);

  const t = analytics?.totals;

  return (
    <div>
      <BroadcastSubNav />
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span>Period:</span>
        <select
          className="rounded border border-slate-200 px-2 py-1"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      </div>
      <PageShell loading={loading} error={error || null}>
        {t ? (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ['Sent', t.sent],
                ['Failed', t.failed],
                ['Skipped', t.skipped],
                ['Delivered', t.delivered],
                ['Read', t.read],
                ['Replied', t.replied],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        ) : null}
        <Panel title="By broadcast kind">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Kind</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.byKind ?? []).map((row) => (
                <tr key={row.kind} className="border-t border-slate-100">
                  <td className="py-2">{row.kind}</td>
                  <td>{row.sent}</td>
                  <td>{row.failed}</td>
                  <td>{row.skipped}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </PageShell>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
