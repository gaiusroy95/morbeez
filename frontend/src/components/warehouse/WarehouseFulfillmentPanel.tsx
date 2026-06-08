import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Alert, Badge, Btn, DataTable, EmptyState, Loading, Panel, TableWrap } from '../ui';
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
  courier: string;
  itemCount: number;
  priority: string;
  omsStatus: string;
  awb: string | null;
  pickListId: string | null;
  shiprocketError: string | null;
};

type PickLine = {
  id: string;
  product_title: string;
  sku: string | null;
  batch_code: string | null;
  rack_location: string | null;
  qty_required: number;
  qty_picked: number;
  manually_verified: boolean;
};

type OrderDetail = {
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
  pickList: {
    id: string;
    pick_list_lines: PickLine[];
  } | null;
  packSession: {
    id: string;
    verified_rack: string | null;
    scan_complete: boolean;
    line_scan_counts: Record<string, number>;
  } | null;
  invoice: { id: string; invoice_number: string } | null;
  suggestedDispatchRack: string | null;
  printEnabled: boolean;
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

function priorityBadge(p: string) {
  if (p === 'high') return <Badge tone="warn">High</Badge>;
  if (p === 'low') return <Badge tone="muted">Low</Badge>;
  return <Badge tone="info">Normal</Badge>;
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
  const [scanMsg, setScanMsg] = useState('');
  const [scanPhase, setScanPhase] = useState<'rack' | 'product'>('rack');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const autoOpened = useRef(false);

  const loadQueue = useCallback(async () => {
    const [s, q] = await Promise.all([
      api<{ ok: boolean; stats: Stats }>(`${WMS_API}/fulfillment/stats`),
      api<{ ok: boolean; queue: QueueRow[] }>(`${WMS_API}/fulfillment/queue`),
    ]);
    setStats(s.stats);
    setQueue(q.queue ?? []);
  }, []);

  const loadDetail = useCallback(async (orderId: string, startSession = false) => {
    setSelectedId(orderId);
    setScanMsg('');
    setSuccess('');
    const d = await api<{ ok: boolean } & OrderDetail>(`${WMS_API}/fulfillment/orders/${orderId}`);
    setDetail(d);
    setScanPhase(d.packSession?.verified_rack ? 'product' : 'rack');

    if (d.packSession?.id) {
      setSessionId(d.packSession.id);
    } else if (canWrite && startSession && d.pickList) {
      const sess = await api<{ ok: boolean; session: { id: string } }>(
        `${WMS_API}/fulfillment/orders/${orderId}/pack-session`,
        { method: 'POST' }
      );
      setSessionId(sess.session.id);
      setScanPhase('rack');
    } else {
      setSessionId('');
    }
  }, [canWrite]);

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

  async function scan() {
    if (!sessionId || !scanCode.trim()) return;
    setScanMsg('');
    const r = await api<{
      ok: boolean;
      error?: string;
      phase?: string;
      message?: string;
      scanComplete?: boolean;
      printEnabled?: boolean;
    }>(`${WMS_API}/fulfillment/pack-sessions/${sessionId}/scan`, {
      method: 'POST',
      body: JSON.stringify({ code: scanCode.trim() }),
    });
    if (r.ok) {
      setScanMsg(r.message ?? 'OK');
      if (r.phase === 'rack') setScanPhase('product');
      if (selectedId) await loadDetail(selectedId);
    } else {
      setScanMsg(r.error ?? 'Scan failed');
    }
    setScanCode('');
  }

  async function runAction(
    path: string,
    okMsg: string,
    method: 'POST' = 'POST',
    body?: Record<string, unknown>
  ) {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/fulfillment/orders/${selectedId}${path}`, {
        method,
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

  async function reportException(type: string) {
    await runAction('/exception', `Logged: ${type}`, 'POST', { type });
  }

  const printEnabled = Boolean(detail?.printEnabled || detail?.packSession?.scan_complete);
  const order = detail?.order;
  const lines = detail?.pickList?.pick_list_lines ?? [];
  const counts = detail?.packSession?.line_scan_counts ?? {};

  if (loading && !stats) return <Loading label="Loading fulfillment…" />;

  return (
    <div className="warehouse-fulfillment">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

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
        <Panel title="Order queue" className="fulfillment-col fulfillment-col--queue">
          {queue.length === 0 ? <EmptyState>No orders in fulfillment.</EmptyState> : null}
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Courier</th>
                  <th>Items</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr
                    key={row.id}
                    className={selectedId === row.id ? 'fulfillment-row--active' : ''}
                    onClick={() => void loadDetail(row.id, true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadDetail(row.id, true);
                    }}
                  >
                    <td>
                      <span className="mono">{row.orderName}</span>
                      {row.shiprocketError ? (
                        <span className="fulfillment-err-hint" title={row.shiprocketError}>
                          ⚠
                        </span>
                      ) : null}
                    </td>
                    <td>{row.courier}</td>
                    <td>{row.itemCount}</td>
                    <td>{priorityBadge(row.priority)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>

        <Panel title="Picking instructions" className="fulfillment-col fulfillment-col--pick">
          {!detail ? (
            <EmptyState>Select an order from the queue.</EmptyState>
          ) : (
            <>
              <p className="fulfillment-order-meta muted">
                {order?.order_name ?? selectedId.slice(0, 8)} · {order?.oms_status}
                {order?.tracking_awb ? (
                  <>
                    {' '}
                    · AWB <span className="mono">{order.tracking_awb}</span>
                  </>
                ) : null}
              </p>
              {canWrite ? (
                <div className="warehouse-scan-block">
                  <p className="muted">
                    {scanPhase === 'rack'
                      ? 'Step 1 — scan rack location'
                      : 'Step 2 — scan product / batch barcode'}
                  </p>
                  <BarcodeScanInput
                    value={scanCode}
                    onChange={setScanCode}
                    onScan={() => void scan()}
                    placeholder={
                      scanPhase === 'rack' ? 'Scan rack (e.g. A-02)' : 'Scan product or batch'
                    }
                  />
                  {scanMsg ? <span className="scan-msg">{scanMsg}</span> : null}
                </div>
              ) : null}
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Rack</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Scan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const scanned = counts[l.id] ?? 0;
                      const done = l.manually_verified || scanned >= l.qty_required;
                      return (
                        <tr key={l.id}>
                          <td className="mono">{l.rack_location ?? '—'}</td>
                          <td>
                            {l.product_title}
                            {l.batch_code ? (
                              <span className="muted"> · {l.batch_code}</span>
                            ) : null}
                          </td>
                          <td>{l.qty_required}</td>
                          <td>{done ? '✅' : `${scanned}/${l.qty_required}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableWrap>
            </>
          )}
        </Panel>

        <Panel title="Shipping actions" className="fulfillment-col fulfillment-col--ship">
          {!detail || !order ? (
            <EmptyState>Select an order to ship.</EmptyState>
          ) : (
            <div className="fulfillment-actions">
              {order.shiprocket_error ? (
                <Alert tone="warn">{order.shiprocket_error}</Alert>
              ) : null}
              {order.dispatch_rack ? (
                <p>
                  Dispatch rack: <strong>{order.dispatch_rack}</strong>
                  {detail.suggestedDispatchRack && !order.dispatch_rack ? (
                    <span className="muted"> (suggested {detail.suggestedDispatchRack})</span>
                  ) : null}
                </p>
              ) : detail.suggestedDispatchRack ? (
                <p className="muted">Suggested rack: {detail.suggestedDispatchRack}</p>
              ) : null}

              <div className="fulfillment-btn-stack">
                {canWrite ? (
                  <Btn
                    size="sm"
                    variant="secondary"
                    disabled={busy || Boolean(order.tracking_awb)}
                    onClick={() => void runAction('/generate-awb', 'AWB generated')}
                  >
                    Generate AWB
                  </Btn>
                ) : null}
                {order.label_url ? (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={order.label_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Shiprocket label PDF
                  </a>
                ) : null}
                <Link
                  className={`btn btn-secondary btn-sm${printEnabled ? '' : ' btn--disabled'}`}
                  to={printEnabled ? printUrl('courier_label', order.id) : '#'}
                  target="_blank"
                  onClick={(e) => {
                    if (!printEnabled) e.preventDefault();
                  }}
                >
                  Print label
                </Link>
                <Link
                  className={`btn btn-secondary btn-sm${printEnabled && detail.invoice ? '' : ' btn--disabled'}`}
                  to={
                    printEnabled && detail.invoice
                      ? printUrl('tax_invoice', detail.invoice.id)
                      : '#'
                  }
                  target="_blank"
                  onClick={(e) => {
                    if (!printEnabled || !detail.invoice) e.preventDefault();
                  }}
                >
                  Print invoice
                </Link>
                {canWrite ? (
                  <>
                    <Btn
                      size="sm"
                      disabled={busy || !printEnabled}
                      onClick={() => void runAction('/mark-label-printed', 'Label printed — ready dispatch')}
                    >
                      Label printed
                    </Btn>
                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={busy || !printEnabled}
                      onClick={() => void runAction('/mark-packed', 'Order packed')}
                    >
                      Mark packed
                    </Btn>
                  </>
                ) : null}
              </div>

              {!printEnabled && canWrite ? (
                <p className="muted fulfillment-hint">
                  Complete rack + product scans to enable print and pack.
                </p>
              ) : null}

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
                        onClick={() => void reportException(ex.type)}
                      >
                        {ex.label}
                      </Btn>
                    ))}
                  </div>
                </div>
              ) : null}

              {order.oms_status === 'ready_dispatch' || order.oms_status === 'packed' ? (
                <div className="fulfillment-dispatch">
                  <p className="muted">After packing, move to dispatch rack. Scan AWB at courier pickup.</p>
                  <Link
                    className="btn btn-secondary btn-sm"
                    to={printUrl('courier_label', order.id)}
                    target="_blank"
                  >
                    Reprint label
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
