import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { paths, toPath } from '../../lib/routes';
import { Alert, Badge, Btn, DataTable, EmptyState, Loading, Panel, StaticSelect, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';
import { BarcodeScanInput } from './BarcodeScanInput';

type OmsOrder = {
  id: string;
  shopify_order_id: string;
  order_name: string | null;
  oms_status: string;
  is_cod: boolean;
  total_amount: number;
  created_at: string;
};

type PickList = {
  id: string;
  commerce_order_id: string;
  status: string;
  picker_id: string | null;
  commerce_orders: { order_name: string | null; shopify_order_id: string; oms_status: string };
  pick_list_lines: Array<{
    id: string;
    product_title: string;
    sku: string | null;
    batch_code: string | null;
    rack_location: string | null;
    qty_required: number;
    qty_picked: number;
    manually_verified: boolean;
  }>;
};

type PrintableLink = { type: string; id: string; label: string };

type QuoteQueueRow = {
  id: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  total: number;
  prepaidAmount: number;
  codAmount: number;
  commerceOrderId: string | null;
  queueStatus: 'awaiting_payment' | 'awaiting_warehouse' | 'in_warehouse';
  pickStatus: string | null;
};

function printUrl(type: string, id: string) {
  return toPath(`${paths.warehouse}/print/${type}/${id}`);
}

export function WarehouseOmsPanel({
  canWrite,
  focusOrderId,
}: {
  canWrite: boolean;
  focusOrderId?: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [orders, setOrders] = useState<OmsOrder[]>([]);
  const [quoteQueue, setQuoteQueue] = useState<QuoteQueueRow[]>([]);
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [selectedPick, setSelectedPick] = useState<PickList | null>(null);
  const [printables, setPrintables] = useState<PrintableLink[]>([]);
  const [pickerId, setPickerId] = useState('');
  const [dispatchCode, setDispatchCode] = useState('');
  const [dispatchSessionId, setDispatchSessionId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const autoOpenedPick = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orderParams = statusFilter ? `?omsStatus=${encodeURIComponent(statusFilter)}` : '';
      const [ord, picks, queue] = await Promise.all([
        api<{ ok: boolean; orders: OmsOrder[] }>(`${WMS_API}/orders${orderParams}`),
        api<{ ok: boolean; pickLists: PickList[] }>(`${WMS_API}/pick-lists`),
        api<{ ok: boolean; queue: QuoteQueueRow[] }>(`${WMS_API}/quote-queue`),
      ]);
      setOrders(ord.orders ?? []);
      setPickLists(picks.pickLists ?? []);
      setQuoteQueue(queue.queue ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load OMS');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusOrderId || loading || autoOpenedPick.current) return;
    const pick = pickLists.find((p) => p.commerce_order_id === focusOrderId);
    if (pick) {
      autoOpenedPick.current = true;
      void openPick(pick.id);
    }
  }, [focusOrderId, pickLists, loading]);

  async function openPickByOrder(commerceOrderId: string) {
    const pick = pickLists.find((p) => p.commerce_order_id === commerceOrderId);
    if (pick) await openPick(pick.id);
    else setError('Pick list not found — try Sync on the quote row above');
  }

  async function openPick(id: string) {
    const d = await api<{ ok: boolean; pickList: PickList }>(`${WMS_API}/pick-lists/${id}`);
    setSelectedPick(d.pickList);
    setPickerId(d.pickList.picker_id ?? '');
    const docs = await api<{ ok: boolean; printables: PrintableLink[] }>(
      `${WMS_API}/orders/${d.pickList.commerce_order_id}/documents`
    );
    setPrintables(docs.printables ?? []);
    if (d.pickList.commerce_orders?.oms_status === 'packed') {
      const sess = await api<{ ok: boolean; session: { id: string } }>(
        `${WMS_API}/orders/${d.pickList.commerce_order_id}/dispatch-session`,
        { method: 'POST' }
      ).catch(() => null);
      if (sess?.session?.id) setDispatchSessionId(sess.session.id);
    }
  }

  async function confirmOrder(id: string) {
    try {
      await api(`${WMS_API}/orders/${id}/confirm`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    }
  }

  async function rebuildPickList(pickListId: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const d = await api<{ ok: boolean; pickList: PickList }>(
        `${WMS_API}/pick-lists/${pickListId}/rebuild`,
        { method: 'POST' }
      );
      setSuccess('Pick list rebuilt from warehouse stock');
      await load();
      await openPick(d.pickList.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rebuild pick list');
    } finally {
      setBusy(false);
    }
  }

  async function resyncQuote(quoteId: string) {
    setBusy(true);
    try {
      await api(`${WMS_API}/quotes/${quoteId}/resync`, { method: 'POST' });
      setSuccess('Quote synced to warehouse');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resync failed');
    } finally {
      setBusy(false);
    }
  }

  async function pickLine(lineId: string) {
    if (!selectedPick || !canWrite) return;
    setBusy(true);
    try {
      await api(`${WMS_API}/pick-lists/${selectedPick.id}/lines/${lineId}/pick`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await openPick(selectedPick.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pick failed');
    } finally {
      setBusy(false);
    }
  }

  async function verifyLine(lineId: string) {
    if (!selectedPick || !canWrite) return;
    setBusy(true);
    try {
      await api(`${WMS_API}/pick-lists/${selectedPick.id}/lines/${lineId}/verify`, {
        method: 'POST',
      });
      await openPick(selectedPick.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verify failed');
    } finally {
      setBusy(false);
    }
  }

  async function completePicking() {
    if (!selectedPick || !canWrite) return;
    setBusy(true);
    try {
      await api(`${WMS_API}/pick-lists/${selectedPick.id}/complete-picking`, { method: 'POST' });
      setSuccess('Picking complete — ready for pack');
      await load();
      await openPick(selectedPick.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complete picking failed');
    } finally {
      setBusy(false);
    }
  }

  async function assignPicker() {
    if (!selectedPick || !canWrite || !pickerId.trim()) return;
    setBusy(true);
    try {
      await api(`${WMS_API}/pick-lists/${selectedPick.id}/assign-picker`, {
        method: 'POST',
        body: JSON.stringify({ pickerId: pickerId.trim() }),
      });
      setSuccess('Picker assigned');
      await openPick(selectedPick.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  async function scanDispatch() {
    if (!dispatchSessionId || !dispatchCode.trim() || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; error?: string }>(
        `${WMS_API}/dispatch-sessions/${dispatchSessionId}/scan`,
        { method: 'POST', body: JSON.stringify({ code: dispatchCode.trim() }) }
      );
      if (r.ok) {
        setSuccess('Dispatch verified — order shipped');
        setDispatchCode('');
        await load();
      } else {
        setError(r.error ?? 'Dispatch scan failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function createReturn() {
    if (!selectedPick || !canWrite) return;
    const reason = window.prompt('Return reason?');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await api(`${WMS_API}/orders/${selectedPick.commerce_order_id}/returns`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setSuccess('Return request created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Return request failed');
    } finally {
      setBusy(false);
    }
  }

  const OMS_STATUSES = ['', 'pending', 'confirmed', 'picking', 'packed', 'shipped', 'delivered', 'returned'];

  return (
    <div className="warehouse-oms">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {loading ? <Loading /> : null}

      <Panel title="Quote pipeline">
        {quoteQueue.length === 0 ? (
          <EmptyState>
            No quotes in checkout. Paid quotes and Shopify orders appear below after payment.
          </EmptyState>
        ) : null}
        {quoteQueue.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Pipeline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quoteQueue.map((q) => (
                  <tr key={q.id}>
                    <td className="mono">{q.quoteNumber}</td>
                    <td>{q.customerName}</td>
                    <td>{formatInr(q.total)}</td>
                    <td>
                      {q.queueStatus === 'awaiting_payment' ? (
                        <Badge tone="role">Awaiting payment</Badge>
                      ) : q.queueStatus === 'awaiting_warehouse' ? (
                        <Badge tone="warn">Paid — sync warehouse</Badge>
                      ) : (
                        <Badge tone="active">In warehouse ({q.pickStatus ?? 'picking'})</Badge>
                      )}
                    </td>
                    <td>
                      {q.commerceOrderId ? (
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() => void openPickByOrder(q.commerceOrderId!)}
                        >
                          Open
                        </Btn>
                      ) : null}
                      {canWrite && q.queueStatus === 'awaiting_warehouse' ? (
                        <Btn size="sm" disabled={busy} onClick={() => void resyncQuote(q.id)}>
                          Sync
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
        <p className="warehouse-hint muted">
          Quotes in <strong>Checkout</strong> are waiting for customer payment. After Razorpay payment
          or COD confirmation, a pick list is created automatically.
        </p>
      </Panel>

      <Panel
        title="OMS orders"
        actions={
          <StaticSelect
            className={inputClass}
            value={statusFilter}
            onChange={setStatusFilter}
            options={OMS_STATUSES.map((s) => ({
              value: s,
              label: s || 'All statuses',
            }))}
          />
        }
      >
        {orders.length === 0 ? <EmptyState>No orders in WMS yet.</EmptyState> : null}
        {orders.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className={o.id === focusOrderId ? 'warehouse-row--focus' : undefined}
                  >
                    <td>{o.order_name ?? o.shopify_order_id}</td>
                    <td>
                      <Badge tone="role">{o.oms_status}</Badge>
                    </td>
                    <td>{o.is_cod ? 'COD' : 'Prepaid'}</td>
                    <td>{formatInr(Number(o.total_amount))}</td>
                    <td>
                      {canWrite && o.oms_status === 'pending' ? (
                        <Btn size="sm" onClick={() => void confirmOrder(o.id)}>
                          Confirm → pick list
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
      </Panel>

      <Panel title="Pick lists">
        {pickLists.length === 0 ? <EmptyState>No pick lists.</EmptyState> : null}
        {pickLists.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Pick status</th>
                  <th>Picker</th>
                  <th>Lines</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pickLists.map((p) => (
                  <tr key={p.id}>
                    <td>{p.commerce_orders?.order_name ?? '—'}</td>
                    <td>
                      <Badge tone="active">{p.status}</Badge>
                    </td>
                    <td>{p.picker_id ?? '—'}</td>
                    <td>{p.pick_list_lines?.length ?? 0}</td>
                    <td>
                      <Btn size="sm" variant="secondary" onClick={() => void openPick(p.id)}>
                        Open
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
      </Panel>

      {selectedPick ? (
        <Panel
          title={`Pick list — ${selectedPick.commerce_orders?.order_name ?? ''}`}
          actions={
            <Btn size="sm" variant="secondary" onClick={() => setSelectedPick(null)}>
              Close
            </Btn>
          }
        >
          {!selectedPick.pick_list_lines?.length ? (
            <Alert tone="warn">
              This pick list has <strong>0 lines</strong> because no warehouse stock was reserved when the
              order was confirmed. Common causes: no GRN stock for the order SKUs, SKU mismatch, or order
              lines not synced. Receive stock under <strong>Purchase &amp; GRN</strong>, then rebuild.
              {canWrite ? (
                <>
                  {' '}
                  <Btn
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void rebuildPickList(selectedPick.id)}
                  >
                    Rebuild pick list
                  </Btn>
                </>
              ) : null}
            </Alert>
          ) : null}

          {canWrite ? (
            <div className="warehouse-pick-toolbar">
              <input
                className={inputClass}
                placeholder="Assign picker (email/name)"
                value={pickerId}
                onChange={(e) => setPickerId(e.target.value)}
              />
              <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void assignPicker()}>
                Assign picker
              </Btn>
              <Link
                className="btn btn-secondary btn-sm"
                to={printUrl('picking_slip', selectedPick.id)}
                target="_blank"
              >
                Print picking slip
              </Link>
              {['picked', 'packed', 'verified'].includes(selectedPick.status) ? (
                <Link
                  className="btn btn-secondary btn-sm"
                  to={printUrl('packing_slip', selectedPick.id)}
                  target="_blank"
                >
                  Print packing slip
                </Link>
              ) : null}
              {printables
                .filter((p) => p.type === 'tax_invoice')
                .map((p) => (
                  <Link
                    key={p.id}
                    className="btn btn-secondary btn-sm"
                    to={printUrl('tax_invoice', p.id)}
                    target="_blank"
                  >
                    {p.label}
                  </Link>
                ))}
              <Link
                className="btn btn-secondary btn-sm"
                to={printUrl('courier_label', selectedPick.commerce_order_id)}
                target="_blank"
              >
                Courier label
              </Link>
              <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void createReturn()}>
                Create return
              </Btn>
            </div>
          ) : null}

          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Rack</th>
                  <th>Qty</th>
                  <th>Picked</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {selectedPick.pick_list_lines?.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.product_title}
                      {l.sku ? <span className="muted"> ({l.sku})</span> : null}
                    </td>
                    <td>{l.batch_code ?? '—'}</td>
                    <td className="mono">{l.rack_location ?? '—'}</td>
                    <td>{l.qty_required}</td>
                    <td>{l.manually_verified ? '✓' : l.qty_picked}</td>
                    {canWrite ? (
                      <td className="warehouse-pick-actions">
                        {l.qty_picked < l.qty_required && !l.manually_verified ? (
                          <>
                            <Btn size="sm" disabled={busy} onClick={() => void pickLine(l.id)}>
                              Pick
                            </Btn>
                            <Btn
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void verifyLine(l.id)}
                            >
                              Verify batch
                            </Btn>
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>

          {canWrite && ['picking', 'pending'].includes(selectedPick.status) ? (
            <Btn className="mt-4" disabled={busy} onClick={() => void completePicking()}>
              Complete picking → pack queue
            </Btn>
          ) : null}

          {canWrite && selectedPick.commerce_orders?.oms_status === 'packed' && dispatchSessionId ? (
            <div className="warehouse-scan-block mt-4">
              <BarcodeScanInput
                value={dispatchCode}
                onChange={setDispatchCode}
                onScan={() => void scanDispatch()}
                placeholder="Scan AWB barcode for dispatch"
                disabled={busy}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
