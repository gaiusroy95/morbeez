import type { OrderTimelineStep, QueueOrder, WarehouseMobileModule, WarehouseOrderDetail } from '../types/warehouse';

const PICKING_STATUSES = new Set(['assigned', 'confirmed', 'awb_generated', 'picking']);
const PACKING_STATUSES = new Set(['packing', 'awaiting_label_verification', 'packaging_estimated']);
const DISPATCH_STATUSES = new Set(['ready_dispatch']);
const LR_STATUSES = new Set(['awaiting_tracking']);

export function queueFilterBucket(row: QueueOrder): 'pending' | 'packed' | 'lr_pending' | 'completed' {
  const status = row.omsStatus;
  if (status === 'awaiting_tracking' || row.needsManualTracking) return 'lr_pending';
  if (['ready_dispatch', 'shipped', 'delivered', 'completed'].includes(status)) return 'completed';
  if (['packed', 'awaiting_label_verification'].includes(status)) return 'packed';
  return 'pending';
}

export function isPickingQueueOrder(row: QueueOrder): boolean {
  if (row.stockIssue) return true;
  if (PICKING_STATUSES.has(row.omsStatus)) return true;
  if (row.omsStatus === 'packing' && row.pickListId) return true;
  return queueFilterBucket(row) === 'pending' && Boolean(row.pickListId);
}

export type PickQueueTab = 'all' | 'in_progress' | 'on_hold';

export function filterPickQueue(rows: QueueOrder[], tab: PickQueueTab): QueueOrder[] {
  const base = rows.filter(isPickingQueueOrder);
  if (tab === 'all') return base;
  if (tab === 'on_hold') return base.filter((r) => Boolean(r.stockIssue));
  return base.filter((r) => !r.stockIssue && (r.omsStatus === 'picking' || r.omsStatus === 'assigned'));
}

export function filterPackQueue(rows: QueueOrder[]): QueueOrder[] {
  return rows.filter(
    (r) =>
      PACKING_STATUSES.has(r.omsStatus) ||
      (r.omsStatus === 'packed' && !r.awb) ||
      queueFilterBucket(r) === 'packed'
  );
}

export function filterDispatchQueue(rows: QueueOrder[]): QueueOrder[] {
  return rows.filter((r) => DISPATCH_STATUSES.has(r.omsStatus));
}

export function filterLrPending(rows: QueueOrder[]): QueueOrder[] {
  return rows.filter((r) => LR_STATUSES.has(r.omsStatus) || r.needsManualTracking);
}

export function warehouseModulesForRole(role: string | undefined): WarehouseMobileModule[] {
  const r = (role ?? '').toLowerCase();
  if (r === 'picker_packer' || r === 'picker') return ['picking', 'more'];
  if (r === 'packer') return ['packing', 'more'];
  if (r === 'dispatcher') return ['dispatch', 'more'];
  return ['dashboard', 'picking', 'packing', 'dispatch', 'more'];
}

export function isWarehouseManagerRole(role: string | undefined): boolean {
  const r = (role ?? '').toLowerCase();
  return ['manager', 'admin', 'super_admin', 'warehouse', 'operations'].includes(r);
}

export function buildOrderTimeline(detail: WarehouseOrderDetail): OrderTimelineStep[] {
  const o = detail.order;
  const status = o.oms_status;
  const rank = (s: string) => {
    const order = [
      'pending',
      'confirmed',
      'assigned',
      'picking',
      'packing',
      'packed',
      'awaiting_label_verification',
      'ready_dispatch',
      'awaiting_tracking',
      'shipped',
      'delivered',
      'completed',
    ];
    const i = order.indexOf(s);
    return i >= 0 ? i : 0;
  };
  const cur = rank(status);
  const step = (
    key: string,
    label: string,
    threshold: string,
    at: string | null | undefined,
    detailText?: string | null
  ) => {
    const t = rank(threshold);
    let st: OrderTimelineStep['status'] = 'pending';
    if (cur > t || (cur === t && ['delivered', 'completed', 'shipped'].includes(status))) st = 'done';
    else if (cur === t || (key === 'picking' && PICKING_STATUSES.has(status))) st = 'current';
    if (cur > t) st = 'done';
    if (['delivered', 'completed'].includes(status) && key !== 'delivered') st = 'done';
    return { key, label, status: st, at: at ?? null, detail: detailText ?? null };
  };

  return [
    step('created', 'Created', 'pending', o.created_at, o.order_name),
    step('picking', 'Picking', 'picking', detail.assignment?.pickingStartedAt),
    step('packing', 'Packing', 'packing', detail.package?.confirmedAt),
    step('dispatch', 'Dispatched', 'ready_dispatch', o.shipped_at, o.tracking_awb),
    step('lr', 'LR Updated', 'awaiting_tracking', o.label_verified_at, o.courier_name),
    step('transit', 'In Transit', 'shipped', o.shipped_at, o.tracking_status),
    step('delivered', 'Delivered', 'delivered', o.delivered_at),
  ];
}
