import { paths, toPath } from './routes';

export type WarehouseDeepTab = 'overview' | 'stock' | 'inbound' | 'orders' | 'pack' | 'finance';

const WAREHOUSE_TABS = new Set<WarehouseDeepTab>([
  'overview',
  'stock',
  'inbound',
  'orders',
  'pack',
  'finance',
]);

export function isWarehouseTab(value: string | null | undefined): value is WarehouseDeepTab {
  return Boolean(value && WAREHOUSE_TABS.has(value as WarehouseDeepTab));
}

/** Pick the most useful warehouse tab for an OMS workflow status. */
export function warehouseTabForOmsStatus(omsStatus?: string | null): WarehouseDeepTab {
  if (!omsStatus) return 'orders';
  if (omsStatus === 'picking') return 'pack';
  if (omsStatus === 'packed') return 'pack';
  return 'orders';
}

export function buildWarehouseOrderUrl(
  orderId: string,
  opts?: { tab?: WarehouseDeepTab; omsStatus?: string | null }
): string {
  const params = new URLSearchParams();
  const tab = opts?.tab ?? warehouseTabForOmsStatus(opts?.omsStatus);
  if (tab !== 'orders') params.set('tab', tab);
  params.set('order', orderId);
  const qs = params.toString();
  return `${toPath(paths.warehouse)}${qs ? `?${qs}` : ''}`;
}
