import { computeFulfillmentGates, type FulfillmentGates } from '@morbeez/shared/fulfillment/fulfillment-gates';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { paths, toPath } from '../../lib/routes';
import { Alert, Btn, EmptyState, Loading } from '../ui';
import { WMS_API } from './warehouse-api';
import { BarcodeScanInput } from './BarcodeScanInput';
import { ManualCourierPicker } from './ManualCourierPicker';

type QueueFilter = 'pending' | 'packed' | 'lr_pending' | 'completed';

type Stats = {
  pending: number;
  packed: number;
  lrPending: number;
  completed: number;
  pendingOrders?: number;
  readyToPack?: number;
  packedToday?: number;
  courierPending?: number;
  failedAwb?: number;
};

const QUEUE_FILTERS: Array<{ id: QueueFilter; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'packed', label: 'Packed' },
  { id: 'lr_pending', label: 'LR Pending' },
  { id: 'completed', label: 'Completed' },
];

function queueFilterBucket(row: QueueRow): QueueFilter {
  const status = row.omsStatus;
  if (status === 'awaiting_tracking' || row.needsManualTracking) return 'lr_pending';
  if (['ready_dispatch', 'shipped', 'delivered', 'completed'].includes(status)) {
    return 'completed';
  }
  if (['packed', 'awaiting_label_verification'].includes(status)) return 'packed';
  return 'pending';
}

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
  shippingMethod?: 'shiprocket' | 'manual';
  needsManualTracking?: boolean;
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
  stage: 'picking' | 'pack' | 'print';
  step: number;
  currentRack: string | null;
  racks: RackProgress[];
  currentRackLines: RackLine[];
  pickComplete?: boolean;
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
    shipping_method?: string | null;
    tracking_status?: string | null;
    created_at?: string;
  };
  pickList: { id: string; picker_id?: string | null } | null;
  packSession: { id: string; scan_complete?: boolean } | null;
  invoice: { id: string; invoice_number: string } | null;
  suggestedDispatchRack: string | null;
  pickComplete?: boolean;
  printEnabled: boolean;
  fulfillmentGates?: FulfillmentGates;
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
  awbAssignAvailable?: boolean;
  shippingMethod?: 'shiprocket' | 'manual';
  package?: {
    status: string;
    suggestedBoxCode: string;
    suggestedBoxName: string;
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
    estimatedWeightKg: number;
    packageWeightKg: number;
    billingWeightKg: number;
    overridden: boolean;
    confirmedAt: string | null;
    courierPayload: { length: number; breadth: number; height: number; weight: number };
    packagingCategoryName?: string | null;
    matchedRuleId?: string | null;
    boxSelectionSource?: string | null;
    volumetricWeightKg?: number;
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
  const [manualCourierId, setManualCourierId] = useState('');
  const [manualCourier, setManualCourier] = useState('');
  const [manualTracking, setManualTracking] = useState('');
  const [packageOverrideOpen, setPackageOverrideOpen] = useState(false);
  const [overrideLength, setOverrideLength] = useState('');
  const [overrideBreadth, setOverrideBreadth] = useState('');
  const [overrideHeight, setOverrideHeight] = useState('');
  const [overrideWeight, setOverrideWeight] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('pending');
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
        const sm = d.shippingMethod ?? d.order.shipping_method ?? 'shiprocket';
        setManualCourierId('');
        setManualCourier(d.order.courier_name ?? '');
        setManualTracking(d.order.tracking_awb ?? '');

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
      if (r.stage === 'pack') setSuccess('All racks complete — confirm package & transport');
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

  async function setShipmentMode(method: 'shiprocket' | 'manual') {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}/shipping-method`, {
        method: 'PATCH',
        body: JSON.stringify({ method }),
      });
      setSuccess(method === 'manual' ? 'Manual logistics selected' : 'Shiprocket selected');
      await loadDetail(selectedId);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update shipping method');
    } finally {
      setBusy(false);
    }
  }

  async function confirmPackageEstimate() {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}/package/confirm`, {
        method: 'POST',
        body: JSON.stringify({ autoAwb: true }),
      });
      setSuccess('Package confirmed — courier payload sent when Shiprocket is enabled');
      setPackageOverrideOpen(false);
      await loadDetail(selectedId);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm package');
    } finally {
      setBusy(false);
    }
  }

  async function recalculatePackage() {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}/package/estimate`, { method: 'POST' });
      setSuccess('Package estimate recalculated');
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recalculate package');
    } finally {
      setBusy(false);
    }
  }

  async function savePackageOverride() {
    if (!selectedId || !canWrite) return;
    const lengthCm = Number(overrideLength);
    const breadthCm = Number(overrideBreadth);
    const heightCm = Number(overrideHeight);
    const weightKg = Number(overrideWeight);
    if (!lengthCm || !breadthCm || !heightCm || !weightKg) {
      setError('Enter valid length, breadth, height, and weight');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}/package/override`, {
        method: 'POST',
        body: JSON.stringify({ lengthCm, breadthCm, heightCm, weightKg }),
      });
      setSuccess('Package dimensions overridden and saved');
      setPackageOverrideOpen(false);
      await loadDetail(selectedId);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not override package');
    } finally {
      setBusy(false);
    }
  }

  async function saveManualLogistics() {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}/manual-logistics`, {
        method: 'POST',
        body: JSON.stringify({
          courierName: manualCourier.trim(),
          trackingAwb: manualTracking.trim(),
        }),
      });
      setSuccess('Manual logistics saved');
      await loadDetail(selectedId);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save manual logistics');
    } finally {
      setBusy(false);
    }
  }

  async function assignAwb(forceRecreate = false) {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await api<{
        ok: boolean;
        error?: string;
        shipment?: { awb?: string | null } | null;
      }>(`${WMS_API}/fulfillment/orders/${selectedId}/generate-awb`, {
        method: 'POST',
        body: JSON.stringify({ forceRecreate }),
      });
      if (r.ok && r.shipment?.awb) {
        setSuccess(`AWB assigned: ${r.shipment.awb}`);
      } else if (r.ok) {
        setSuccess('AWB assigned');
      } else {
        setError(
          r.error ??
            'AWB could not be assigned (wallet or courier issue). Invoice and label print are still available below.'
        );
      }
      await loadDetail(selectedId);
      await loadQueue();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'AWB assignment failed — invoice and label print are still available below.'
      );
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
  const fulfillmentGates = useMemo(() => {
    if (!detail) return null;
    return (
      detail.fulfillmentGates ??
      computeFulfillmentGates({
        pickComplete: Boolean(detail.pickComplete ?? detail.packSession?.scan_complete),
        packageStatus: detail.package?.status,
        shippingMethod: detail.shippingMethod ?? order?.shipping_method,
        trackingAwb: order?.tracking_awb,
      })
    );
  }, [detail, order?.shipping_method, order?.tracking_awb]);
  const shippingMethod =
    fulfillmentGates?.shippingMethod ??
    detail?.shippingMethod ??
    (order?.shipping_method === 'manual' ? 'manual' : 'shiprocket');
  const isManualShipping = shippingMethod === 'manual';
  const pickComplete = fulfillmentGates?.pickComplete ?? false;
  const packStage = Boolean(pickComplete && fulfillmentGates?.packRequired);
  const printStage = Boolean(fulfillmentGates?.printEnabled);
  const awaitingTracking = order?.oms_status === 'awaiting_tracking';
  const awbPendingShipment = Boolean(order?.shiprocket_shipment_id && !order?.tracking_awb);
  const awbIssue =
    !isManualShipping &&
    Boolean(
      fulfillmentGates?.awbPending ||
        detail?.shiprocketErrorDisplay ||
        order?.shiprocket_error ||
        awbPendingShipment
    );
  const awbRetryAllowed = awbIssue && fulfillmentGates?.packageConfirmed;
  const showPrintActions = printStage || awaitingTracking;
  const invoiceReady = Boolean(detail?.invoice);
  const awbAssignAvailable = detail?.awbAssignAvailable !== false && !isManualShipping;
  const packageInfo = detail?.package;
  const packageConfirmed =
    packageInfo?.status === 'confirmed' || packageInfo?.status === 'label_generated';
  const packageNeedsConfirm = Boolean(packageInfo && !packageConfirmed);
  const useShiprocketLabel =
    !isManualShipping && Boolean(order?.label_url) && shippingMethod === 'shiprocket';
  const selectedQueue = queue.find((r) => r.id === selectedId);
  const customer = detail?.customerSummary;
  const filteredQueue = queue.filter((row) => queueFilterBucket(row) === queueFilter);
  const filterCounts = {
    pending: stats?.pending ?? queue.filter((r) => queueFilterBucket(r) === 'pending').length,
    packed: stats?.packed ?? queue.filter((r) => queueFilterBucket(r) === 'packed').length,
    lr_pending:
      stats?.lrPending ?? queue.filter((r) => queueFilterBucket(r) === 'lr_pending').length,
    completed:
      stats?.completed ?? queue.filter((r) => queueFilterBucket(r) === 'completed').length,
  };

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

      <div className="pp-queue-filters">
        {QUEUE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pp-queue-filter${queueFilter === f.id ? ' pp-queue-filter--active' : ''}${f.id === 'lr_pending' ? ' pp-queue-filter--warn' : ''}`}
            onClick={() => setQueueFilter(f.id)}
          >
            {f.label}
            <strong>{filterCounts[f.id]}</strong>
          </button>
        ))}
      </div>

      <div className="pp-layout">
        {/* LEFT — Order queue */}
        <aside className="pp-queue">
          <div className="pp-panel-head">
            <h3>Order queue</h3>
            <span className="pp-queue-count">{filteredQueue.length}</span>
          </div>
          {filteredQueue.length === 0 ? (
            <EmptyState>
              No {QUEUE_FILTERS.find((f) => f.id === queueFilter)?.label.toLowerCase()} orders.
            </EmptyState>
          ) : (
            <ul className="pp-order-list">
              {filteredQueue.map((row) => (
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
                      {row.shippingMethod === 'manual' ? (
                        <span className="pp-order-mode">Manual</span>
                      ) : null}
                      {row.needsManualTracking ? (
                        <span className="pp-order-warn" title="Awaiting LR / tracking">
                          LR
                        </span>
                      ) : null}
                      {row.shiprocketError && row.shippingMethod !== 'manual' ? (
                        <span className="pp-order-warn" title={row.shiprocketError}>
                          ⚠
                        </span>
                      ) : null}
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
                    <strong>Ready to print</strong>
                    <p>
                      {usesBatchLabels
                        ? 'Print invoice & packing slip, mark packed, then verify pre-printed label QR.'
                        : isManualShipping
                          ? 'Print invoice & packing slip, then mark packed. LR can be updated later.'
                          : 'Print Shiprocket label & invoice, then mark packed.'}
                    </p>
                  </div>
                </div>
              ) : packStage && !awaitingLabel ? (
                <div className="pp-complete-card">
                  <span className="pp-complete-icon" aria-hidden>
                    📦
                  </span>
                  <div>
                    <strong>Picking complete — pack order</strong>
                    <p>
                      Select box type, enter number of boxes, confirm package, then choose Shiprocket or
                      manual transport.
                    </p>
                  </div>
                </div>
              ) : workflow?.currentRack ? (
                <>
                  {workflow.currentRack === 'UNASSIGNED' ? (
                    <div className="pp-setup-card">
                      <p>
                        <strong>No warehouse rack on this pick line.</strong> Set the product&apos;s warehouse
                        location in Commerce → Product wizard (Step 1), confirm it shows under Fulfillment stock,
                        then rebuild this order&apos;s pick list.
                      </p>
                      {canWrite ? (
                        <div className="pp-setup-actions">
                          <Btn
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void syncInventoryAndRepair()}
                          >
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

              {packageInfo ? (
                <section className="pp-sidebar-section pp-package-estimate">
                  <h4>Package estimate</h4>
                  <dl className="pp-package-grid">
                    <div>
                      <dt>Suggested box</dt>
                      <dd>
                        <strong>{packageInfo.suggestedBoxCode}</strong>
                        <span className="muted"> {packageInfo.suggestedBoxName}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Dimensions (L × W × H)</dt>
                      <dd>
                        {packageInfo.lengthCm} × {packageInfo.breadthCm} × {packageInfo.heightCm} cm
                      </dd>
                    </div>
                    {packageInfo.packagingCategoryName ? (
                      <div>
                        <dt>Category</dt>
                        <dd>{packageInfo.packagingCategoryName}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Estimated weight</dt>
                      <dd>{packageInfo.packageWeightKg} kg</dd>
                    </div>
                    {packageInfo.volumetricWeightKg != null ? (
                      <div>
                        <dt>Volumetric weight</dt>
                        <dd>{packageInfo.volumetricWeightKg} kg</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Billing weight</dt>
                      <dd>{packageInfo.billingWeightKg} kg</dd>
                    </div>
                    {packageInfo.boxSelectionSource ? (
                      <div>
                        <dt>Rule source</dt>
                        <dd className="mono">{packageInfo.boxSelectionSource}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span
                          className={`pp-package-status pp-package-status--${packageInfo.status}`}
                        >
                          {packageInfo.status.replace(/_/g, ' ')}
                        </span>
                        {packageInfo.overridden ? <span className="muted"> · overridden</span> : null}
                      </dd>
                    </div>
                  </dl>
                  {canWrite ? (
                    <div className="pp-package-actions">
                      {packageNeedsConfirm ? (
                        <Btn
                          size="sm"
                          variant="primary"
                          disabled={busy}
                          onClick={() => void confirmPackageEstimate()}
                        >
                          {busy ? 'Confirming…' : 'Confirm package'}
                        </Btn>
                      ) : null}
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setOverrideLength(String(packageInfo.lengthCm));
                          setOverrideBreadth(String(packageInfo.breadthCm));
                          setOverrideHeight(String(packageInfo.heightCm));
                          setOverrideWeight(String(packageInfo.packageWeightKg));
                          setPackageOverrideOpen((v) => !v);
                        }}
                      >
                        {packageOverrideOpen ? 'Hide override' : 'Override dimensions'}
                      </Btn>
                      <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void recalculatePackage()}>
                        Recalculate
                      </Btn>
                    </div>
                  ) : null}
                  {packageOverrideOpen ? (
                    <div className="pp-package-override">
                      <label className="pp-manual-field">
                        <span>Length (cm)</span>
                        <input
                          value={overrideLength}
                          disabled={!canWrite || busy}
                          onChange={(e) => setOverrideLength(e.target.value)}
                          inputMode="decimal"
                        />
                      </label>
                      <label className="pp-manual-field">
                        <span>Breadth (cm)</span>
                        <input
                          value={overrideBreadth}
                          disabled={!canWrite || busy}
                          onChange={(e) => setOverrideBreadth(e.target.value)}
                          inputMode="decimal"
                        />
                      </label>
                      <label className="pp-manual-field">
                        <span>Height (cm)</span>
                        <input
                          value={overrideHeight}
                          disabled={!canWrite || busy}
                          onChange={(e) => setOverrideHeight(e.target.value)}
                          inputMode="decimal"
                        />
                      </label>
                      <label className="pp-manual-field">
                        <span>Weight (kg)</span>
                        <input
                          value={overrideWeight}
                          disabled={!canWrite || busy}
                          onChange={(e) => setOverrideWeight(e.target.value)}
                          inputMode="decimal"
                        />
                      </label>
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void savePackageOverride()}
                      >
                        Save override
                      </Btn>
                    </div>
                  ) : null}
                  {!isManualShipping && packageNeedsConfirm ? (
                    <p className="pp-package-hint muted">
                      Confirm package before AWB / label generation. Dimensions auto-send to Shiprocket.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section className="pp-sidebar-section pp-shipment-mode">
                <h4>Shipment mode</h4>
                <div className="pp-shipment-options">
                  <label
                    className={`pp-shipment-option${shippingMethod === 'shiprocket' ? ' pp-shipment-option--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`shipment-${order.id}`}
                      checked={shippingMethod === 'shiprocket'}
                      disabled={!canWrite || busy}
                      onChange={() => void setShipmentMode('shiprocket')}
                    />
                    <span className="pp-shipment-option-body">
                      <strong>Shiprocket (Auto)</strong>
                      <span>Recommended for serviceable areas</span>
                    </span>
                  </label>
                  <label
                    className={`pp-shipment-option${shippingMethod === 'manual' ? ' pp-shipment-option--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`shipment-${order.id}`}
                      checked={shippingMethod === 'manual'}
                      disabled={!canWrite || busy}
                      onChange={() => void setShipmentMode('manual')}
                    />
                    <span className="pp-shipment-option-body">
                      <strong>Manual logistics</strong>
                      <span>For non-serviceable areas, bulk, or client request</span>
                    </span>
                  </label>
                </div>

                {isManualShipping ? (
                  <div className="pp-manual-logistics">
                    <h5>Manual logistics details</h5>
                    <ManualCourierPicker
                      value={manualCourierId}
                      displayValue={manualCourier}
                      required
                      disabled={!canWrite || busy}
                      onChange={(id, name) => {
                        setManualCourierId(id);
                        setManualCourier(name);
                      }}
                    />
                    <label className="pp-manual-field">
                      <span>
                        Tracking / LR number <em>*</em>
                      </span>
                      <input
                        value={manualTracking}
                        disabled={!canWrite || busy}
                        onChange={(e) => setManualTracking(e.target.value)}
                        placeholder="LR / AWB / tracking number"
                      />
                    </label>
                    {canWrite ? (
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={busy || !manualCourier.trim() || !manualTracking.trim()}
                        onClick={() => void saveManualLogistics()}
                      >
                        {busy ? 'Saving…' : 'Save logistics details'}
                      </Btn>
                    ) : null}
                    {awaitingTracking && !order.tracking_awb ? (
                      <p className="pp-manual-hint muted">
                        Packed — enter LR when transport receipt is collected.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="pp-sidebar-section pp-next-step">
                <h4>Next step</h4>
                {awaitingTracking ? (
                  <div className="pp-next-step-card pp-next-step-card--warn">
                    <span aria-hidden>📋</span>
                    <p>
                      <strong>Awaiting tracking</strong>
                      <span>Parcel packed — save LR / tracking when logistics confirms.</span>
                    </p>
                  </div>
                ) : awaitingLabel ? (
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
                      <strong>Print documents</strong>
                      <span>
                        {isManualShipping
                          ? 'Print invoice & packing slip, then mark packed.'
                          : 'AWB assigned — print Shiprocket label & invoice.'}
                      </span>
                    </p>
                  </div>
                ) : packStage ? (
                  <div className="pp-next-step-card pp-next-step-card--warn">
                    <span aria-hidden>📦</span>
                    <p>
                      <strong>Pack order</strong>
                      <span>
                        Confirm box dimensions and transport before AWB or printing.
                      </span>
                    </p>
                  </div>
                ) : awbRetryAllowed ? (
                  <div className="pp-next-step-card pp-next-step-card--warn">
                    <span aria-hidden>📦</span>
                    <p>
                      <strong>AWB pending</strong>
                      <span>
                        {packageNeedsConfirm
                          ? 'Confirm package (box + weight) first, then assign AWB.'
                          : 'Package confirmed — assign Shiprocket AWB before printing label.'}
                      </span>
                    </p>
                    {canWrite && awbAssignAvailable && !order.tracking_awb ? (
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={busy || packageNeedsConfirm}
                        onClick={() => void assignAwb(Boolean(order.shiprocket_error || detail.shiprocketErrorDisplay))}
                      >
                        {busy ? 'Assigning…' : order.shiprocket_error ? 'Retry AWB' : 'Assign AWB'}
                      </Btn>
                    ) : null}
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

              <section className={`pp-print-panel${showPrintActions ? ' pp-print-panel--active' : ''}`}>
                <h4>Print queue</h4>
                {detail.shiprocketErrorDisplay || order.shiprocket_error ? (
                  <p className="pp-print-warn">{detail.shiprocketErrorDisplay ?? order.shiprocket_error}</p>
                ) : null}
                {canWrite && awbAssignAvailable && !order.tracking_awb ? (
                  <div className="pp-awb-assign-row">
                    <Btn
                      size="sm"
                      variant="secondary"
                      disabled={busy || packageNeedsConfirm}
                      onClick={() => void assignAwb(Boolean(order.shiprocket_error || detail.shiprocketErrorDisplay))}
                    >
                      {busy ? 'Assigning AWB…' : order.shiprocket_error ? 'Retry AWB' : 'Assign AWB'}
                    </Btn>
                    {awbIssue && !printStage ? (
                      <span className="pp-awb-assign-hint muted">
                        Invoice &amp; label available even if AWB fails
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="pp-print-actions">
                  {useShiprocketLabel ? (
                    <a
                      className={`pp-print-action-btn pp-print-action-btn--label${showPrintActions ? '' : ' pp-print-action-btn--disabled'}`}
                      href={showPrintActions ? order.label_url! : undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (!showPrintActions) e.preventDefault();
                      }}
                    >
                      Shipping Label
                    </a>
                  ) : (
                    <Link
                      className={`pp-print-action-btn pp-print-action-btn--label${showPrintActions ? '' : ' pp-print-action-btn--disabled'}`}
                      to={showPrintActions ? printUrl('courier_label', order.id) : '#'}
                      target="_blank"
                      onClick={(e) => {
                        if (!showPrintActions) e.preventDefault();
                      }}
                    >
                      {isManualShipping ? 'Custom shipping label' : 'Shipping Label'}
                    </Link>
                  )}
                  <Link
                    className={`pp-print-action-btn pp-print-action-btn--invoice${showPrintActions && invoiceReady ? '' : ' pp-print-action-btn--disabled'}`}
                    to={showPrintActions && invoiceReady ? printUrl('tax_invoice', detail.invoice!.id) : '#'}
                    target="_blank"
                    onClick={(e) => {
                      if (!showPrintActions || !invoiceReady) e.preventDefault();
                    }}
                  >
                    Invoice
                  </Link>
                  {canWrite ? (
                    <button
                      type="button"
                      className={`pp-print-action-btn pp-print-action-btn--packed${printStage && !awaitingLabel ? '' : ' pp-print-action-btn--disabled'}`}
                      disabled={busy || !printStage || awaitingLabel}
                      onClick={() =>
                        void runAction(
                          '/mark-packed',
                          usesBatchLabels
                            ? 'Packed — scan label from tray to verify'
                            : 'Order marked as packed'
                        )
                      }
                    >
                      Mark as Packed
                    </button>
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
