import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { Alert, Badge, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';

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

export function WarehouseOmsPanel({
  canWrite,
  focusOrderId,
}: {
  canWrite: boolean;
  focusOrderId?: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [orders, setOrders] = useState<OmsOrder[]>([]);
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [selectedPick, setSelectedPick] = useState<PickList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const autoOpenedPick = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orderParams = statusFilter ? `?omsStatus=${encodeURIComponent(statusFilter)}` : '';
      const [ord, picks] = await Promise.all([
        api<{ ok: boolean; orders: OmsOrder[] }>(`${WMS_API}/orders${orderParams}`),
        api<{ ok: boolean; pickLists: PickList[] }>(`${WMS_API}/pick-lists`),
      ]);
      setOrders(ord.orders ?? []);
      setPickLists(picks.pickLists ?? []);
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

  async function openPick(id: string) {
    const d = await api<{ ok: boolean; pickList: PickList }>(`${WMS_API}/pick-lists/${id}`);
    setSelectedPick(d.pickList);
  }

  async function confirmOrder(id: string) {
    await api(`${WMS_API}/orders/${id}/confirm`, { method: 'POST' });
    await load();
  }

  const OMS_STATUSES = ['', 'pending', 'confirmed', 'picking', 'packed', 'shipped', 'delivered'];

  return (
    <div className="warehouse-oms">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}

      <Panel
        title="OMS orders"
        actions={
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {OMS_STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
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
                          Confirm
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
                    <td>{p.pick_list_lines?.length ?? 0}</td>
                    <td>
                      <Btn size="sm" variant="secondary" onClick={() => void openPick(p.id)}>
                        View
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
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Rack</th>
                  <th>Qty</th>
                  <th>Picked</th>
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
                    <td>{l.qty_picked}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>
      ) : null}
    </div>
  );
}
