import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HubTabs, ReadOnlyBanner } from '../components/ui';
import { WarehouseStockPanel } from '../components/warehouse/WarehouseStockPanel';
import { WarehouseInboundPanel } from '../components/warehouse/WarehouseInboundPanel';
import { WarehouseOmsPanel } from '../components/warehouse/WarehouseOmsPanel';
import { WarehousePackPanel } from '../components/warehouse/WarehousePackPanel';
import { WarehouseFinancePanel } from '../components/warehouse/WarehouseFinancePanel';
import { WarehouseOverviewPanel } from '../components/warehouse/WarehouseOverviewPanel';
import { isWarehouseTab, type WarehouseDeepTab } from '../lib/warehouse-links';
import '../styles/warehouse-hub.css';

type Tab = WarehouseDeepTab;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'stock', label: 'Stock' },
  { id: 'inbound', label: 'Purchase & GRN' },
  { id: 'orders', label: 'Orders & pick' },
  { id: 'pack', label: 'Pack & verify' },
  { id: 'finance', label: 'Finance & COD' },
];

export function WarehouseHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderFromUrl = searchParams.get('order');
  const tabFromUrl = searchParams.get('tab');

  const [tab, setTab] = useState<Tab>(() => {
    if (isWarehouseTab(tabFromUrl)) return tabFromUrl;
    if (orderFromUrl) return 'orders';
    return 'overview';
  });

  useEffect(() => {
    if (isWarehouseTab(tabFromUrl)) {
      setTab(tabFromUrl);
    } else if (orderFromUrl) {
      setTab('orders');
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
      <p className="warehouse-hub-intro muted">
        Warehouse & order fulfillment — batch stock, pick lists, GST invoices, Shiprocket after pack.
      </p>
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
      {tab === 'orders' ? (
        <WarehouseOmsPanel canWrite={canWrite} focusOrderId={orderFromUrl} />
      ) : null}
      {tab === 'pack' ? (
        <WarehousePackPanel canWrite={canWrite} focusOrderId={orderFromUrl} />
      ) : null}
      {tab === 'finance' ? <WarehouseFinancePanel canWrite={canWrite} /> : null}
    </div>
  );
}
