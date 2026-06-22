import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { MiniTrendChart } from '../components/intelligence/MiniTrendChart';
import { PageShell, StatCard } from '../components/ui';

export function EconomicDashboardPage() {
  const [variants, setVariants] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void api<{ ok: boolean; variants: typeof variants }>(
      '/morbeez-staff/api/v1/os/analytics/economic-dashboard'
    ).then((r) => setVariants(r.variants ?? []));
  }, []);

  const costs = useMemo(
    () =>
      variants
        .map((v) => Number(v.estimated_cost ?? 0))
        .filter((n) => !Number.isNaN(n) && n > 0)
        .slice(0, 12),
    [variants]
  );

  const totalCost = costs.reduce((a, b) => a + b, 0);

  return (
    <PageShell title="Economic intelligence">
      <div className="agro-ops-stats mb-4">
        <StatCard label="Variants tracked" value={String(variants.length)} />
        <StatCard label="Est. total (sample)" value={totalCost ? `₹${Math.round(totalCost)}` : '—'} />
      </div>
      {costs.length ? (
        <>
          <h3 className="font-semibold mb-2">Cost distribution</h3>
          <MiniTrendChart label="Estimated cost (₹)" values={costs} />
        </>
      ) : null}
      <table className="w-full text-sm mt-4">
        <thead>
          <tr>
            <th>Protocol</th>
            <th>Variant</th>
            <th>Est. cost</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v, i) => (
            <tr key={String(v.id ?? i)}>
              <td>{String(v.protocol_label ?? '—')}</td>
              <td>{String(v.variant_key ?? '—')}</td>
              <td>₹{String(v.estimated_cost ?? '—')}</td>
              <td>{String(v.created_at ?? '').slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
