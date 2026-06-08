import { paths, toPath } from './routes';

export type WarehouseDeepTab =
  | 'overview'
  | 'stock'
  | 'inbound'
  | 'fulfillment'
  | 'returns'
  | 'finance';

/** @deprecated Use fulfillment */
export type LegacyWarehouseTab = 'orders' | 'pack';

const WAREHOUSE_TABS = new Set<WarehouseDeepTab>([
  'overview',
  'stock',
  'inbound',
  'fulfillment',
  'returns',
  'finance',
]);

export function isWarehouseTab(value: string | null | undefined): value is WarehouseDeepTab {
  if (!value) return false;
  if (value === 'orders' || value === 'pack') return true;
  return WAREHOUSE_TABS.has(value as WarehouseDeepTab);
}

export function normalizeWarehouseTab(value: string | null | undefined): WarehouseDeepTab {
  if (value === 'orders' || value === 'pack') return 'fulfillment';
  if (value && WAREHOUSE_TABS.has(value as WarehouseDeepTab)) return value as WarehouseDeepTab;
  return 'overview';
}

/** Pick the most useful warehouse tab for an OMS workflow status. */
export function warehouseTabForOmsStatus(omsStatus?: string | null): WarehouseDeepTab {
  if (!omsStatus) return 'fulfillment';
  if (
    omsStatus === 'picking' ||
    omsStatus === 'awb_generated' ||
    omsStatus === 'packed' ||
    omsStatus === 'ready_dispatch'
  ) {
    return 'fulfillment';
  }
  return 'fulfillment';
}

export function buildWarehouseOrderUrl(
  orderId: string,
  opts?: { tab?: WarehouseDeepTab | LegacyWarehouseTab; omsStatus?: string | null }
): string {
  const params = new URLSearchParams();
  const tab = normalizeWarehouseTab(opts?.tab ?? warehouseTabForOmsStatus(opts?.omsStatus));
  if (tab !== 'overview') params.set('tab', tab);
  params.set('order', orderId);
  const qs = params.toString();
  return `${toPath(paths.warehouse)}${qs ? `?${qs}` : ''}`;
}
