import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { MiniStatCard } from '../employees/employee-ui';
import { Alert, Badge, Loading, Panel } from '../ui';
import { WMS_API } from './warehouse-api';

type Overview = {
  stockItemCount: number;
  finance: {
    dailySales: number;
    gstLiability: number;
    pendingCod: number;
    openNdrRto: number;
    ordersToday: number;
  };
  openExceptions: Array<{ id: string; exception_type: string; reason: string | null }>;
};

export function WarehouseOverviewPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean } & Overview>(`${WMS_API}/overview`)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading warehouse overview…" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const f = data.finance;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MiniStatCard label="Sales today" value={formatInr(f.dailySales)} />
        <MiniStatCard label="Orders today" value={f.ordersToday} />
        <MiniStatCard label="GST liability" value={formatInr(f.gstLiability)} />
        <MiniStatCard label="Pending COD" value={formatInr(f.pendingCod)} />
        <MiniStatCard label="SKU tracked" value={data.stockItemCount} />
        <MiniStatCard label="Open NDR/RTO" value={f.openNdrRto} />
      </div>
      {data.openExceptions.length > 0 ? (
        <Panel title="Delivery exceptions">
          <ul className="space-y-2 text-sm text-ink-secondary">
            {data.openExceptions.map((ex) => (
              <li key={ex.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">{ex.exception_type}</Badge>
                <span>{ex.reason ?? 'No reason'}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
