import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSyncConsoleSearch } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { paths, toPath } from '../lib/routes';
import { useAuth } from '../context/AuthContext';
import { HubTabs } from '../components/ui';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { CommerceAllProductsPanel } from '../components/commerce/CommerceAllProductsPanel';
import { CommerceInventoryPanel } from '../components/commerce/CommerceInventoryPanel';
import { CommerceFarmersPanel } from '../components/commerce/CommerceFarmersPanel';
import { CommerceOrdersPanel } from '../components/commerce/CommerceOrdersPanel';
import { CommerceOffersPanel } from '../components/commerce/CommerceOffersPanel';
import { CommerceCombosPanel } from '../components/commerce/CommerceCombosPanel';
import { CommerceFlashSalesPanel } from '../components/commerce/CommerceFlashSalesPanel';
import { CommerceLogisticsPanel } from '../components/commerce/CommerceLogisticsPanel';
import { CommerceBannersPanel } from '../components/commerce/CommerceBannersPanel';

type Tab =
  | 'products'
  | 'inventory'
  | 'farmers'
  | 'orders'
  | 'logistics'
  | 'offers'
  | 'combos'
  | 'flash'
  | 'banners';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'products', label: 'Products' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'farmers', label: 'Farmers' },
  { id: 'orders', label: 'Orders' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'offers', label: 'Offers' },
  { id: 'combos', label: 'Combos' },
  { id: 'flash', label: 'Flash sales' },
  { id: 'banners', label: 'Banners' },
];

export function CommerceHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const { can } = useAuth();
  const canWarehouse = can('warehouse', 'read');
  const canSeo = can('seo', 'read');
  const [tab, setTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const searchDefaults = defaultsForPage('commerce');
  useSyncConsoleSearch(
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search orders, farmers, products…'
  );
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const [ordersReload, setOrdersReload] = useState(0);

  async function archiveOrder(id: string, source?: string) {
    setConfirmModal({
      title: 'Archive order',
      body: 'Archive/cancel this order?',
      action: async () => {
        await api(`/morbeez-staff/api/v1/orders/${id}?source=${encodeURIComponent(source ?? 'shopify')}`, {
          method: 'DELETE',
        });
      },
    });
  }

  return (
    <div className="commerce-hub">
      {canSeo && tab === 'products' ? (
        <p className="commerce-hub-warehouse-bridge muted">
          Product SEO, crop problem pages, and Google visibility live in{' '}
          <Link to={toPath(paths.seo)} className="commerce-warehouse-link">
            SEO Control Panel
          </Link>
          .
        </p>
      ) : null}
      {canWarehouse && (tab === 'orders' || tab === 'logistics') ? (
        <p className="commerce-hub-warehouse-bridge muted">
          Fulfillment (pick, pack, GST invoice, COD) lives in{' '}
          <Link to={toPath(paths.warehouse)} className="commerce-warehouse-link">
            Warehouse & OMS
          </Link>
          . Order rows include a <strong>WMS</strong> shortcut when applicable.
        </p>
      ) : null}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {archiveError ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {archiveError}
        </p>
      ) : null}

      {tab === 'products' ? <CommerceAllProductsPanel canWrite={canWrite} /> : null}
      {tab === 'inventory' ? <CommerceInventoryPanel /> : null}
      {tab === 'farmers' ? <CommerceFarmersPanel /> : null}
      {tab === 'orders' ? (
        <CommerceOrdersPanel
          canWrite={canWrite}
          onArchive={archiveOrder}
          reloadToken={ordersReload}
        />
      ) : null}
      {tab === 'offers' ? <CommerceOffersPanel canWrite={canWrite} /> : null}
      {tab === 'combos' ? <CommerceCombosPanel canWrite={canWrite} /> : null}
      {tab === 'flash' ? <CommerceFlashSalesPanel canWrite={canWrite} /> : null}
      {tab === 'logistics' ? <CommerceLogisticsPanel canWrite={canWrite} /> : null}
      {tab === 'banners' ? <CommerceBannersPanel canWrite={canWrite} /> : null}

      {confirmModal ? (
        <Modal
          title={confirmModal.title}
          onClose={() => setConfirmModal(null)}
          onSave={async () => {
            try {
              setArchiveError('');
              await confirmModal.action();
              setConfirmModal(null);
              setOrdersReload((n) => n + 1);
            } catch (e) {
              setArchiveError(e instanceof Error ? e.message : 'Action failed');
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
