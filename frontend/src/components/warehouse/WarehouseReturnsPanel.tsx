import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { formatInr } from '../../lib/format';
import { Alert, Badge, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';

type ReturnRow = {
  id: string;
  return_number: string;
  status: string;
  reason: string;
  refund_type: string | null;
  refund_amount: number | null;
  commerce_orders: { order_name: string | null; phone: string | null; total_amount: number };
};

export function WarehouseReturnsPanel({ canWrite }: { canWrite: boolean }) {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [selected, setSelected] = useState<ReturnRow | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const d = await api<{ ok: boolean; returns: ReturnRow[] }>(`${WMS_API}/returns${params}`);
      setReturns(d.returns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, body?: Record<string, unknown>) {
    if (!selected || !canWrite) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`${WMS_API}/returns/${selected.id}${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setSuccess('Updated');
      await load();
      const refreshed = returns.find((r) => r.id === selected.id);
      if (refreshed) setSelected(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading returns…" />;

  return (
    <div className="warehouse-returns">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Panel
        title="Return & refund requests"
        actions={
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="requested">Requested</option>
            <option value="verification_pending">Verification pending</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="inspected">Inspected</option>
            <option value="refund_completed">Refund completed</option>
            <option value="rejected">Rejected</option>
          </select>
        }
      >
        {returns.length === 0 ? <EmptyState>No return requests.</EmptyState> : null}
        {returns.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Order</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Refund</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.return_number}</td>
                    <td>{r.commerce_orders?.order_name ?? '—'}</td>
                    <td>{r.reason}</td>
                    <td>
                      <Badge tone="role">{r.status}</Badge>
                    </td>
                    <td>
                      {r.refund_type
                        ? `${r.refund_type}${r.refund_amount != null ? ` ${formatInr(r.refund_amount)}` : ''}`
                        : '—'}
                    </td>
                    <td>
                      <Btn size="sm" variant="secondary" onClick={() => setSelected(r)}>
                        Manage
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
      </Panel>

      {selected ? (
        <Panel
          title={`Return ${selected.return_number}`}
          actions={
            <Btn size="sm" variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Btn>
          }
        >
          <p className="muted">
            Order: {selected.commerce_orders?.order_name} · Phone:{' '}
            {selected.commerce_orders?.phone ?? '—'}
          </p>

          <div className="warehouse-return-actions">
            {canWrite && selected.status === 'requested' ? (
              <Btn size="sm" disabled={busy} onClick={() => void act('/verify-call')}>
                Schedule verification call
              </Btn>
            ) : null}
            {canWrite && ['requested', 'verification_pending'].includes(selected.status) ? (
              <>
                <Btn
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act('/approve', {
                      refundType: 'full',
                    })
                  }
                >
                  Approve full refund
                </Btn>
                <Btn
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void act('/reject', { reason: 'Return not eligible' })}
                >
                  Reject
                </Btn>
              </>
            ) : null}
            {canWrite && selected.status === 'approved' ? (
              <Btn size="sm" disabled={busy} onClick={() => void act('/received')}>
                Mark received
              </Btn>
            ) : null}
            {canWrite && selected.status === 'received' ? (
              <>
                <Btn
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act('/inspect', {
                      productCondition: 'resalable',
                      stockAction: 'resalable',
                    })
                  }
                >
                  Inspect → resalable
                </Btn>
                <Btn
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void act('/inspect', {
                      productCondition: 'damaged',
                      stockAction: 'damaged',
                    })
                  }
                >
                  Inspect → damaged
                </Btn>
                <Btn
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void act('/inspect', {
                      productCondition: 'quarantine',
                      stockAction: 'quarantine',
                    })
                  }
                >
                  Inspect → quarantine
                </Btn>
              </>
            ) : null}
            {canWrite && selected.status === 'inspected' ? (
              <Btn size="sm" disabled={busy} onClick={() => void act('/refund')}>
                Process refund
              </Btn>
            ) : null}
            <Link
              className="btn btn-secondary btn-sm"
              to={toPath(`${paths.warehouse}/print/return_inspection/${selected.id}`)}
              target="_blank"
            >
              Print inspection sheet
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
