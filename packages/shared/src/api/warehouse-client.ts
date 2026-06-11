import { STAFF_API_V1, resolveStaffApiUrl } from './config';
import { staffApi } from './staff-client';
import { buildOrderTimeline } from './warehouse-queue';
import type {
  AssignableOrder,
  LabelBatch,
  LabelStackItem,
  LRUpdatePayload,
  OrderTimelineStep,
  PackForm,
  PickLookup,
  PrintDocType,
  PrintDocumentPayload,
  PrintableDoc,
  QueueOrder,
  ShippingBox,
  WarehouseEmployee,
  WarehouseMaster,
  WarehouseOrderDetail,
  WarehouseStats,
} from '../types/warehouse';

export {
  buildOrderTimeline,
  filterDispatchQueue,
  filterLrPending,
  filterPackQueue,
  filterPickQueue,
  isPickingQueueOrder,
  isWarehouseManagerRole,
  queueFilterBucket,
  warehouseModulesForRole,
  type PickQueueTab,
} from './warehouse-queue';

const WMS = `${STAFF_API_V1}/os/warehouse`;

export const warehouseClient = {
  async getStats(): Promise<WarehouseStats> {
    const r = await staffApi<{ ok: boolean; stats: WarehouseStats }>(`${WMS}/fulfillment/stats`);
    return r.stats;
  },

  async getQueue(opts?: { limit?: number; repair?: boolean }): Promise<QueueOrder[]> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.repair) params.set('repair', 'true');
    const q = params.toString();
    const r = await staffApi<{ ok: boolean; queue: QueueOrder[] }>(
      `${WMS}/fulfillment/queue${q ? `?${q}` : ''}`
    );
    return r.queue ?? [];
  },

  async syncInventory(): Promise<{ queue: QueueOrder[]; syncedQty?: number; repaired?: number; failed?: number }> {
    return staffApi(`${WMS}/fulfillment/sync-inventory`, { method: 'POST' });
  },

  async getOrder(orderId: string): Promise<WarehouseOrderDetail> {
    const r = await staffApi<{ ok: boolean } & WarehouseOrderDetail>(`${WMS}/fulfillment/orders/${orderId}`);
    return r;
  },

  async startPackSession(orderId: string): Promise<string> {
    const r = await staffApi<{ ok: boolean; session: { id: string } }>(
      `${WMS}/fulfillment/orders/${orderId}/pack-session`,
      { method: 'POST', body: '{}' }
    );
    return r.session.id;
  },

  async lookupBarcode(sessionId: string, code: string): Promise<PickLookup & { ok: boolean; error?: string }> {
    return staffApi(`${WMS}/fulfillment/pack-sessions/${sessionId}/lookup-barcode`, {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() }),
    });
  },

  async confirmPick(
    sessionId: string,
    lineId: string,
    qty: number
  ): Promise<{ ok: boolean; message?: string; stage?: string }> {
    return staffApi(`${WMS}/fulfillment/pack-sessions/${sessionId}/confirm-pick`, {
      method: 'POST',
      body: JSON.stringify({ lineId, qty }),
    });
  },

  async verifyLabel(
    orderId: string,
    code: string
  ): Promise<{ ok: boolean; matched: boolean; error?: string; message?: string }> {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/verify-label`, {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() }),
    });
  },

  async markPacked(orderId: string) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/mark-packed`, { method: 'POST', body: '{}' });
  },

  async markLabelPrinted(orderId: string) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/mark-label-printed`, { method: 'POST', body: '{}' });
  },

  async generateAwb(orderId: string, forceRecreate = false) {
    return staffApi<{ ok: boolean; error?: string; shipment?: { awb?: string | null } | null }>(
      `${WMS}/fulfillment/orders/${orderId}/generate-awb`,
      { method: 'POST', body: JSON.stringify({ forceRecreate }) }
    );
  },

  async assignDispatchRack(orderId: string, rack: string) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/dispatch-rack`, {
      method: 'POST',
      body: JSON.stringify({ rack }),
    });
  },

  async packageEstimate(orderId: string) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/package/estimate`, { method: 'POST', body: '{}' });
  },

  async packageConfirm(orderId: string, autoAwb = true) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/package/confirm`, {
      method: 'POST',
      body: JSON.stringify({ autoAwb }),
    });
  },

  async packageOverride(orderId: string, form: PackForm) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/package/override`, {
      method: 'POST',
      body: JSON.stringify({
        boxId: form.boxId,
        lengthCm: form.lengthCm,
        breadthCm: form.breadthCm,
        heightCm: form.heightCm,
        weightKg: form.weightKg,
      }),
    });
  },

  async rebuildPickList(orderId: string) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/rebuild-pick-list`, { method: 'POST', body: '{}' });
  },

  async fetchDocument(type: PrintDocType | string, id: string): Promise<PrintDocumentPayload> {
    return staffApi<PrintDocumentPayload>(`${WMS}/documents/${type}/${id}`);
  },

  async saveManualLogistics(orderId: string, payload: LRUpdatePayload) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/manual-logistics`, {
      method: 'POST',
      body: JSON.stringify({
        courierName: payload.courierName,
        trackingAwb: payload.trackingAwb,
        trackingUrl: payload.trackingUrl ?? null,
        notifyCustomer: payload.notifyCustomer ?? false,
      }),
    });
  },

  async getEmployees(): Promise<WarehouseEmployee[]> {
    const r = await staffApi<{ ok: boolean; employees: WarehouseEmployee[] }>(`${WMS}/fulfillment/employees`);
    return r.employees ?? [];
  },

  async getAssignableOrders(): Promise<AssignableOrder[]> {
    const r = await staffApi<{ ok: boolean; orders: AssignableOrder[] }>(
      `${WMS}/fulfillment/assignable-orders`
    );
    return r.orders ?? [];
  },

  async assignBatch(employeeId: string, employeeName: string, orderIds: string[]): Promise<LabelBatch> {
    const r = await staffApi<{ ok: boolean; batch: LabelBatch }>(`${WMS}/fulfillment/assign-batch`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, employeeName, orderIds }),
    });
    return r.batch;
  },

  async getLabelBatches(): Promise<LabelBatch[]> {
    const r = await staffApi<{ ok: boolean; batches: LabelBatch[] }>(`${WMS}/fulfillment/label-batches`);
    return r.batches ?? [];
  },

  async getLabelBatchDetail(batchId: string): Promise<{ batch: LabelBatch; labels: LabelStackItem[] }> {
    const r = await staffApi<{
      ok: boolean;
      batch: LabelBatch;
      labels: Array<{
        id: string;
        commerce_order_id: string;
        qr_code: string;
        print_sequence: number;
        awb: string | null;
        commerce_orders: { order_name?: string; shopify_order_id?: string } | null;
      }>;
    }>(`${WMS}/fulfillment/label-batches/${batchId}`);
    return {
      batch: r.batch,
      labels: (r.labels ?? []).map((l) => ({
        labelId: String(l.id),
        commerceOrderId: String(l.commerce_order_id),
        orderName:
          l.commerce_orders?.order_name ?? l.commerce_orders?.shopify_order_id ?? String(l.commerce_order_id),
        printSequence: Number(l.print_sequence),
        qrCode: String(l.qr_code),
        awb: l.awb,
        labelUrl: null,
        courier: null,
      })),
    };
  },

  async printLabelBatch(batchId: string): Promise<{ stack: LabelStackItem[]; trayNote: string; batch: LabelBatch }> {
    const r = await staffApi<{
      ok: boolean;
      stack: LabelStackItem[];
      trayNote: string;
      batch: LabelBatch;
    }>(`${WMS}/fulfillment/label-batches/${batchId}/print`, { method: 'POST', body: '{}' });
    return { stack: r.stack ?? [], trayNote: r.trayNote ?? '', batch: r.batch };
  },

  async startDispatchSession(orderId: string) {
    return staffApi<{ ok: boolean; session: { id: string } }>(`${WMS}/orders/${orderId}/dispatch-session`, {
      method: 'POST',
      body: '{}',
    });
  },

  async scanDispatchSession(sessionId: string, code: string) {
    return staffApi(`${WMS}/dispatch-sessions/${sessionId}/scan`, {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() }),
    });
  },

  async confirmDispatch(orderId: string) {
    return staffApi(`${WMS}/orders/${orderId}/confirm-dispatch`, { method: 'POST', body: '{}' });
  },

  async setShippingMethod(orderId: string, method: 'shiprocket' | 'manual') {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/shipping-method`, {
      method: 'PATCH',
      body: JSON.stringify({ method }),
    });
  },

  async reportException(orderId: string, type: string, note?: string) {
    return staffApi(`${WMS}/fulfillment/orders/${orderId}/exception`, {
      method: 'POST',
      body: JSON.stringify({ type, note }),
    });
  },

  async getShippingBoxes(): Promise<ShippingBox[]> {
    const r = await staffApi<{ ok: boolean; boxes: ShippingBox[] }>(`${WMS}/shipping-boxes`);
    return r.boxes ?? [];
  },

  async getMasters(type = 'manual_courier'): Promise<WarehouseMaster[]> {
    const r = await staffApi<{ ok: boolean; items: WarehouseMaster[] }>(
      `${WMS}/masters?type=${encodeURIComponent(type)}`
    );
    return r.items ?? [];
  },

  async getOrderDocuments(orderId: string): Promise<PrintableDoc[]> {
    const r = await staffApi<{ ok: boolean; printables: PrintableDoc[] }>(`${WMS}/orders/${orderId}/documents`);
    return r.printables ?? [];
  },

  documentApiUrl(type: string, id: string): string {
    return resolveStaffApiUrl(`${WMS}/documents/${type}/${id}`);
  },

  async getTimeline(orderId: string): Promise<OrderTimelineStep[]> {
    try {
      const r = await staffApi<{ ok: boolean; timeline: OrderTimelineStep[] }>(
        `${WMS}/fulfillment/orders/${orderId}/timeline`
      );
      return r.timeline;
    } catch {
      const detail = await warehouseClient.getOrder(orderId);
      return buildOrderTimeline(detail);
    }
  },
};
