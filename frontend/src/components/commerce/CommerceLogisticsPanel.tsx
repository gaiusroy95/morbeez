import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  TableWrap,
} from '../ui';
import { WarehouseOrderLink } from '../warehouse/WarehouseOrderLink';
import { useAuth } from '../../context/AuthContext';

type Overview = {
  configured: boolean;
  autoShipEnabled: boolean;
  dashboardUrl: string;
  webhookPath: string;
  webhookUrl: string | null;
  pendingCount: number;
  latestEventAt: string | null;
};

type PendingOrder = {
  id: string;
  shopifyOrderId: string;
  displayOrderId: string;
  orderName: string | null;
  phone: string | null;
  amount: number;
  createdAt: string;
};

type ShipmentEvent = {
  id: string;
  shopifyOrderId: string | null;
  awb: string | null;
  courier: string | null;
  status: string | null;
  eventType: string | null;
  createdAt: string;
  orderName: string | null;
  phone: string | null;
};

type Props = { canWrite: boolean };

export function CommerceLogisticsPanel({ canWrite }: Props) {
  const { can } = useAuth();
  const canWarehouse = can('warehouse', 'read');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, pend, ev] = await Promise.all([
        api<Overview & { ok: boolean }>('/morbeez-staff/api/v1/logistics/overview'),
        api<{ ok: boolean; pending: PendingOrder[] }>(
          '/morbeez-staff/api/v1/logistics/pending?limit=30'
        ),
        api<{ ok: boolean; events: ShipmentEvent[] }>(
          '/morbeez-staff/api/v1/logistics/events?limit=25'
        ),
      ]);
      setOverview(ov);
      setPending(pend.pending ?? []);
      setEvents(ev.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryShipment(shopifyOrderId: string) {
    if (!canWrite) return;
    setRetryingId(shopifyOrderId);
    setError('');
    setSuccessMsg('');
    try {
      const r = await api<{
        ok: boolean;
        trackingAwb: string | null;
        shipmentId: string | null;
      }>(`/morbeez-staff/api/v1/logistics/shipments/${encodeURIComponent(shopifyOrderId)}/retry`, {
        method: 'POST',
      });
      setSuccessMsg(
        r.trackingAwb
          ? `Shipment created — AWB ${r.trackingAwb}`
          : 'Shipment request sent to Shiprocket'
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create shipment');
    } finally {
      setRetryingId(null);
    }
  }

  if (loading) return <Loading label="Loading logistics…" />;

  return (
    <div className="commerce-logistics">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {successMsg ? <Alert tone="success">{successMsg}</Alert> : null}

      {overview ? (
        <div className="commerce-stats-row">
          <div className="commerce-stat-card">
            <strong>{overview.pendingCount}</strong>
            <span>Awaiting shipment</span>
          </div>
          <div className="commerce-stat-card">
            <strong>{overview.configured ? 'Yes' : 'No'}</strong>
            <span>Shiprocket API configured</span>
          </div>
          <div className="commerce-stat-card">
            <strong>{overview.autoShipEnabled ? 'On' : 'Off'}</strong>
            <span>Auto-ship on paid order</span>
          </div>
        </div>
      ) : null}

      {!overview?.configured ? (
        <Alert tone="warn">
          Set <code>SHIPROCKET_EMAIL</code> and <code>SHIPROCKET_PASSWORD</code> on the API server to
          create shipments from the console.
        </Alert>
      ) : null}

      <Alert tone="info">
        Shiprocket webhook URL:{' '}
        <code>{overview?.webhookUrl ?? overview?.webhookPath ?? '/webhooks/tracking'}</code>
        {' '}(must not contain shiprocket/sr/kr in the path).{' '}
        {overview?.dashboardUrl ? (
          <a href={overview.dashboardUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
            Open Shiprocket dashboard
          </a>
        ) : null}
      </Alert>

      <Panel
        title="Pending dispatch queue"
        description="Paid Shopify orders without an AWB yet. With Ship-after-pack enabled, fulfill in Warehouse first."
        actions={
          <Btn variant="secondary" onClick={() => void load()}>
            Refresh
          </Btn>
        }
        className="mb-5"
      >
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Order</th>
                <th>Phone</th>
                <th>Amount</th>
                <th>Created</th>
                {canWarehouse ? <th>Warehouse</th> : null}
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.length ? (
                pending.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.displayOrderId}</strong>
                      <br />
                      <small className="muted">{o.shopifyOrderId}</small>
                    </td>
                    <td>{o.phone ?? '—'}</td>
                    <td>₹{o.amount.toLocaleString('en-IN')}</td>
                    <td>
                      <small className="muted">
                        {new Date(o.createdAt).toLocaleString('en-IN')}
                      </small>
                    </td>
                    {canWarehouse ? (
                      <td>
                        <WarehouseOrderLink orderId={o.id} tab="pack" compact />
                      </td>
                    ) : null}
                    <td>
                      {canWrite && overview?.configured ? (
                        <Btn
                          variant="primary"
                          disabled={retryingId === o.shopifyOrderId}
                          onClick={() => void retryShipment(o.shopifyOrderId)}
                        >
                          {retryingId === o.shopifyOrderId ? 'Sending…' : 'Create shipment'}
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canWarehouse ? 6 : 5}>
                    <EmptyState>No orders waiting for shipment.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableWrap>
      </Panel>

      <Panel title="Recent tracking events">
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>When</th>
                <th>Order</th>
                <th>AWB</th>
                <th>Courier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.length ? (
                events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <small className="muted">
                        {new Date(e.createdAt).toLocaleString('en-IN')}
                      </small>
                    </td>
                    <td>{e.orderName ?? e.shopifyOrderId ?? '—'}</td>
                    <td>{e.awb ?? '—'}</td>
                    <td>{e.courier ?? '—'}</td>
                    <td>{e.status ?? e.eventType ?? '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>No shipment events logged yet.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableWrap>
      </Panel>
    </div>
  );
}
