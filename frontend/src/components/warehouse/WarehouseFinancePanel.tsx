import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, SearchSelect, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';

type Dashboard = {
  dailySales: number;
  gstLiability: number;
  pendingCod: number;
  refunds: number;
  outstandingPayments: number;
  openNdrRto: number;
};

type CodRow = {
  id: string;
  commerce_order_id: string;
  cod_amount: number;
  courier_remittance: number | null;
  remittance_status: string;
  commerce_orders: { order_name: string | null };
};

type ExceptionRow = {
  id: string;
  exception_type: string;
  reason: string | null;
  status: string;
  shopify_order_id: string;
};

export function WarehouseFinancePanel({ canWrite }: { canWrite: boolean }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [codRows, setCodRows] = useState<CodRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [remitId, setRemitId] = useState('');
  const [remitAmount, setRemitAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fin, cod, ex] = await Promise.all([
        api<{ ok: boolean; dashboard: Dashboard }>(`${WMS_API}/finance/dashboard`),
        api<{ ok: boolean; rows: CodRow[] }>(`${WMS_API}/cod/pending`),
        api<{ ok: boolean; exceptions: ExceptionRow[] }>(`${WMS_API}/exceptions`),
      ]);
      setDashboard(fin.dashboard);
      setCodRows(cod.rows ?? []);
      setExceptions(ex.exceptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load finance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRemittance() {
    if (!remitId || !remitAmount) return;
    await api(`${WMS_API}/cod/${remitId}/remittance`, {
      method: 'POST',
      body: JSON.stringify({ courierRemittance: Number(remitAmount) }),
    });
    setRemitId('');
    setRemitAmount('');
    await load();
  }

  async function resolveException(id: string, action: string) {
    await api(`${WMS_API}/exceptions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, qcStatus: action === 'restocked' ? 'pass' : undefined }),
    });
    await load();
  }

  if (loading) return <Loading label="Loading finance…" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="warehouse-finance">
      {dashboard ? (
        <div className="warehouse-kpi-grid">
          <Panel title="Finance dashboard">
            <ul className="warehouse-kpi-list">
              <li>
                <span>Daily sales</span>
                <strong>{formatInr(dashboard.dailySales)}</strong>
              </li>
              <li>
                <span>GST liability</span>
                <strong>{formatInr(dashboard.gstLiability)}</strong>
              </li>
              <li>
                <span>Pending COD</span>
                <strong>{formatInr(dashboard.pendingCod)}</strong>
              </li>
              <li>
                <span>Outstanding</span>
                <strong>{formatInr(dashboard.outstandingPayments)}</strong>
              </li>
            </ul>
          </Panel>
        </div>
      ) : null}

      <Panel title="COD reconciliation">
        {codRows.length === 0 ? <EmptyState>No pending COD remittance.</EmptyState> : null}
        {codRows.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>COD</th>
                  <th>Remitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {codRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.commerce_orders?.order_name ?? r.commerce_order_id}</td>
                    <td>{formatInr(Number(r.cod_amount))}</td>
                    <td>{r.courier_remittance != null ? formatInr(Number(r.courier_remittance)) : '—'}</td>
                    <td>{r.remittance_status}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
        {canWrite && codRows.length > 0 ? (
          <div className="warehouse-form-row mt-4">
            <SearchSelect
              className={inputClass}
              value={remitId}
              onChange={setRemitId}
              options={[
                { value: '', label: 'Order…' },
                ...codRows.map((r) => ({
                  value: r.commerce_order_id,
                  label: r.commerce_orders?.order_name ?? r.commerce_order_id,
                })),
              ]}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Courier paid ₹"
              value={remitAmount}
              onChange={(e) => setRemitAmount(e.target.value)}
            />
            <Btn size="sm" onClick={() => void saveRemittance()}>
              Record remittance
            </Btn>
          </div>
        ) : null}
      </Panel>

      <Panel title="NDR / RTO">
        {exceptions.length === 0 ? <EmptyState>No open delivery exceptions.</EmptyState> : null}
        {exceptions.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Order</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {exceptions.map((ex) => (
                  <tr key={ex.id}>
                    <td>{ex.exception_type}</td>
                    <td>{ex.shopify_order_id}</td>
                    <td>{ex.reason ?? '—'}</td>
                    <td>{ex.status}</td>
                    {canWrite ? (
                      <td className="flex gap-1">
                        <Btn size="sm" variant="secondary" onClick={() => void resolveException(ex.id, 'reattempt')}>
                          Reattempt
                        </Btn>
                        <Btn size="sm" onClick={() => void resolveException(ex.id, 'restocked')}>
                          RTO restock
                        </Btn>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
      </Panel>
    </div>
  );
}
