import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { Alert, Loading, Panel } from '../ui';
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
    <div className="warehouse-kpi-grid">
      <Panel title="Today">
        <ul className="warehouse-kpi-list">
          <li>
            <span>Sales</span>
            <strong>{formatInr(f.dailySales)}</strong>
          </li>
          <li>
            <span>Orders</span>
            <strong>{f.ordersToday}</strong>
          </li>
          <li>
            <span>GST liability</span>
            <strong>{formatInr(f.gstLiability)}</strong>
          </li>
          <li>
            <span>Pending COD</span>
            <strong>{formatInr(f.pendingCod)}</strong>
          </li>
          <li>
            <span>SKU tracked</span>
            <strong>{data.stockItemCount}</strong>
          </li>
          <li>
            <span>Open NDR/RTO</span>
            <strong>{f.openNdrRto}</strong>
          </li>
        </ul>
      </Panel>
      {data.openExceptions.length > 0 ? (
        <Panel title="Delivery exceptions">
          <ul className="warehouse-exception-list">
            {data.openExceptions.map((ex) => (
              <li key={ex.id}>
                <span className="badge badge-warn">{ex.exception_type}</span>
                {ex.reason ?? 'No reason'}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
