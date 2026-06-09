import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { paths, toPath } from '../../lib/routes';
import { Alert, Btn, EmptyState, Loading } from '../ui';
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
  createdAt?: string;
  assignedEmployee?: string | null;
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
  authOk: boolean;
  authError: string | null;
  authHint: string | null;
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
    shiprocket_shipment_id: string | null;
    created_at?: string;
  };
  pickList: { id: string; picker_id?: string | null } | null;
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
  assignment?: {
    employeeId: string | null;
    employeeName: string | null;
    batchId: string | null;
    pickingStartedAt: string | null;
    labelVerifiedAt: string | null;
  };
  shippingLabel?: {
    id: string;
    qrCode: string;
    labelVerified: boolean;
    verifiedAt: string | null;
    printSequence: number;
  } | null;
  labelBatch?: {
    id: string;
    batch_number: string;
    assigned_employee_name: string;
    batch_status: string;
    printed_at: string | null;
  } | null;
};

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

function formatQueueTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatOmsStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function lineStatus(line: RackLine) {
  if (line.complete) return { label: 'Picked', tone: 'done' as const };
  if (line.qtyPicked > 0) return { label: 'In Progress', tone: 'progress' as const };
  return { label: 'Pending', tone: 'pending' as const };
}

function playWrongLabelAlert() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 280;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    /* audio optional */
  }
}

function PickConfirmModal({
  lookup,
  rack,
  onClose,
  onConfirm,
  busy,
}: {
  lookup: PickLookup;
  rack: string | null;
  onClose: () => void;
  onConfirm: (qty: number) => void;
  busy: boolean;
}) {
  const [qty, setQty] = useState(lookup.defaultQty);

  useEffect(() => {
    setQty(lookup.defaultQty);
  }, [lookup]);

  return (
    <div className="pp-modal-backdrop" role="dialog" aria-modal="true">
      <div className="pp-modal">
        <div className="pp-modal-head">
          <h3>Enter quantity</h3>
          <button type="button" className="pp-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="pp-modal-product">
          <div className="pp-modal-product-icon" aria-hidden>
            📦
          </div>
          <div>
            <strong>{lookup.productTitle}</strong>
            {lookup.sku ? <p className="muted">SKU: {lookup.sku}</p> : null}
            {rack ? <p className="pp-modal-rack">Rack {rack}</p> : null}
          </div>
        </div>
        <div className="pp-modal-stats">
          <div>
            <span>Required qty</span>
            <strong>{lookup.qtyRequired}</strong>
          </div>
          <div>
            <span>Already picked</span>
            <strong>{lookup.qtyPicked}</strong>
          </div>
          <div className="pp-modal-stats--warn">
            <span>Remaining</span>
            <strong>{lookup.remaining}</strong>
          </div>
        </div>
        <div className="pp-qty-controls">
          <button
            type="button"
            className="pp-qty-btn"
            disabled={qty <= 1 || busy}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <input
            className="pp-qty-input"
            type="number"
            min={1}
            max={lookup.remaining}
            value={qty}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setQty(Math.min(lookup.remaining, Math.max(1, n)));
            }}
          />
          <button
            type="button"
            className="pp-qty-btn"
            disabled={qty >= lookup.remaining || busy}
            onClick={() => setQty((q) => Math.min(lookup.remaining, q + 1))}
          >
            +
          </button>
        </div>
        <div className="pp-modal-actions">
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
  const [showSyncBanner, setShowSyncBanner] = useState(true);
  const [labelScanCode, setLabelScanCode] = useState('');
  const [wrongLabel, setWrongLabel] = useState('');
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
      if (selectedId) await loadDetail(selectedId, true);
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
      if (r.stage === 'print') setSuccess('All racks complete — open Print queue');
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

  async function verifyLabel(code: string) {
    if (!selectedId || !canWrite || !code.trim()) return;
    setBusy(true);
    setWrongLabel('');
    setError('');
    try {
      const r = await api<{
        ok: boolean;
        matched: boolean;
        error?: string;
        message?: string;
        alert?: string;
      }>(`${WMS_API}/fulfillment/orders/${selectedId}/verify-label`, {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      if (r.matched) {
        setLabelScanCode('');
        setSuccess(r.message ?? 'Label verified — paste on parcel');
        await loadDetail(selectedId);
        await loadQueue();
      } else {
        playWrongLabelAlert();
        setWrongLabel(r.error ?? 'Wrong label — scan the next label from your tray');
      }
    } catch (e) {
      playWrongLabelAlert();
      setWrongLabel(e instanceof Error ? e.message : 'Label verification failed');
    } finally {
      setBusy(false);
    }
  }

  const workflow = detail?.workflow;
  const order = detail?.order;
  const printStage = workflow?.stage === 'print' || detail?.printEnabled;
  const shiprocketAuthOk = detail?.shiprocketDiagnostics?.authOk !== false;
  const awbPendingShipment = Boolean(order?.shiprocket_shipment_id && !order?.tracking_awb);
  const awbRetryAllowed = Boolean(
    detail?.shiprocketErrorDisplay || order?.shiprocket_error || awbPendingShipment
  );
  const canGenerateAwb =
    shiprocketAuthOk && (printStage || awbRetryAllowed) && !order?.tracking_awb;
  const selectedQueue = queue.find((r) => r.id === selectedId);
  const customer = detail?.customerSummary;

  const orderTotalQty =
    workflow?.racks.reduce((s, r) => s + r.totalQty, 0) ?? selectedQueue?.orderItemCount ?? 0;
  const orderPickedQty = workflow?.racks.reduce((s, r) => s + r.pickedQty, 0) ?? 0;
  const rackLineCount = workflow?.currentRackLines.length ?? 0;
  const rackPickedQty = workflow?.currentRackLines.reduce((s, l) => s + l.qtyPicked, 0) ?? 0;
  const rackRemainingQty = workflow?.currentRackLines.reduce((s, l) => s + l.remaining, 0) ?? 0;
  const activeRackIndex = workflow?.racks.findIndex((r) => r.active) ?? -1;
  const printQueueCount = stats?.readyToPack ?? queue.filter((r) => r.awb).length;
  const awaitingLabel = order?.oms_status === 'awaiting_label_verification';
  const usesBatchLabels = Boolean(detail?.shippingLabel);
  const assignedName = detail?.assignment?.employeeName ?? selectedQueue?.assignedEmployee ?? null;

  const needsPickSetup =
    !printStage &&
    (!workflow?.currentRackLines.length ||
      selectedQueue?.stockIssue === 'no_stock_reserved' ||
      !detail?.pickList);

  if (loading && !stats) return <Loading label="Loading picker / packer…" />;

  return (
    <div className="pp-dashboard">
      <header className="pp-toolbar">
        <div className="pp-toolbar-title">
          <span className="pp-toolbar-icon" aria-hidden>
            ⛑
          </span>
          <h2>Picker / Packer</h2>
        </div>
        <div className="pp-toolbar-actions">
          <button
            type="button"
            className={`pp-print-queue-btn${printStage ? ' pp-print-queue-btn--active' : ''}`}
            disabled={!printStage && printQueueCount === 0}
            onClick={() => {
              if (printStage && order) {
                window.open(printUrl('courier_label', order.id), '_blank');
              }
            }}
          >
            Print queue
            {printQueueCount > 0 ? <span className="pp-badge">{printQueueCount}</span> : null}
          </button>
          {canWrite ? (
            <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void syncInventoryAndRepair()}>
              Sync inventory
            </Btn>
          ) : null}
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      {canWrite && showSyncBanner ? (
        <div className="pp-sync-banner">
          <p>
            <strong>0 / N</strong> means stock is not reserved. Sync inventory and rebuild picks for blocked orders.
          </p>
          <button type="button" className="pp-sync-dismiss" onClick={() => setShowSyncBanner(false)}>
            ×
          </button>
        </div>
      ) : null}

      {stats ? (
        <div className="pp-stats-strip">
          <span>
            Pending <strong>{stats.pendingOrders}</strong>
          </span>
          <span>
            Ready <strong>{stats.readyToPack}</strong>
          </span>
          <span>
            Packed today <strong>{stats.packedToday}</strong>
          </span>
          <span className="pp-stats-warn">
            Failed AWB <strong>{stats.failedAwb}</strong>
          </span>
        </div>
      ) : null}

      <div className="pp-layout">
        {/* LEFT — Order queue */}
        <aside className="pp-queue">
          <div className="pp-panel-head">
            <h3>Order queue</h3>
            <span className="pp-queue-count">{queue.length}</span>
          </div>
          {queue.length === 0 ? (
            <EmptyState>No orders in fulfillment.</EmptyState>
          ) : (
            <ul className="pp-order-list">
              {queue.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`pp-order-card${selectedId === row.id ? ' pp-order-card--active' : ''}`}
                    onClick={() => void loadDetail(row.id, true)}
                  >
                    <div className="pp-order-card-head">
                      <span className="pp-order-id">{row.orderName}</span>
                      <span className={`pp-pay-badge${row.isCod ? ' pp-pay-badge--cod' : ''}`}>
                        {row.isCod ? 'COD' : 'Prepaid'}
                      </span>
                    </div>
                    <div className="pp-order-card-sub">
                      <span className="pp-status-badge">{formatOmsStatus(row.omsStatus)}</span>
                      {row.shiprocketError ? <span className="pp-order-warn" title={row.shiprocketError}>⚠</span> : null}
                    </div>
                    {row.assignedEmployee ? (
                      <span className="pp-order-assignee">→ {row.assignedEmployee}</span>
                    ) : null}
                    {row.customerName ? <span className="pp-order-customer">{row.customerName}</span> : null}
                    <div className="pp-order-card-meta">
                      <span>
                        {row.orderItemCount ?? row.itemCount} items · {row.totalAmount != null ? formatInr(row.totalAmount) : '—'}
                      </span>
                    </div>
                    <div className="pp-order-card-foot">
                      <span>{row.courier}</span>
                      <span>{formatQueueTime(row.createdAt)}</span>
                    </div>
                    {row.stockIssue === 'no_stock_reserved' && row.missingProducts?.length ? (
                      <span className="pp-order-stock-hint">No stock: {row.missingProducts.join(', ')}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* CENTER — Active order picking */}
        <main className="pp-main">
          {!detail || !order ? (
            <div className="pp-main-empty">
              <EmptyState>Select an order from the queue to start picking.</EmptyState>
            </div>
          ) : (
            <>
              <div className="pp-order-header">
                <div className="pp-order-header-top">
                  <div>
                    <h3>{selectedQueue?.orderName ?? order.order_name}</h3>
                    <div className="pp-order-header-badges">
                      <span className="pp-status-badge">{formatOmsStatus(order.oms_status)}</span>
                      <span className={`pp-pay-badge${customer?.isCod ? ' pp-pay-badge--cod' : ''}`}>
                        {customer?.isCod ? 'COD' : 'Prepaid'}
                      </span>
                      {order.courier_name ? <span className="pp-courier-chip">{order.courier_name}</span> : null}
                    </div>
                  </div>
                  <div className="pp-order-header-amount">
                    {customer?.totalAmount != null ? formatInr(customer.totalAmount) : '—'}
                  </div>
                </div>
                <div className="pp-order-header-stats">
                  <div>
                    <span>Total items</span>
                    <strong>{orderTotalQty}</strong>
                  </div>
                  <div>
                    <span>Picked</span>
                    <strong>{orderPickedQty}</strong>
                  </div>
                  <div>
                    <span>Assigned to</span>
                    <strong>{assignedName ?? detail.pickList?.picker_id ?? '—'}</strong>
                  </div>
                </div>
              </div>

              {order.oms_status === 'assigned' ? (
                <div className="pp-setup-card">
                  <p>
                    Order assigned to <strong>{assignedName ?? 'employee'}</strong> — labels not printed yet.
                    Open <strong>Assign &amp; print labels</strong> and print the employee batch before picking.
                  </p>
                </div>
              ) : null}

              {detail.shiprocketDiagnostics && !detail.shiprocketDiagnostics.authOk ? (
                <Alert tone="error">
                  <strong>Shiprocket API blocked</strong>
                  <p>{detail.shiprocketDiagnostics.authError}</p>
                  {detail.shiprocketDiagnostics.authHint ? (
                    <p className="mt-2 text-sm opacity-90">{detail.shiprocketDiagnostics.authHint}</p>
                  ) : null}
                </Alert>
              ) : null}

              {needsPickSetup ? (
                <div className="pp-setup-card">
                  <p>
                    {selectedQueue?.stockIssue === 'no_stock_reserved' ? (
                      <>
                        Warehouse stock is not reserved (
                        <strong>0 / {selectedQueue.orderItemCount ?? '?'}</strong> pick lines). Add stock in
                        Commerce → Inventory or Purchase &amp; GRN, then rebuild.
                      </>
                    ) : !detail.pickList ? (
                      <>No pick list yet — rebuild to allocate warehouse stock for this order.</>
                    ) : (
                      <>Pick list has no rack lines — sync inventory and rebuild picks.</>
                    )}
                  </p>
                  {canWrite ? (
                    <div className="pp-setup-actions">
                      <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void syncInventoryAndRepair()}>
                        Sync inventory
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
                </div>
              ) : null}

              {awaitingLabel ? (
                <section className="pp-label-verify">
                  <h4>Label verification</h4>
                  <p>
                    Take the <strong>next label</strong> from{' '}
                    {assignedName ? <strong>{assignedName}&apos;s</strong> : 'your'} tray and scan the QR.
                  </p>
                  {detail?.shippingLabel ? (
                    <p className="muted mono">Expected: {selectedQueue?.orderName ?? order.order_name}</p>
                  ) : null}
                  {canWrite ? (
                    <BarcodeScanInput
                      value={labelScanCode}
                      onChange={setLabelScanCode}
                      onScan={(c) => void verifyLabel(c)}
                      placeholder="Scan shipping label QR"
                    />
                  ) : null}
                  {detail?.shippingLabel?.labelVerified ? (
                    <p className="pp-label-verified">Label verified — ready for dispatch rack</p>
                  ) : null}
                </section>
              ) : null}

              {printStage && !awaitingLabel ? (
                <div className="pp-complete-card">
                  <span className="pp-complete-icon" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <strong>All racks picked</strong>
                    <p>
                      {usesBatchLabels
                        ? 'Pack the order, then mark packed and verify the pre-printed label from your tray.'
                        : 'Use the Print queue panel to generate AWB, print label & invoice, then mark packed.'}
                    </p>
                  </div>
                </div>
              ) : workflow?.currentRack ? (
                <>
                  <section className="pp-rack-hero">
                    <div className="pp-rack-hero-top">
                      <div>
                        <span className="pp-rack-label">Current rack</span>
                        <h2 className="pp-rack-code">{workflow.currentRack}</h2>
                      </div>
                      <span className="pp-rack-map-btn" title="Rack map">
                        📍 Rack map
                      </span>
                    </div>
                    <div className="pp-rack-stats">
                      <div>
                        <span>Items in rack</span>
                        <strong>{rackLineCount}</strong>
                      </div>
                      <div>
                        <span>Picked</span>
                        <strong>{rackPickedQty}</strong>
                      </div>
                      <div className="pp-rack-stats--warn">
                        <span>Remaining</span>
                        <strong>{rackRemainingQty}</strong>
                      </div>
                    </div>
                    <p className="pp-rack-tip">Scan product barcode to pick items from this rack.</p>
                  </section>

                  <div className="pp-product-table-wrap">
                    <table className="pp-product-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Product</th>
                          <th>SKU</th>
                          <th>Order qty</th>
                          <th>Picked qty</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflow.currentRackLines.map((l) => {
                          const st = lineStatus(l);
                          return (
                            <tr key={l.id} className={l.complete ? 'pp-row--done' : ''}>
                              <td>{l.row}</td>
                              <td>
                                <div className="pp-product-cell">
                                  <span className="pp-product-thumb" aria-hidden>
                                    📦
                                  </span>
                                  <strong>{l.productTitle}</strong>
                                </div>
                              </td>
                              <td className="mono">{l.sku ?? '—'}</td>
                              <td>{l.qtyRequired}</td>
                              <td>
                                <span className={st.tone === 'done' ? 'pp-picked-done' : st.tone === 'progress' ? 'pp-picked-partial' : ''}>
                                  {l.qtyPicked} / {l.qtyRequired}
                                </span>
                              </td>
                              <td>
                                <span className={`pp-line-status pp-line-status--${st.tone}`}>{st.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {canWrite ? (
                    <div className="pp-scan-footer">
                      {scanOpen ? (
                        <div className="pp-scan-input-wrap">
                          <BarcodeScanInput
                            value={scanCode}
                            onChange={setScanCode}
                            onScan={(c) => void lookupBarcode(c)}
                            placeholder="Scan or enter product / batch barcode"
                          />
                          <Btn size="sm" variant="secondary" onClick={() => setScanOpen(false)}>
                            Close
                          </Btn>
                        </div>
                      ) : (
                        <button type="button" className="pp-scan-cta" onClick={() => setScanOpen(true)}>
                          Scan barcode — click to focus scanner
                        </button>
                      )}
                      {scanMsg ? <p className="pp-scan-msg">{scanMsg}</p> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </main>

        {/* RIGHT — Progress & print */}
        <aside className="pp-sidebar">
          {!detail || !order ? (
            <EmptyState>Select an order.</EmptyState>
          ) : (
            <>
              {workflow?.racks.length ? (
                <section className="pp-sidebar-section">
                  <div className="pp-sidebar-head">
                    <h4>Rack progress</h4>
                    <span className="muted">
                      {activeRackIndex >= 0 ? activeRackIndex + 1 : workflow.racks.length} of {workflow.racks.length} racks
                    </span>
                  </div>
                  <ol className="pp-rack-stepper">
                    {workflow.racks.map((r, i) => (
                      <li
                        key={r.rack}
                        className={`pp-rack-step${r.complete ? ' pp-rack-step--done' : ''}${r.active ? ' pp-rack-step--active' : ''}`}
                      >
                        <span className="pp-rack-step-marker">
                          {r.complete ? '✓' : i + 1}
                        </span>
                        <div className="pp-rack-step-body">
                          <strong>{r.rack}</strong>
                          <span>
                            {r.complete
                              ? 'Complete'
                              : r.active
                                ? `${r.totalQty - r.pickedQty} items remaining`
                                : `${r.pickedQty} / ${r.totalQty} items picked`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              <section className="pp-sidebar-section">
                <h4>Order summary</h4>
                <dl className="pp-summary-list">
                  <div>
                    <dt>Customer</dt>
                    <dd>{selectedQueue?.customerName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Items</dt>
                    <dd>
                      {orderTotalQty} · {customer?.totalAmount != null ? formatInr(customer.totalAmount) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>{customer?.isCod ? 'COD' : 'Prepaid'}</dd>
                  </div>
                  {customer?.address ? (
                    <div>
                      <dt>Ship to</dt>
                      <dd className="pp-summary-address">{customer.address}</dd>
                    </div>
                  ) : null}
                  {order.tracking_awb ? (
                    <div>
                      <dt>AWB</dt>
                      <dd className="mono">{order.tracking_awb}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="pp-sidebar-section pp-next-step">
                <h4>Next step</h4>
                {awaitingLabel ? (
                  <div className="pp-next-step-card pp-next-step-card--warn">
                    <span aria-hidden>🏷</span>
                    <p>
                      <strong>Awaiting label scan</strong>
                      <span>Scan QR from employee tray — wrong label blocks dispatch.</span>
                    </p>
                  </div>
                ) : printStage ? (
                  <div className="pp-next-step-card pp-next-step-card--ready">
                    <span aria-hidden>🖨</span>
                    <p>
                      <strong>Printables ready</strong>
                      <span>
                        {usesBatchLabels
                          ? 'Mark packed, then verify pre-printed label QR.'
                          : 'Generate AWB, print label & invoice, then mark packed.'}
                      </span>
                    </p>
                  </div>
                ) : awbRetryAllowed ? (
                  <div className="pp-next-step-card pp-next-step-card--warn">
                    <span aria-hidden>📦</span>
                    <p>
                      <strong>AWB pending</strong>
                      <span>You can assign AWB now; printing still needs picking complete.</span>
                    </p>
                  </div>
                ) : (
                  <div className="pp-next-step-card">
                    <span aria-hidden>📋</span>
                    <p>
                      <strong>Complete all racks</strong>
                      <span>When every item is picked, printables unlock automatically.</span>
                    </p>
                  </div>
                )}
              </section>

              <section
                className={`pp-print-panel${printStage ? ' pp-print-panel--active' : awbRetryAllowed ? ' pp-print-panel--retry' : ''}`}
              >
                <h4>Print queue</h4>
                {detail.shiprocketErrorDisplay || order.shiprocket_error ? (
                  <p className="pp-print-warn">{detail.shiprocketErrorDisplay ?? order.shiprocket_error}</p>
                ) : null}
                <div className="pp-print-actions">
                  {canWrite ? (
                    <Btn
                      size="sm"
                      variant={canGenerateAwb ? 'primary' : 'secondary'}
                      disabled={busy || !canGenerateAwb}
                      onClick={() => void runAction('/generate-awb', 'AWB generated')}
                    >
                      {awbRetryAllowed && !printStage
                        ? awbPendingShipment
                          ? 'Assign AWB'
                          : 'Retry AWB'
                        : 'Generate AWB'}
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
                      {!usesBatchLabels ? (
                        <Btn
                          size="sm"
                          disabled={busy || !printStage}
                          onClick={() => void runAction('/mark-label-printed', 'Label printed')}
                        >
                          Label printed
                        </Btn>
                      ) : null}
                      <Btn
                        size="sm"
                        variant="primary"
                        disabled={busy || !printStage || awaitingLabel}
                        onClick={() =>
                          void runAction(
                            '/mark-packed',
                            usesBatchLabels
                              ? 'Packed — scan label from tray to verify'
                              : 'Order packed'
                          )
                        }
                      >
                        Mark packed
                      </Btn>
                    </>
                  ) : null}
                </div>
              </section>

              {!printStage && workflow?.currentRack ? (
                <p className="pp-info-tip">
                  After all items in this rack are picked, the system moves to the next rack automatically.
                </p>
              ) : null}

              {canWrite ? (
                <section className="pp-sidebar-section pp-exceptions">
                  <h4>Exceptions</h4>
                  <div className="pp-exc-btns">
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
                </section>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {wrongLabel ? (
        <div className="pp-wrong-label-overlay" role="alert">
          <div className="pp-wrong-label-card">
            <h3>Wrong label</h3>
            <p>{wrongLabel}</p>
            <p className="muted">Use the next label from your employee tray stack.</p>
            <Btn size="sm" variant="primary" onClick={() => setWrongLabel('')}>
              Dismiss
            </Btn>
          </div>
        </div>
      ) : null}

      {pickLookup ? (
        <PickConfirmModal
          lookup={pickLookup}
          rack={workflow?.currentRack ?? null}
          busy={busy}
          onClose={() => setPickLookup(null)}
          onConfirm={(qty) => void confirmPick(qty)}
        />
      ) : null}
    </div>
  );
}
