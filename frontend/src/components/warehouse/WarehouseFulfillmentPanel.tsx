import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { paths, toPath } from '../../lib/routes';
import { Alert, Badge, Btn, EmptyState, Loading, Panel } from '../ui';
import { WMS_API } from './warehouse-api';
import { BarcodeScanInput } from './BarcodeScanInput';

type Stats = {
  pendingOrders: number;
  readyToPack: number;
  packedToday: number;
  courierPending: number;
  failedAwb: number;
};

type QueueRow = {
  id: string;
  orderName: string;
  customerName?: string | null;
  courier: string;
  itemCount: number;
  orderItemCount?: number;
  stockIssue?: 'no_order_lines' | 'no_stock_reserved' | null;
  missingProducts?: string[];
  priority: string;
  omsStatus: string;
  awb: string | null;
  pickListId: string | null;
  shiprocketError: string | null;
  isCod?: boolean;
  totalAmount?: number;
};

type RackLine = {
  row: number;
  id: string;
  productTitle: string;
  sku: string | null;
  batchCode: string | null;
  qtyRequired: number;
  qtyPicked: number;
  remaining: number;
  complete: boolean;
};

type RackProgress = {
  rack: string;
  lineCount: number;
  totalQty: number;
  pickedQty: number;
  complete: boolean;
  active: boolean;
};

type Workflow = {
  stage: 'picking' | 'print';
  step: number;
  currentRack: string | null;
  racks: RackProgress[];
  currentRackLines: RackLine[];
  printEnabled: boolean;
};

type PickLookup = {
  lineId: string;
  productTitle: string;
  sku: string | null;
  batchCode: string | null;
  qtyRequired: number;
  qtyPicked: number;
  remaining: number;
  defaultQty: number;
};

type ShiprocketDiagnostics = {
  walletBalanceInr: number | null;
  pickupLocationConfigured: string;
  pickupLocationsAvailable: string[];
  apiUserEmail: string | null;
};

type OrderDetail = {
  shiprocketDiagnostics?: ShiprocketDiagnostics | null;
  shiprocketErrorDisplay?: string | null;
  order: {
    id: string;
    order_name: string | null;
    oms_status: string;
    courier_name: string | null;
    tracking_awb: string | null;
    label_url: string | null;
    dispatch_rack: string | null;
    shiprocket_error: string | null;
  };
  pickList: { id: string } | null;
  packSession: { id: string } | null;
  invoice: { id: string; invoice_number: string } | null;
  suggestedDispatchRack: string | null;
  printEnabled: boolean;
  workflow: Workflow | null;
  customerSummary?: {
    phone: string | null;
    address: string | null;
    isCod: boolean;
    totalAmount: number;
  };
};

const STEPS = ['Pick', 'Verify', 'Print', 'Packed'] as const;

const EXCEPTIONS = [
  { type: 'stock_missing', label: 'Stock missing' },
  { type: 'wrong_barcode', label: 'Wrong barcode' },
  { type: 'reprint_label', label: 'Reprint label' },
  { type: 'courier_failed', label: 'Courier failed' },
  { type: 'weight_mismatch', label: 'Weight mismatch' },
] as const;

function printUrl(type: string, id: string) {
  return toPath(`${paths.warehouse}/print/${type}/${id}`);
}

function priorityBadge(p: string) {
  if (p === 'high') return <Badge tone="warn">High</Badge>;
  if (p === 'low') return <Badge tone="muted">Low</Badge>;
  return null;
}

function PickConfirmModal({
  lookup,
  onClose,
  onConfirm,
  busy,
}: {
  lookup: PickLookup;
  onClose: () => void;
  onConfirm: (qty: number) => void;
  busy: boolean;
}) {
  const [qty, setQty] = useState(lookup.defaultQty);

  useEffect(() => {
    setQty(lookup.defaultQty);
  }, [lookup]);

  return (
    <div className="ff-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ff-modal">
        <h3 className="ff-modal-title">{lookup.productTitle}</h3>
        {lookup.sku ? <p className="muted">SKU: {lookup.sku}</p> : null}
        <div className="ff-modal-stats">
          <div>
            <span>Required</span>
            <strong>{lookup.qtyRequired}</strong>
          </div>
          <div>
            <span>Picked</span>
            <strong>{lookup.qtyPicked}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>{lookup.remaining}</strong>
          </div>
        </div>
        <div className="ff-qty-controls">
          <Btn
            size="sm"
            variant="secondary"
            disabled={qty <= 1 || busy}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </Btn>
          <input
            className="ff-qty-input"
            type="number"
            min={1}
            max={lookup.remaining}
            value={qty}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setQty(Math.min(lookup.remaining, Math.max(1, n)));
            }}
          />
          <Btn
            size="sm"
            variant="secondary"
            disabled={qty >= lookup.remaining || busy}
            onClick={() => setQty((q) => Math.min(lookup.remaining, q + 1))}
          >
            +
          </Btn>
        </div>
        <div className="ff-modal-actions">
          <Btn size="sm" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Btn>
          <Btn size="sm" variant="primary" disabled={busy} onClick={() => onConfirm(qty)}>
            {busy ? 'Saving…' : 'Confirm pick'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function WarehouseFulfillmentPanel({
  canWrite,
  focusOrderId,
}: {
  canWrite: boolean;
  focusOrderId?: string | null;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [pickLookup, setPickLookup] = useState<PickLookup | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const autoOpened = useRef(false);

  const loadQueue = useCallback(async () => {
    const [s, q] = await Promise.all([
      api<{ ok: boolean; stats: Stats }>(`${WMS_API}/fulfillment/stats`),
      api<{ ok: boolean; queue: QueueRow[] }>(`${WMS_API}/fulfillment/queue?repair=true`),
    ]);
    setStats(s.stats);
    setQueue(q.queue ?? []);
  }, []);

  async function syncInventoryAndRepair() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await api<{
        ok: boolean;
        syncedQty?: number;
        repaired?: number;
        failed?: number;
        errors?: Array<{ orderId: string; orderName?: string; message: string }>;
        queue: QueueRow[];
      }>(`${WMS_API}/fulfillment/sync-inventory`, { method: 'POST' });
      setQueue(r.queue ?? []);
      const parts: string[] = [];
      if (r.syncedQty) parts.push(`${r.syncedQty} units synced to warehouse`);
      if (r.repaired) parts.push(`${r.repaired} pick lists rebuilt`);
      if (r.failed) parts.push(`${r.failed} orders still blocked`);
      if (parts.length) setSuccess(parts.join(' · '));
      if (r.errors?.length) {
        setError(
          r.errors
            .slice(0, 4)
            .map((e) => `${e.orderName ?? e.orderId.slice(0, 8)}: ${e.message}`)
            .join(' — ')
        );
      } else if (!parts.length) {
        setSuccess('Sync finished — select an order to verify pick lines');
      }
      if (selectedId) {
        await loadDetail(selectedId, true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  const loadDetail = useCallback(
    async (orderId: string, startSession = false) => {
      setSelectedId(orderId);
      setScanMsg('');
      setSuccess('');
      setPickLookup(null);
      setError('');
      try {
        const d = await api<{ ok: boolean } & OrderDetail>(`${WMS_API}/fulfillment/orders/${orderId}`);
        setDetail(d);

        if (d.packSession?.id) {
          setSessionId(d.packSession.id);
        } else if (canWrite && startSession && d.pickList) {
          try {
            const sess = await api<{ ok: boolean; session: { id: string } }>(
              `${WMS_API}/fulfillment/orders/${orderId}/pack-session`,
              { method: 'POST' }
            );
            setSessionId(sess.session.id);
            const refreshed = await api<{ ok: boolean } & OrderDetail>(
              `${WMS_API}/fulfillment/orders/${orderId}`
            );
            setDetail(refreshed);
          } catch (e) {
            setSessionId('');
            setError(e instanceof Error ? e.message : 'Could not start pick session');
          }
        } else {
          setSessionId('');
        }
      } catch (e) {
        setDetail(null);
        setSessionId('');
        setError(e instanceof Error ? e.message : 'Failed to load order');
      }
    },
    [canWrite]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fulfillment');
    } finally {
      setLoading(false);
    }
  }, [loadQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusOrderId || loading || selectedId || autoOpened.current) return;
    autoOpened.current = true;
    void loadDetail(focusOrderId, true);
  }, [focusOrderId, loading, selectedId, loadDetail]);

  async function lookupBarcode(code: string) {
    if (!sessionId || !code.trim()) return;
    setScanMsg('');
    setError('');
    const r = await api<{ ok: boolean; error?: string } & Partial<PickLookup>>(
      `${WMS_API}/fulfillment/pack-sessions/${sessionId}/lookup-barcode`,
      { method: 'POST', body: JSON.stringify({ code: code.trim() }) }
    );
    if (r.ok && r.lineId) {
      setPickLookup({
        lineId: r.lineId,
        productTitle: r.productTitle ?? code,
        sku: r.sku ?? null,
        batchCode: r.batchCode ?? null,
        qtyRequired: r.qtyRequired ?? 1,
        qtyPicked: r.qtyPicked ?? 0,
        remaining: r.remaining ?? 1,
        defaultQty: r.defaultQty ?? 1,
      });
      setScanOpen(false);
      setScanCode('');
    } else {
      setScanMsg(r.error ?? 'Scan failed');
    }
  }

  async function confirmPick(qty: number) {
    if (!sessionId || !pickLookup) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; message?: string; stage?: string }>(
        `${WMS_API}/fulfillment/pack-sessions/${sessionId}/confirm-pick`,
        {
          method: 'POST',
          body: JSON.stringify({ lineId: pickLookup.lineId, qty }),
        }
      );
      setPickLookup(null);
      setSuccess(r.message ?? 'Picked');
      if (selectedId) await loadDetail(selectedId);
      if (r.stage === 'print') {
        setSuccess('All racks complete — print label & invoice');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm pick failed');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(path: string, okMsg: string, body?: Record<string, unknown>) {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setSuccess(okMsg);
      await loadDetail(selectedId);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const workflow = detail?.workflow;
  const order = detail?.order;
  const printStage = workflow?.stage === 'print' || detail?.printEnabled;
  const activeStep = printStage ? 3 : workflow?.step ?? 1;
  const selectedQueue = queue.find((r) => r.id === selectedId);
  const customer = detail?.customerSummary;

  function formatItems(row: QueueRow) {
    const ordered = row.orderItemCount ?? 0;
    if (row.itemCount === 0 && ordered > 0) return `0 / ${ordered}`;
    return String(row.itemCount);
  }

  if (loading && !stats) return <Loading label="Loading fulfillment…" />;

  return (
    <div className="warehouse-fulfillment">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      {canWrite ? (
        <div className="fulfillment-sync-row">
          <p className="muted fulfillment-sync-hint">
            <strong>0 / N</strong> means warehouse stock is not reserved for that order&apos;s products. Use the button
            below to sync Commerce inventory and rebuild pick lists. Orders for products with no stock will show an error.
          </p>
          <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void syncInventoryAndRepair()}>
            Sync inventory &amp; rebuild picks
          </Btn>
        </div>
      ) : null}

      {stats ? (
        <div className="fulfillment-kpi-row">
          <div className="fulfillment-kpi">
            <span>Pending orders</span>
            <strong>{stats.pendingOrders}</strong>
          </div>
          <div className="fulfillment-kpi">
            <span>Ready to pack</span>
            <strong>{stats.readyToPack}</strong>
          </div>
          <div className="fulfillment-kpi">
            <span>Packed today</span>
            <strong>{stats.packedToday}</strong>
          </div>
          <div className="fulfillment-kpi">
            <span>Courier pending</span>
            <strong>{stats.courierPending}</strong>
          </div>
          <div className="fulfillment-kpi fulfillment-kpi--warn">
            <span>Failed AWB</span>
            <strong>{stats.failedAwb}</strong>
          </div>
        </div>
      ) : null}

      <div className="fulfillment-layout">
        {/* LEFT — Order queue */}
        <Panel title="Order queue" className="fulfillment-col fulfillment-col--queue">
          {queue.length === 0 ? <EmptyState>No orders in fulfillment.</EmptyState> : null}
          <ul className="ff-order-list">
            {queue.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`ff-order-card${selectedId === row.id ? ' ff-order-card--active' : ''}`}
                  onClick={() => void loadDetail(row.id, true)}
                >
                  <div className="ff-order-card-top">
                    <span className="ff-order-id mono">{row.orderName}</span>
                    {priorityBadge(row.priority)}
                    {row.shiprocketError ? <span className="fulfillment-err-hint" title={row.shiprocketError}>⚠</span> : null}
                  </div>
                  {row.customerName ? <span className="ff-order-customer">{row.customerName}</span> : null}
                  <div className="ff-order-card-meta">
                    <span>{formatItems(row)} items</span>
                    {row.totalAmount != null ? <span>{formatInr(row.totalAmount)}</span> : null}
                    <span>{row.courier}</span>
                  </div>
                  {row.stockIssue === 'no_stock_reserved' && row.missingProducts?.length ? (
                    <span className="ff-order-stock-hint muted">
                      No stock: {row.missingProducts.join(', ')}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* CENTER — Rack picking */}
        <Panel title="Pick + pack" className="fulfillment-col fulfillment-col--pick">
          {!detail ? (
            <EmptyState>Select an order from the queue.</EmptyState>
          ) : (
            <>
              <div className="ff-stepper">
                {STEPS.map((label, i) => {
                  const n = i + 1;
                  const active = n === activeStep;
                  const done = n < activeStep;
                  return (
                    <div
                      key={label}
                      className={`ff-step${active ? ' ff-step--active' : ''}${done ? ' ff-step--done' : ''}`}
                    >
                      <span className="ff-step-num">{n}</span>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>

              {!printStage &&
              (!workflow?.currentRackLines.length ||
                selectedQueue?.stockIssue === 'no_stock_reserved' ||
                !detail.pickList) ? (
                <Alert tone="warn">
                  {selectedQueue?.stockIssue === 'no_stock_reserved' ? (
                    <>
                      Warehouse stock is not reserved for this order (
                      <strong>
                        0 / {selectedQueue.orderItemCount ?? '?'}
                      </strong>{' '}
                      pick lines). Add stock under <strong>Commerce → Inventory</strong> or{' '}
                      <strong>Purchase &amp; GRN</strong>, then rebuild the pick list.
                    </>
                  ) : !detail.pickList ? (
                    <>No pick list exists for this order yet — rebuild to allocate warehouse stock.</>
                  ) : (
                    <>Pick list has no rack lines yet — sync inventory and rebuild picks.</>
                  )}
                  {canWrite ? (
                    <div className="ff-empty-actions">
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void syncInventoryAndRepair()}
                      >
                        Sync inventory &amp; rebuild
                      </Btn>
                      <Btn
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        onClick={() => void runAction('/rebuild-pick-list', 'Pick list rebuilt')}
                      >
                        Rebuild pick list
                      </Btn>
                    </div>
                  ) : null}
                </Alert>
              ) : null}

              {printStage ? (
                <Alert tone="success">
                  All racks picked. Use the print panel on the right to generate AWB, print label &amp; invoice, then mark packed.
                </Alert>
              ) : workflow?.currentRack ? (
                <>
                  <div className="ff-rack-banner">
                    <span className="ff-rack-label">Current rack</span>
                    <strong className="ff-rack-code">{workflow.currentRack}</strong>
                  </div>
                  <p className="muted ff-rack-hint">Scan product barcode — qty popup opens on match.</p>

                  <table className="ff-pick-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Picked</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflow.currentRackLines.map((l) => (
                        <tr key={l.id} className={l.complete ? 'ff-pick-row--done' : ''}>
                          <td>{l.row}</td>
                          <td>
                            <strong>{l.productTitle}</strong>
                            {l.sku ? <span className="muted"> · {l.sku}</span> : null}
                          </td>
                          <td>{l.qtyRequired}</td>
                          <td>
                            <span className={l.complete ? 'ff-picked-done' : l.qtyPicked > 0 ? 'ff-picked-partial' : ''}>
                              {l.qtyPicked}/{l.qtyRequired}
                            </span>
                          </td>
                          <td>{l.complete ? '✅ Picked' : 'Pending'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {canWrite ? (
                    <div className="ff-scan-area">
                      {!scanOpen ? (
                        <Btn variant="primary" onClick={() => setScanOpen(true)}>
                          Scan barcode
                        </Btn>
                      ) : (
                        <>
                          <BarcodeScanInput
                            value={scanCode}
                            onChange={setScanCode}
                            onScan={(c) => void lookupBarcode(c)}
                            placeholder="Scan or enter product / batch barcode"
                          />
                          <Btn size="sm" variant="secondary" onClick={() => setScanOpen(false)}>
                            Close scanner
                          </Btn>
                        </>
                      )}
                      {scanMsg ? <p className="scan-msg">{scanMsg}</p> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </Panel>

        {/* RIGHT — Summary + printables */}
        <Panel title="Order & print" className="fulfillment-col fulfillment-col--ship">
          {!detail || !order ? (
            <EmptyState>Select an order.</EmptyState>
          ) : (
            <div className="fulfillment-actions">
              {detail.shiprocketErrorDisplay || order.shiprocket_error ? (
                <Alert tone="warn">
                  {detail.shiprocketErrorDisplay ?? order.shiprocket_error}
                  {detail.shiprocketDiagnostics?.walletBalanceInr != null ? (
                    <p className="mt-2 text-sm opacity-90">
                      Live Shiprocket API wallet: ₹
                      {detail.shiprocketDiagnostics.walletBalanceInr.toLocaleString('en-IN')}
                      {detail.shiprocketDiagnostics.pickupLocationsAvailable.length ? (
                        <>
                          {' '}
                          · Pickups:{' '}
                          {detail.shiprocketDiagnostics.pickupLocationsAvailable.join(', ')}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </Alert>
              ) : null}

              {customer ? (
                <div className="ff-order-summary">
                  <p>
                    <strong>{selectedQueue?.customerName ?? order.order_name}</strong>
                  </p>
                  {customer.phone ? <p className="muted">{customer.phone}</p> : null}
                  {customer.address ? <p className="muted">{customer.address}</p> : null}
                  <p className="muted">
                    {customer.isCod ? 'COD' : 'Prepaid'}
                    {customer.totalAmount != null ? ` · ${formatInr(customer.totalAmount)}` : ''}
                  </p>
                  {order.tracking_awb ? (
                    <p>
                      AWB <span className="mono">{order.tracking_awb}</span>
                      {order.courier_name ? ` · ${order.courier_name}` : ''}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {workflow?.racks.length ? (
                <div className="ff-rack-progress">
                  <p className="muted">Rack progress</p>
                  <ol className="ff-rack-progress-list">
                    {workflow.racks.map((r) => (
                      <li
                        key={r.rack}
                        className={`ff-rack-progress-item${r.active ? ' ff-rack-progress-item--active' : ''}${r.complete ? ' ff-rack-progress-item--done' : ''}`}
                      >
                        <span className="mono">{r.rack}</span>
                        <span>
                          {r.pickedQty}/{r.totalQty}
                        </span>
                        {r.complete ? <span>✓</span> : r.active ? <span>→</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className={`ff-print-stage${printStage ? ' ff-print-stage--active' : ''}`}>
                <p className="ff-print-stage-title">
                  {printStage ? 'Printables ready' : 'Printables locked'}
                </p>
                {!printStage ? (
                  <p className="muted ff-print-stage-hint">
                    Complete rack picking (scan every product) to unlock AWB, label, and invoice printing.
                  </p>
                ) : null}
                <div className="fulfillment-btn-stack">
                  {canWrite ? (
                    <Btn
                      size="sm"
                      variant={printStage ? 'primary' : 'secondary'}
                      disabled={busy || !printStage || Boolean(order.tracking_awb)}
                      onClick={() => void runAction('/generate-awb', 'AWB generated')}
                    >
                      Generate AWB
                    </Btn>
                  ) : null}
                  {order.label_url ? (
                    <a className="btn btn-secondary btn-sm" href={order.label_url} target="_blank" rel="noreferrer">
                      Shiprocket PDF
                    </a>
                  ) : null}
                  <Link
                    className={`btn btn-secondary btn-sm${printStage ? '' : ' btn--disabled'}`}
                    to={printStage ? printUrl('courier_label', order.id) : '#'}
                    target="_blank"
                    onClick={(e) => { if (!printStage) e.preventDefault(); }}
                  >
                    Print label
                  </Link>
                  <Link
                    className={`btn btn-secondary btn-sm${printStage && detail.invoice ? '' : ' btn--disabled'}`}
                    to={printStage && detail.invoice ? printUrl('tax_invoice', detail.invoice.id) : '#'}
                    target="_blank"
                    onClick={(e) => { if (!printStage || !detail.invoice) e.preventDefault(); }}
                  >
                    Print invoice
                  </Link>
                  {canWrite ? (
                    <>
                      <Btn
                        size="sm"
                        disabled={busy || !printStage}
                        onClick={() => void runAction('/mark-label-printed', 'Label printed')}
                      >
                        Label printed
                      </Btn>
                      <Btn
                        size="sm"
                        variant="primary"
                        disabled={busy || !printStage}
                        onClick={() => void runAction('/mark-packed', 'Order packed')}
                      >
                        Mark packed
                      </Btn>
                    </>
                  ) : null}
                </div>
              </div>

              {canWrite ? (
                <div className="fulfillment-exceptions">
                  <p className="muted">Exceptions</p>
                  <div className="fulfillment-exc-btns">
                    {EXCEPTIONS.map((ex) => (
                      <Btn
                        key={ex.type}
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void runAction('/exception', `Logged: ${ex.type}`, { type: ex.type })}
                      >
                        {ex.label}
                      </Btn>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </div>

      {pickLookup ? (
        <PickConfirmModal
          lookup={pickLookup}
          busy={busy}
          onClose={() => setPickLookup(null)}
          onConfirm={(qty) => void confirmPick(qty)}
        />
      ) : null}
    </div>
  );
}
