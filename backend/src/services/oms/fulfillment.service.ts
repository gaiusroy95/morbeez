import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { inventoryService } from '../wms/inventory.service.js';
import { shiprocketService } from '../shiprocket/shiprocket.service.js';
import { packService } from './pack.service.js';
import { pickListService } from './pick-list.service.js';
import { rackPickService } from './rack-pick.service.js';
import { omsWorkflowService } from './workflow.service.js';
import { invoiceService } from './invoice.service.js';
import { employeeActionLogService } from './employee-action-log.service.js';
import { suggestDispatchRack } from './fulfillment-dispatch-racks.js';
import { normalizePickLists, normalizeRelation, pickListLineCount } from './fulfillment-queue.utils.js';
import { ordersAdminService } from '../admin/orders-admin.service.js';
import { commerceQuoteService } from '../commerce/commerce-quote.service.js';
import { checkoutOmsBridgeService } from '../checkout/checkout-oms-bridge.service.js';
import { MANUAL_COURIER_OPTIONS, normalizeShippingMethod } from '../../lib/manual-couriers.js';

const FULFILLMENT_STATUSES = [
  'assigned',
  'confirmed',
  'awb_generated',
  'picking',
  'packing',
  'awaiting_label_verification',
  'awaiting_tracking',
  'packed',
  'ready_dispatch',
  'shipped',
  'delivered',
  'completed',
] as const;

const EXCEPTION_TYPES = [
  'stock_missing',
  'wrong_barcode',
  'reprint_label',
  'courier_failed',
  'weight_mismatch',
] as const;

export type FulfillmentExceptionType = (typeof EXCEPTION_TYPES)[number];

function activeFulfillmentOrdersQuery() {
  return supabase
    .from('commerce_orders')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('oms_status', 'cancelled');
}

async function repairPendingCommerceOrders(limit = 100) {
  const { data, error } = await supabase
    .from('commerce_orders')
    .select('id, order_name, shopify_order_id')
    .is('deleted_at', null)
    .eq('oms_status', 'pending')
    .or('financial_status.eq.paid,is_cod.eq.true')
    .order('created_at', { ascending: true })
    .limit(limit);
  throwIfSupabaseError(error, 'Pending commerce orders for warehouse repair');

  let repaired = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await omsWorkflowService.confirmOrder(String(row.id));
      repaired += 1;
    } catch (err) {
      failed += 1;
      logger.warn(
        {
          err,
          orderId: row.id,
          orderName: row.order_name ?? row.shopify_order_id,
        },
        'Pending commerce order confirm failed'
      );
    }
  }
  return { repaired, failed, scanned: data?.length ?? 0 };
}

export const fulfillmentService = {
  repairPendingCommerceOrders,

  async getStats() {
    const [pending, packed, lrPending, completed] = await Promise.all([
      activeFulfillmentOrdersQuery().in('oms_status', [
        'assigned',
        'confirmed',
        'awb_generated',
        'picking',
        'packing',
      ]),
      activeFulfillmentOrdersQuery().in('oms_status', ['packed', 'awaiting_label_verification']),
      activeFulfillmentOrdersQuery().eq('oms_status', 'awaiting_tracking'),
      activeFulfillmentOrdersQuery().in('oms_status', [
        'ready_dispatch',
        'shipped',
        'delivered',
        'completed',
      ]),
    ]);

    return {
      pending: pending.count ?? 0,
      packed: packed.count ?? 0,
      lrPending: lrPending.count ?? 0,
      completed: completed.count ?? 0,
      pendingOrders: pending.count ?? 0,
      readyToPack: packed.count ?? 0,
      packedToday: packed.count ?? 0,
      courierPending: lrPending.count ?? 0,
      failedAwb: 0,
    };
  },

  async repairStalePickLists() {
    await ordersAdminService.repairWarehouseOrderVisibility();
    try {
      await commerceQuoteService.repairUnsyncedPaidQuotes(50);
    } catch (err) {
      logger.warn({ err }, 'Paid quote warehouse sync during fulfillment repair failed');
    }
    try {
      await checkoutOmsBridgeService.repairUnsyncedPaidCheckouts(50);
    } catch (err) {
      logger.warn({ err }, 'Paid checkout warehouse sync during fulfillment repair failed');
    }
    const sync = await inventoryService.syncAllCommerceStockToWarehouse();

    const { data: orders, error } = await supabase
      .from('commerce_orders')
      .select('id, pick_lists(id, pick_list_lines(id, qty_required))')
      .is('deleted_at', null)
      .neq('oms_status', 'cancelled')
      .in('oms_status', [...FULFILLMENT_STATUSES]);
    throwIfSupabaseError(error, 'Fulfillment repair list');

    let repaired = 0;
    let failed = 0;
    const errors: Array<{ orderId: string; orderName?: string; message: string }> = [];

    const { data: orderNames } = await supabase
      .from('commerce_orders')
      .select('id, order_name, shopify_order_id')
      .in(
        'id',
        (orders ?? []).map((o) => String(o.id))
      );
    const nameById = new Map(
      (orderNames ?? []).map((o) => [
        String(o.id),
        String(o.order_name ?? o.shopify_order_id ?? o.id),
      ])
    );

    for (const order of orders ?? []) {
      const pickLists = normalizePickLists<{
        id: string;
        pick_list_lines: Array<{ id: string; qty_required?: number }>;
      }>(order.pick_lists);
      const lineCount = pickListLineCount(pickLists);
      if (lineCount > 0) continue;

      const orderId = String(order.id);
      try {
        await this.rebuildPickListForOrder(orderId);
        repaired += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'Pick list rebuild failed';
        errors.push({ orderId, orderName: nameById.get(orderId), message });
        logger.warn({ err, orderId }, 'Auto-repair pick list failed');
      }
    }

    return { ...sync, repaired, failed, errors };
  },

  async getQueue(opts?: { limit?: number; repair?: boolean }) {
    await ordersAdminService.repairWarehouseOrderVisibility();
    try {
      await commerceQuoteService.repairUnsyncedPaidQuotes(100);
    } catch (err) {
      logger.warn({ err }, 'Paid quote warehouse sync on queue load failed');
    }
    try {
      await checkoutOmsBridgeService.repairUnsyncedPaidCheckouts(50);
    } catch (err) {
      logger.warn({ err }, 'Paid checkout warehouse sync on queue load failed');
    }
    try {
      await repairPendingCommerceOrders(100);
    } catch (err) {
      logger.warn({ err }, 'Pending order confirm on queue load failed');
    }

    if (opts?.repair === true) {
      try {
        await this.repairStalePickLists();
      } catch (err) {
        logger.error({ err }, 'Fulfillment queue repair failed');
      }
    }

    const { data, error } = await supabase
      .from('commerce_orders')
      .select(
        `id, order_name, shopify_order_id, oms_status, courier_name, tracking_awb,
         shipping_method, tracking_status,
         fulfillment_priority, is_cod, total_amount, created_at, shiprocket_error, shipping_address,
         assigned_employee_name, assigned_batch_id,
         pick_lists(id, status, pick_list_lines(id, qty_required)),
         commerce_order_lines(id, qty_ordered, qty_cancelled, product_title, sku)`
      )
      .is('deleted_at', null)
      .neq('oms_status', 'cancelled')
      .in('oms_status', [...FULFILLMENT_STATUSES])
      .order('fulfillment_priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(opts?.limit ?? 80);
    throwIfSupabaseError(error, 'Fulfillment queue');

    const wallet = await shiprocketService.getWalletBalance().catch(() => null);

    return (data ?? []).map((row) => {
      const pickLists = normalizePickLists<{
        id: string;
        status: string;
        pick_list_lines: Array<{ id: string; qty_required?: number }>;
      }>(row.pick_lists);
      const orderLines = normalizeRelation<{
        qty_ordered: number;
        qty_cancelled: number | null;
        product_title?: string;
        sku?: string | null;
      }>(row.commerce_order_lines);
      const pick = pickLists[0];
      const pickItemCount = pickListLineCount(pickLists);
      const orderItemCount = orderLines.reduce(
        (sum, l) => sum + Math.max(0, Number(l.qty_ordered) - Number(l.qty_cancelled ?? 0)),
        0
      );
      const stockIssue =
        orderItemCount === 0
          ? 'no_order_lines'
          : pickItemCount === 0
            ? 'no_stock_reserved'
            : null;
      const missingProducts =
        stockIssue === 'no_stock_reserved'
          ? orderLines.map((l) => l.product_title).filter(Boolean).slice(0, 2)
          : [];
      const shipAddr = row.shipping_address as Record<string, unknown> | null;
      const customerName = shipAddr?.name
        ? String(shipAddr.name)
        : shipAddr?.first_name
          ? String(shipAddr.first_name)
          : null;

      return {
        id: row.id,
        orderName: row.order_name ?? row.shopify_order_id ?? row.id.slice(0, 8),
        customerName,
        courier: row.courier_name ?? '—',
        itemCount: pickItemCount,
        orderItemCount,
        stockIssue,
        missingProducts,
        priority: row.fulfillment_priority ?? 'normal',
        omsStatus: row.oms_status,
        shippingMethod: normalizeShippingMethod(row.shipping_method),
        trackingStatus: row.tracking_status ? String(row.tracking_status) : null,
        needsManualTracking:
          normalizeShippingMethod(row.shipping_method) === 'manual' &&
          row.oms_status === 'awaiting_tracking',
        awb: row.tracking_awb,
        pickListId: pick?.id ?? null,
        shiprocketError: shiprocketService.formatShiprocketErrorForDisplay(
          row.shiprocket_error as string | null,
          wallet
        ),
        isCod: row.is_cod,
        totalAmount: row.total_amount,
        createdAt: row.created_at,
        assignedEmployee: row.assigned_employee_name ? String(row.assigned_employee_name) : null,
      };
    });
  },

  async getOrderDetail(commerceOrderId: string) {
    let order = await omsWorkflowService.getOrderWorkflow(commerceOrderId);

    const shippingMethod = normalizeShippingMethod(order.shipping_method);

    if (
      shippingMethod === 'shiprocket' &&
      env.ENABLE_SHIPROCKET_ON_CONFIRM !== false &&
      !order.tracking_awb &&
      !order.shiprocket_error
    ) {
      try {
        await this.provisionShipment(commerceOrderId);
        order = await omsWorkflowService.getOrderWorkflow(commerceOrderId);
      } catch (err) {
        logger.warn({ err, commerceOrderId }, 'Auto AWB assignment on order open failed');
        order = await omsWorkflowService.getOrderWorkflow(commerceOrderId);
      }
    }

    const shiprocketDiagnostics = await shiprocketService.getDiagnostics().catch(() => null);
    const pickLists = normalizePickLists<Record<string, unknown>>(order.pick_lists);
    const pickList = pickLists[0] ?? null;
    if (pickList?.id) {
      try {
        await pickListService.refreshRackLocations(String(pickList.id));
      } catch (err) {
        logger.warn({ err, pickListId: pickList.id }, 'Pick line rack refresh failed');
      }
    }
    let packSession = null;
    if (pickList?.id) {
      const { data: sess } = await supabase
        .from('pack_sessions')
        .select('*')
        .eq('pick_list_id', pickList.id)
        .eq('status', 'open')
        .maybeSingle();
      packSession = sess;
    }

    let invoice: { id: string; invoice_number: string; document_type: string } | null = null;
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, document_type')
      .eq('commerce_order_id', commerceOrderId)
      .eq('document_type', 'tax_invoice')
      .order('created_at', { ascending: false })
      .limit(1);
    invoice = invoices?.[0] ?? null;
    if (!invoice) {
      try {
        const ensured = await this.ensureInvoice(commerceOrderId);
        if (ensured?.id) {
          const { data: invRow } = await supabase
            .from('invoices')
            .select('id, invoice_number, document_type')
            .eq('id', ensured.id)
            .maybeSingle();
          invoice = invRow ?? null;
        }
      } catch (err) {
        logger.warn({ err, commerceOrderId }, 'Invoice ensure on order detail failed');
      }
    }

    let workflow = null;
    if (packSession?.id && pickList) {
      const ctx = await rackPickService.loadSessionContext(String(packSession.id));
      workflow = rackPickService.buildWorkflowPayload(ctx);
    }

    const shipAddr = order.shipping_address as Record<string, unknown> | null;

    const shiprocketErrorDisplay = shiprocketService.formatShiprocketErrorForDisplay(
      order.shiprocket_error as string | null,
      shiprocketDiagnostics?.walletBalanceInr ?? null
    );

    const { data: shippingLabel } = await supabase
      .from('shipping_labels')
      .select('id, qr_code, label_verified, verified_at, print_sequence, label_batch_id')
      .eq('commerce_order_id', commerceOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let labelBatch = null;
    if (shippingLabel?.label_batch_id) {
      const { data: batch } = await supabase
        .from('warehouse_label_batches')
        .select('id, batch_number, assigned_employee_name, batch_status, printed_at')
        .eq('id', shippingLabel.label_batch_id)
        .maybeSingle();
      labelBatch = batch;
    }

    return {
      order,
      pickList,
      packSession,
      invoice,
      shippingMethod: normalizeShippingMethod(order.shipping_method),
      manualCourierOptions: [...MANUAL_COURIER_OPTIONS],
      awbAssignAvailable:
        shippingMethod === 'shiprocket' && env.ENABLE_SHIPROCKET_ON_CONFIRM !== false,
      suggestedDispatchRack: suggestDispatchRack(order.courier_name as string | null),
      printEnabled: Boolean(packSession?.scan_complete),
      workflow,
      shiprocketDiagnostics,
      shiprocketErrorDisplay,
      assignment: {
        employeeId: order.assigned_employee_id ? String(order.assigned_employee_id) : null,
        employeeName: order.assigned_employee_name ? String(order.assigned_employee_name) : null,
        batchId: order.assigned_batch_id ? String(order.assigned_batch_id) : null,
        pickingStartedAt: order.picking_started_at ?? null,
        labelVerifiedAt: order.label_verified_at ?? null,
      },
      shippingLabel: shippingLabel
        ? {
            id: String(shippingLabel.id),
            qrCode: String(shippingLabel.qr_code),
            labelVerified: Boolean(shippingLabel.label_verified),
            verifiedAt: shippingLabel.verified_at ?? null,
            printSequence: Number(shippingLabel.print_sequence) || 1,
          }
        : null,
      labelBatch,
      customerSummary: {
        phone: order.phone ?? shipAddr?.phone ?? null,
        address: shipAddr
          ? [
              shipAddr.name ?? shipAddr.first_name,
              shipAddr.line1 ?? shipAddr.address1,
              shipAddr.city,
              shipAddr.state ?? shipAddr.province,
              shipAddr.pincode ?? shipAddr.zip,
            ]
              .filter(Boolean)
              .join(', ')
          : null,
        isCod: Boolean(order.is_cod),
        totalAmount: order.total_amount,
      },
    };
  },

  async setShippingMethod(
    commerceOrderId: string,
    method: 'shiprocket' | 'manual',
    actorEmail?: string
  ) {
    const { data: order, error } = await supabase
      .from('commerce_orders')
      .select('id, shipping_method, tracking_awb')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(error, 'Order for shipping method');
    if (!order) throw new NotFoundError('Order not found');

    const patch: Record<string, unknown> = {
      shipping_method: method,
      updated_at: new Date().toISOString(),
    };

    if (method === 'manual') {
      patch.shiprocket_error = null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('commerce_orders')
      .update(patch)
      .eq('id', commerceOrderId)
      .select('*')
      .single();
    throwIfSupabaseError(updateErr, 'Update shipping method');

    if (method === 'shiprocket' && !order.tracking_awb && env.ENABLE_SHIPROCKET_ON_CONFIRM !== false) {
      await this.provisionShipment(commerceOrderId, actorEmail).catch((err) => {
        logger.warn({ err, commerceOrderId }, 'Shiprocket after switching from manual failed');
      });
      return omsWorkflowService.getOrderWorkflow(commerceOrderId);
    }

    return updated;
  },

  async saveManualLogistics(
    commerceOrderId: string,
    input: {
      courierName: string;
      trackingAwb: string;
      trackingUrl?: string | null;
    },
    actorEmail?: string
  ) {
    const courierName = input.courierName.trim();
    const trackingAwb = input.trackingAwb.trim();
    if (!courierName) throw new AppError('Courier name is required', 400, 'VALIDATION');
    if (!trackingAwb) throw new AppError('Tracking / LR number is required', 400, 'VALIDATION');

    const { data: order, error } = await supabase
      .from('commerce_orders')
      .select('id, oms_status, shipping_method')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(error, 'Order for manual logistics');
    if (!order) throw new NotFoundError('Order not found');

    const nextStatus =
      order.oms_status === 'awaiting_tracking' || order.oms_status === 'packed'
        ? 'ready_dispatch'
        : order.oms_status;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      shipping_method: 'manual',
      courier_name: courierName,
      tracking_awb: trackingAwb,
      tracking_url: input.trackingUrl?.trim() || null,
      tracking_status: 'pending',
      shiprocket_error: null,
      oms_status: nextStatus,
      updated_at: now,
    };
    if (nextStatus === 'ready_dispatch') {
      patch.ready_dispatch_at = now;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('commerce_orders')
      .update(patch)
      .eq('id', commerceOrderId)
      .select('*')
      .single();
    throwIfSupabaseError(updateErr, 'Save manual logistics');

    if (actorEmail) {
      await employeeActionLogService.log({
        actorEmail,
        actionType: 'manual_logistics_saved',
        entityType: 'commerce_order',
        entityId: commerceOrderId,
        details: { courierName, trackingAwb },
      });
    }

    return updated;
  },

  async provisionShipment(
    commerceOrderId: string,
    actorEmail?: string,
    opts?: { forceRecreate?: boolean }
  ) {
    if (env.ENABLE_SHIPROCKET_ON_CONFIRM === false) {
      throw new AppError('Shiprocket on confirm is disabled', 400, 'SHIPROCKET_DISABLED');
    }

    const { data: orderRow } = await supabase
      .from('commerce_orders')
      .select('shipping_method')
      .eq('id', commerceOrderId)
      .maybeSingle();
    if (normalizeShippingMethod(orderRow?.shipping_method) === 'manual') {
      throw new AppError(
        'Order uses manual logistics — enter courier and LR number instead',
        400,
        'MANUAL_SHIPPING'
      );
    }

    await supabase
      .from('commerce_orders')
      .update({ shiprocket_error: null, updated_at: new Date().toISOString() })
      .eq('id', commerceOrderId);

    const forceRecreate = opts?.forceRecreate ?? false;

    const result = await shiprocketService
      .provisionForCommerceOrder(commerceOrderId, { forceRecreate })
      .catch(async (err) => {
        const msg = err instanceof Error ? err.message : 'Shiprocket failed';
        await supabase
          .from('commerce_orders')
          .update({
            shiprocket_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', commerceOrderId);
        throw err;
      });

    if (!result) {
      await supabase
        .from('commerce_orders')
        .update({
          shiprocket_error: 'Missing address or order lines',
          updated_at: new Date().toISOString(),
        })
        .eq('id', commerceOrderId);
      throw new AppError('Cannot create shipment — check address and line items', 409, 'SHIPROCKET_SKIP');
    }

    const dispatchRack = suggestDispatchRack(result.courier);

    await supabase
      .from('commerce_orders')
      .update({
        shiprocket_order_id: result.shiprocketOrderId,
        shiprocket_shipment_id: result.shipmentId,
        tracking_awb: result.awb,
        tracking_url: result.trackingUrl,
        courier_name: result.courier,
        label_url: result.labelUrl,
        dispatch_rack: dispatchRack,
        awb_generated_at: new Date().toISOString(),
        shiprocket_error: null,
        oms_status: 'awb_generated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', commerceOrderId);

    await supabase
      .from('commerce_orders')
      .update({ oms_status: 'picking', updated_at: new Date().toISOString() })
      .eq('id', commerceOrderId)
      .eq('oms_status', 'awb_generated');

    if (actorEmail) {
      try {
        await employeeActionLogService.log({
          actorEmail,
          actionType: 'awb_generated',
          entityType: 'commerce_order',
          entityId: commerceOrderId,
          details: { awb: result.awb, courier: result.courier },
        });
      } catch (err) {
        logger.warn({ err, commerceOrderId }, 'AWB generated but action log failed');
      }
    }

    return result;
  },

  async markPackedForOrder(commerceOrderId: string, actorEmail?: string) {
    const pickListId = await this.getPickListIdForOrder(commerceOrderId);
    return this.markPacked(pickListId, actorEmail);
  },

  async markPacked(pickListId: string, actorEmail?: string) {
    await packService.completePack(pickListId, actorEmail);

    const { data: pick } = await supabase
      .from('pick_lists')
      .select('commerce_order_id')
      .eq('id', pickListId)
      .single();
    if (!pick?.commerce_order_id) {
      throw new NotFoundError('Pick list not found');
    }

    const commerceOrderId = String(pick.commerce_order_id);

    const { data: order } = await supabase
      .from('commerce_orders')
      .select('shipping_method, tracking_awb, assigned_batch_id')
      .eq('id', commerceOrderId)
      .single();

    const { data: batchLabel } = await supabase
      .from('shipping_labels')
      .select('id')
      .eq('commerce_order_id', commerceOrderId)
      .limit(1)
      .maybeSingle();

    const shippingMethod = normalizeShippingMethod(order?.shipping_method);
    const hasBatchLabel = Boolean(batchLabel?.id || order?.assigned_batch_id);
    const hasTracking = Boolean(order?.tracking_awb);

    let nextStatus = 'awaiting_label_verification';
    let trackingStatus: string | null = null;

    if (shippingMethod === 'manual') {
      if (hasTracking) {
        nextStatus = 'ready_dispatch';
        trackingStatus = 'pending';
      } else {
        nextStatus = 'awaiting_tracking';
        trackingStatus = 'awaiting_lr';
      }
    } else if (hasBatchLabel) {
      nextStatus = 'awaiting_label_verification';
    } else if (hasTracking) {
      nextStatus = 'ready_dispatch';
      trackingStatus = 'pending';
    } else {
      nextStatus = 'packed';
    }

    const packedAt = new Date().toISOString();

    await supabase
      .from('pick_lists')
      .update({
        status: 'packed',
        packed_at: packedAt,
        updated_at: packedAt,
      })
      .eq('id', pickListId);

    await supabase
      .from('commerce_orders')
      .update({
        oms_status: nextStatus,
        packed_at: packedAt,
        tracking_status: trackingStatus,
        ready_dispatch_at: nextStatus === 'ready_dispatch' ? packedAt : null,
        updated_at: packedAt,
      })
      .eq('id', commerceOrderId);

    if (actorEmail) {
      await employeeActionLogService.log({
        actorEmail,
        actionType:
          nextStatus === 'awaiting_tracking'
            ? 'pack_complete_awaiting_tracking'
            : 'pack_complete_awaiting_label',
        entityType: 'commerce_order',
        entityId: commerceOrderId,
        details: { status: nextStatus, shippingMethod },
      });
    }

    return { ok: true, commerceOrderId, status: nextStatus };
  },

  async markLabelPrinted(commerceOrderId: string, actorEmail?: string) {
    const { data: order, error } = await supabase
      .from('commerce_orders')
      .select('id, oms_status, tracking_awb')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(error, 'Order');
    if (!order) throw new NotFoundError('Order not found');
    if (!order.tracking_awb) {
      throw new AppError('Generate AWB before printing label', 400, 'NO_AWB');
    }

    await this.ensureInvoice(commerceOrderId);

    await supabase
      .from('commerce_orders')
      .update({
        oms_status: 'ready_dispatch',
        ready_dispatch_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commerceOrderId);

    if (actorEmail) {
      await employeeActionLogService.log({
        actorEmail,
        actionType: 'label_printed',
        entityType: 'commerce_order',
        entityId: commerceOrderId,
      });
    }

    return { ok: true };
  },

  async assignDispatchRack(commerceOrderId: string, rack: string) {
    const { error } = await supabase
      .from('commerce_orders')
      .update({
        dispatch_rack: rack.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commerceOrderId);
    throwIfSupabaseError(error, 'Dispatch rack');
    return { ok: true, rack: rack.trim() };
  },

  async reportException(
    commerceOrderId: string,
    type: FulfillmentExceptionType,
    note?: string,
    actorEmail?: string
  ) {
    if (!EXCEPTION_TYPES.includes(type)) {
      throw new AppError('Unknown exception type', 400, 'VALIDATION');
    }

    if (type === 'courier_failed') {
      await supabase
        .from('commerce_orders')
        .update({
          shiprocket_error: note ?? 'Courier assignment failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', commerceOrderId);
    }

    if (type === 'reprint_label') {
      const { data: orderRow } = await supabase
        .from('commerce_orders')
        .select('shipping_method')
        .eq('id', commerceOrderId)
        .maybeSingle();
      if (normalizeShippingMethod(orderRow?.shipping_method) === 'manual') {
        return { ok: true, type, note: note ?? null, manual: true };
      }
      const provisioned = await this.provisionShipment(commerceOrderId, actorEmail).catch((err) => {
        logger.error({ err, commerceOrderId }, 'Reprint label / AWB retry failed');
        return null;
      });
      if (provisioned) return { ok: true, retried: true, awb: provisioned.awb };
    }

    if (actorEmail) {
      await employeeActionLogService.log({
        actorEmail,
        actionType: `fulfillment_${type}`,
        entityType: 'commerce_order',
        entityId: commerceOrderId,
        details: { note: note ?? null },
      });
    }

    return { ok: true, type, note: note ?? null };
  },

  async rebuildPickListForOrder(commerceOrderId: string, actorEmail?: string) {
    try {
      const pickListId = await this.getPickListIdForOrder(commerceOrderId);
      return pickListService.rebuildPickList(pickListId, actorEmail);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return pickListService.generateForOrder(commerceOrderId, actorEmail);
      }
      throw err;
    }
  },

  async getPickListIdForOrder(commerceOrderId: string) {
    const { data, error } = await supabase
      .from('pick_lists')
      .select('id')
      .eq('commerce_order_id', commerceOrderId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Pick list lookup');
    if (!data) throw new NotFoundError('Pick list not found for order');
    return String(data.id);
  },

  async ensurePackSession(pickListId: string) {
    const session = await packService.startSession(pickListId, 'barcode');
    await rackPickService.initSessionRack(String(session.id));
    const ctx = await rackPickService.loadSessionContext(String(session.id));
    return ctx.session;
  },

  async ensurePackSessionForOrder(commerceOrderId: string) {
    const pickListId = await this.getPickListIdForOrder(commerceOrderId);
    return this.ensurePackSession(pickListId);
  },

  async lookupBarcode(packSessionId: string, code: string) {
    return rackPickService.lookupBarcode(packSessionId, code);
  },

  async confirmPick(packSessionId: string, lineId: string, qty: number) {
    return rackPickService.confirmPick(packSessionId, lineId, qty);
  },

  async scan(packSessionId: string, code: string) {
    return packService.scanFulfillment(packSessionId, code);
  },

  async confirmOrder(commerceOrderId: string) {
    return omsWorkflowService.confirmOrder(commerceOrderId);
  },

  async ensureInvoice(commerceOrderId: string) {
    const { data: existing } = await supabase
      .from('invoices')
      .select('id, metadata')
      .eq('commerce_order_id', commerceOrderId)
      .eq('document_type', 'tax_invoice')
      .maybeSingle();
    if (existing) {
      return invoiceService.repairTaxInvoice(existing.id);
    }
    return invoiceService.generateTaxInvoice(commerceOrderId);
  },
};
