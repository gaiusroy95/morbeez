import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HubTabs, ReadOnlyBanner } from '../components/ui';
import { WarehouseStockPanel } from '../components/warehouse/WarehouseStockPanel';
import { WarehouseInboundPanel } from '../components/warehouse/WarehouseInboundPanel';
import { WarehouseFulfillmentHub } from '../components/warehouse/WarehouseFulfillmentHub';
import { WarehouseFinancePanel } from '../components/warehouse/WarehouseFinancePanel';
import { WarehouseReturnsPanel } from '../components/warehouse/WarehouseReturnsPanel';
import { WarehouseOverviewPanel } from '../components/warehouse/WarehouseOverviewPanel';
import { WarehousePackagingPanel } from '../components/warehouse/WarehousePackagingPanel';
import { isWarehouseTab, normalizeWarehouseTab, type WarehouseDeepTab } from '../lib/warehouse-links';
import '../styles/warehouse-hub.css';
import '../styles/fulfillment.css';

type Tab = WarehouseDeepTab;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'stock', label: 'Fulfillment stock' },
  { id: 'inbound', label: 'Purchase & GRN' },
  { id: 'fulfillment', label: 'Fulfillment' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'returns', label: 'Returns & refunds' },
  { id: 'finance', label: 'Finance & COD' },
];

export function WarehouseHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderFromUrl = searchParams.get('order');
  const tabFromUrl = searchParams.get('tab');

  const [tab, setTab] = useState<Tab>(() => {
    if (isWarehouseTab(tabFromUrl)) return normalizeWarehouseTab(tabFromUrl);
    if (orderFromUrl) return 'fulfillment';
    return 'overview';
  });

  useEffect(() => {
    if (isWarehouseTab(tabFromUrl)) {
      setTab(normalizeWarehouseTab(tabFromUrl));
    } else if (orderFromUrl) {
      setTab('fulfillment');
    }
  }, [tabFromUrl, orderFromUrl]);

  const onTabChange = useCallback(
    (next: Tab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams);
      if (next === 'overview') params.delete('tab');
      else params.set('tab', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return (
    <div className="warehouse-hub">
      {tab !== 'fulfillment' ? (
        <p className="warehouse-hub-intro muted">
          Warehouse fulfillment — auto AWB on confirm, pick + pack with scan verification, thermal
          labels via Shiprocket.
        </p>
      ) : null}
      {orderFromUrl ? (
        <p className="warehouse-hub-focus muted">
          Focused order: <span className="mono">{orderFromUrl}</span>
        </p>
      ) : null}
      {!canWrite ? <ReadOnlyBanner /> : null}
      <HubTabs tabs={TABS} active={tab} onChange={onTabChange} />
      {tab === 'overview' ? <WarehouseOverviewPanel /> : null}
      {tab === 'stock' ? <WarehouseStockPanel canWrite={canWrite} /> : null}
      {tab === 'inbound' ? <WarehouseInboundPanel canWrite={canWrite} /> : null}
      {tab === 'fulfillment' ? (
        <WarehouseFulfillmentHub canWrite={canWrite} focusOrderId={orderFromUrl} />
      ) : null}
      {tab === 'packaging' ? <WarehousePackagingPanel canWrite={canWrite} /> : null}
      {tab === 'returns' ? <WarehouseReturnsPanel canWrite={canWrite} /> : null}
      {tab === 'finance' ? <WarehouseFinancePanel canWrite={canWrite} /> : null}
    </div>
  );
}
