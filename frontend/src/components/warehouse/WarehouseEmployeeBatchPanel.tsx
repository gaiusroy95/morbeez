import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Alert, Btn, EmptyState, Loading } from '../ui';
import { WMS_API } from './warehouse-api';
import '../../styles/employee-label-batches.css';

type Employee = { id: string; fullName: string; email: string | null; role: string };

type AssignableOrder = {
  id: string;
  orderName: string;
  omsStatus: string;
  courier: string;
  awb: string | null;
  createdAt: string;
};

type LabelBatch = {
  id: string;
  batch_number: string;
  assigned_employee_id: string;
  assigned_employee_name: string;
  batch_status: string;
  total_orders: number;
  printed_at: string | null;
  created_at: string;
};

type StackItem = {
  labelId: string;
  commerceOrderId: string;
  orderName: string;
  printSequence: number;
  qrCode: string;
  awb: string | null;
  labelUrl: string | null;
  courier: string | null;
};

function printUrl(type: string, id: string) {
  return toPath(`${paths.warehouse}/print/${type}/${id}`);
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WarehouseEmployeeBatchPanel({ canWrite }: { canWrite: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<AssignableOrder[]>([]);
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [activeBatchId, setActiveBatchId] = useState('');
  const [stack, setStack] = useState<StackItem[]>([]);
  const [trayNote, setTrayNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  const load = useCallback(async () => {
    setError('');
    const [empRes, orderRes, batchRes] = await Promise.all([
      api<{ ok: boolean; employees: Employee[] }>(`${WMS_API}/fulfillment/employees`),
      api<{ ok: boolean; orders: AssignableOrder[] }>(`${WMS_API}/fulfillment/assignable-orders`),
      api<{ ok: boolean; batches: LabelBatch[] }>(`${WMS_API}/fulfillment/label-batches`),
    ]);
    setEmployees(empRes.employees ?? []);
    setOrders(orderRes.orders ?? []);
    setBatches(batchRes.batches ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  function toggleOrder(id: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignBatch() {
    if (!canWrite || !selectedEmployee) return;
    const orderIds = [...selectedOrderIds];
    if (!orderIds.length) {
      setError('Select at least one order');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await api<{ ok: boolean; batch: LabelBatch }>(`${WMS_API}/fulfillment/assign-batch`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.fullName,
          orderIds,
        }),
      });
      setSuccess(`Batch ${r.batch.batch_number} assigned to ${selectedEmployee.fullName}`);
      setSelectedOrderIds(new Set());
      setActiveBatchId(r.batch.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  async function printBatch(batchId: string) {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await api<{
        ok: boolean;
        stack: StackItem[];
        trayNote: string;
        batch: LabelBatch;
      }>(`${WMS_API}/fulfillment/label-batches/${batchId}/print`, { method: 'POST' });
      setStack(r.stack ?? []);
      setTrayNote(r.trayNote ?? '');
      setActiveBatchId(batchId);
      setSuccess(`Printed ${r.stack?.length ?? 0} labels — place stack in employee tray (top = first order)`);
      await load();
      for (const item of r.stack ?? []) {
        window.open(printUrl('courier_label', item.commerceOrderId), '_blank');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch print failed');
    } finally {
      setBusy(false);
    }
  }

  async function openBatchDetail(batchId: string) {
    setActiveBatchId(batchId);
    setStack([]);
    setTrayNote('');
    try {
      const r = await api<{
        ok: boolean;
        batch: LabelBatch;
        labels: Array<{
          id: string;
          commerce_order_id: string;
          qr_code: string;
          print_sequence: number;
          awb: string | null;
          commerce_orders: { order_name?: string; shopify_order_id?: string } | null;
        }>;
      }>(`${WMS_API}/fulfillment/label-batches/${batchId}`);
      setStack(
        (r.labels ?? []).map((l) => ({
          labelId: String(l.id),
          commerceOrderId: String(l.commerce_order_id),
          orderName:
            l.commerce_orders?.order_name ??
            l.commerce_orders?.shopify_order_id ??
            String(l.commerce_order_id),
          printSequence: Number(l.print_sequence),
          qrCode: String(l.qr_code),
          awb: l.awb,
          labelUrl: null,
          courier: null,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load batch');
    }
  }

  if (loading) return <Loading label="Loading assignment & label batches…" />;

  return (
    <div className="elb-panel">
      <header className="elb-toolbar">
        <div>
          <h2>Assign &amp; print labels</h2>
          <p className="text-sm text-ink-muted">
            Assign orders employee-wise, bulk-print label stacks into separate trays, then pick &amp; pack
            with QR verification.
          </p>
        </div>
        <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void load()}>
          Refresh
        </Btn>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="elb-layout">
        <section className="elb-card">
          <h3>1 — Assign orders to employee</h3>
          <label className="elb-field">
            <span>Employee</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={!canWrite}
            >
              <option value="">Select picker / packer…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.email ? ` (${e.email})` : ''}
                </option>
              ))}
            </select>
          </label>

          {orders.length === 0 ? (
            <EmptyState>No unassigned orders ready for batching.</EmptyState>
          ) : (
            <ul className="elb-order-pick-list">
              {orders.map((o) => (
                <li key={o.id}>
                  <label className="elb-order-pick">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.has(o.id)}
                      disabled={!canWrite || !selectedEmployeeId}
                      onChange={() => toggleOrder(o.id)}
                    />
                    <span className="elb-order-pick-main">
                      <strong>{o.orderName}</strong>
                      <span className="text-sm text-ink-muted">
                        {formatStatus(o.omsStatus)} · {o.courier}
                        {o.awb ? ` · AWB ${o.awb}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {canWrite ? (
            <Btn
              size="sm"
              variant="primary"
              disabled={busy || !selectedEmployeeId || selectedOrderIds.size === 0}
              onClick={() => void assignBatch()}
            >
              {busy
                ? 'Working…'
                : `Create batch (${selectedOrderIds.size} order${selectedOrderIds.size === 1 ? '' : 's'})`}
            </Btn>
          ) : null}
        </section>

        <section className="elb-card">
          <h3>2 — Print employee label batches</h3>
          {batches.length === 0 ? (
            <EmptyState>No label batches yet.</EmptyState>
          ) : (
            <ul className="elb-batch-list">
              {batches.map((b) => (
                <li
                  key={b.id}
                  className={`elb-batch-row${activeBatchId === b.id ? ' elb-batch-row--active' : ''}`}
                >
                  <button type="button" className="elb-batch-meta" onClick={() => void openBatchDetail(b.id)}>
                    <strong>{b.batch_number}</strong>
                    <span>{b.assigned_employee_name}</span>
                    <span className="elb-batch-status">{formatStatus(b.batch_status)}</span>
                    <span className="text-sm text-ink-muted">{b.total_orders} orders</span>
                  </button>
                  {canWrite && b.batch_status !== 'printed' && b.batch_status !== 'completed' ? (
                    <Btn size="sm" variant="primary" disabled={busy} onClick={() => void printBatch(b.id)}>
                      Print stack
                    </Btn>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="elb-card elb-stack-card">
          <h3>Label stack (tray order)</h3>
          {trayNote ? <p className="elb-tray-note">{trayNote}</p> : null}
          {stack.length === 0 ? (
            <EmptyState>Select a batch to preview the label stack.</EmptyState>
          ) : (
            <>
              <p className="text-sm text-ink-muted elb-stack-hint">Top of stack = first order to pick. Bottom = last.</p>
              <ol className="elb-stack">
                {[...stack].reverse().map((item) => (
                  <li key={item.labelId} className="elb-stack-item">
                    <span className="elb-stack-seq">#{item.printSequence}</span>
                    <div>
                      <strong>{item.orderName}</strong>
                      <span className="mono text-sm text-ink-muted">{item.qrCode}</span>
                      {item.awb ? <span className="mono">AWB {item.awb}</span> : null}
                    </div>
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={printUrl('courier_label', item.commerceOrderId)}
                      target="_blank"
                    >
                      Label
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
