import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSyncConsoleSearch } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import {
  Alert,
  DataTable,
  EmptyState,
  HubTabs,
  Loading,
  Panel,
  TableWrap,
} from '../components/ui';
import { Modal } from '../components/Modal';
import { CommerceAllProductsPanel } from '../components/commerce/CommerceAllProductsPanel';

type Tab = 'orders' | 'farmers' | 'products' | 'inventory';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'orders', label: 'Orders' },
  { id: 'farmers', label: 'Farmers' },
  { id: 'products', label: 'Products' },
  { id: 'inventory', label: 'Inventory' },
];

export function CommerceHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const [tab, setTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const searchDefaults = defaultsForPage('commerce');
  useSyncConsoleSearch(
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search orders, farmers, products…'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [farmers, setFarmers] = useState<Array<Record<string, unknown>>>([]);
  const [inventory, setInventory] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    if (tab === 'products') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const q = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
    try {
      if (tab === 'orders') {
        const d = await api<{ ok: boolean; orders: Array<Record<string, unknown>> }>(
          `/morbeez-staff/api/v1/orders?limit=40${q}`
        );
        setOrders(d.orders ?? []);
      } else if (tab === 'farmers') {
        const d = await api<{ ok: boolean; farmers: Array<Record<string, unknown>> }>(
          `/morbeez-staff/api/v1/farmers?limit=40${q}`
        );
        setFarmers(d.farmers ?? []);
      } else {
        const d = await api<{ ok: boolean; rows: Array<Record<string, unknown>> }>(
          `/morbeez-staff/api/v1/inventory?limit=40${q}`
        );
        setInventory(d.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  async function archiveOrder(id: string, source?: string) {
    setConfirmModal({
      title: 'Archive order',
      body: 'Archive/cancel this order?',
      action: async () => {
        await api(`/morbeez-staff/api/v1/orders/${id}?source=${encodeURIComponent(source ?? 'shopify')}`, {
          method: 'DELETE',
        });
        await load();
      },
    });
  }

  async function archiveFarmer(id: string) {
    setConfirmModal({
      title: 'Archive farmer',
      body: 'Archive this farmer?',
      action: async () => {
        await api(`/morbeez-staff/api/v1/farmers/${id}`, { method: 'DELETE' });
        await load();
      },
    });
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="commerce-hub">
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab !== 'products' && error ? <Alert tone="error">{error}</Alert> : null}
      {tab !== 'products' && loading ? <Loading /> : null}

      {!loading && tab === 'orders' ? (
        <Panel title="Orders">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Farmer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.length ? (
                  orders.map((o) => (
                    <tr key={String(o.id)}>
                      <td>{String(o.displayOrderId ?? o.id)}</td>
                      <td>
                        {String(o.farmerName ?? '—')}
                        <br />
                        <small className="muted">{String(o.phone ?? '')}</small>
                      </td>
                      <td>₹{String(o.totalAmount ?? 0)}</td>
                      <td>{String(o.status ?? '—')}</td>
                      <td>{String(o.paymentLabel ?? '—')}</td>
                      <td>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => archiveOrder(String(o.id), String(o.source ?? 'shopify'))}
                          >
                            Archive
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState>No orders found.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>
      ) : null}

      {!loading && tab === 'farmers' ? (
        <Panel title="Farmers">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>District</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr key={String(f.id)}>
                    <td>{String(f.displayName ?? '—')}</td>
                    <td>{String(f.phone ?? '—')}</td>
                    <td>{String(f.district ?? '—')}</td>
                    <td>{String(f.status ?? '—')}</td>
                    <td>
                      {canWrite ? (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => archiveFarmer(String(f.id))}
                        >
                          Archive
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'products' ? <CommerceAllProductsPanel canWrite={canWrite} /> : null}

      {!loading && tab === 'inventory' ? (
        <Panel title="Inventory">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((r, i) => (
                  <tr key={i}>
                    <td>{String(r.title ?? '—')}</td>
                    <td>{String(r.batchNo ?? r.sku ?? '—')}</td>
                    <td>{String(r.stock ?? r.inventory ?? 0)}</td>
                    <td>{String(r.status ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>
      ) : null}
      {confirmModal ? (
        <Modal
          title={confirmModal.title}
          onClose={() => setConfirmModal(null)}
          onSave={async () => {
            try {
              await confirmModal.action();
              setConfirmModal(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Action failed');
            }
          }}
          saveLabel="Confirm"
        >
          <p className="text-sm text-slate-700">{confirmModal.body}</p>
        </Modal>
      ) : null}
    </div>
  );
}
