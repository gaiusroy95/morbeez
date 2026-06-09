import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSyncConsoleSearch } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { paths, toPath } from '../lib/routes';
import { useAuth } from '../context/AuthContext';
import { HubTabs } from '../components/ui';
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

function isCommerceTab(value: string | null): value is Tab {
  return (
    value === 'products' ||
    value === 'inventory' ||
    value === 'farmers' ||
    value === 'orders' ||
    value === 'logistics' ||
    value === 'offers' ||
    value === 'combos' ||
    value === 'flash' ||
    value === 'banners'
  );
}

export function CommerceHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const { can } = useAuth();
  const canWarehouse = can('warehouse', 'read');
  const canWarehouseWrite = can('warehouse', 'write');
  const canSeo = can('seo', 'read');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(() => (isCommerceTab(tabFromUrl) ? tabFromUrl : 'products'));
  const [search, setSearch] = useState('');
  const searchDefaults = defaultsForPage('commerce');
  useSyncConsoleSearch(
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search orders, farmers, products…'
  );
  useEffect(() => {
    if (isCommerceTab(tabFromUrl)) setTab(tabFromUrl);
  }, [tabFromUrl]);

  const onTabChange = useCallback(
    (next: Tab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams);
      if (next === 'products') params.delete('tab');
      else params.set('tab', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

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
      <HubTabs tabs={TABS} active={tab} onChange={onTabChange} />
      {tab === 'products' ? <CommerceAllProductsPanel canWrite={canWrite} /> : null}
      {tab === 'inventory' ? (
        <CommerceInventoryPanel canWrite={canWrite} canWarehouseWrite={canWarehouseWrite} />
      ) : null}
      {tab === 'farmers' ? <CommerceFarmersPanel /> : null}
      {tab === 'orders' ? <CommerceOrdersPanel canWrite={canWrite} /> : null}
      {tab === 'offers' ? <CommerceOffersPanel canWrite={canWrite} /> : null}
      {tab === 'combos' ? <CommerceCombosPanel canWrite={canWrite} /> : null}
      {tab === 'flash' ? <CommerceFlashSalesPanel canWrite={canWrite} /> : null}
      {tab === 'logistics' ? <CommerceLogisticsPanel canWrite={canWrite} /> : null}
      {tab === 'banners' ? <CommerceBannersPanel canWrite={canWrite} /> : null}

    </div>
  );
}
