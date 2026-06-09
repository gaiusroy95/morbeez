import { randomUUID } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { pickListService } from './pick-list.service.js';
import { fulfillmentService } from './fulfillment.service.js';
import { employeeActionLogService } from './employee-action-log.service.js';
import { invoiceService } from './invoice.service.js';
import { suggestDispatchRack } from './fulfillment-dispatch-racks.js';

export function buildLabelQrPayload(labelId: string, orderName?: string | null): string {
  const name = (orderName ?? '').replace(/\|/g, '').trim();
  return name ? `LBL|${labelId}|${name}` : `LBL|${labelId}`;
}

export function parseLabelQrPayload(code: string): { labelId: string; orderName?: string } | null {
  const trimmed = code.trim();
  if (!trimmed.toUpperCase().startsWith('LBL|')) return null;
  const parts = trimmed.split('|');
  const labelId = parts[1]?.trim();
  if (!labelId) return null;
  return { labelId, orderName: parts[2]?.trim() || undefined };
}

function batchNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `LB-${ymd}-${suffix}`;
}

export const employeeBatchService = {
  async listWarehouseEmployees() {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('id, full_name, email, role, status')
      .eq('status', 'active')
      .in('role', ['operations', 'admin', 'manager', 'super_admin'])
      .order('full_name');
    throwIfSupabaseError(error, 'Warehouse employees');
    return (data ?? []).map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name ?? row.email ?? 'Staff'),
      email: row.email ? String(row.email) : null,
      role: String(row.role),
    }));
  },

  async listAssignableOrders(limit = 80) {
    const { data, error } = await supabase
      .from('commerce_orders')
      .select(
        'id, order_name, shopify_order_id, oms_status, courier_name, tracking_awb, assigned_employee_name, assigned_batch_id, created_at, pick_lists(id, picker_id)'
      )
      .is('deleted_at', null)
      .is('assigned_batch_id', null)
      .in('oms_status', ['confirmed', 'awb_generated', 'picking', 'assigned'])
      .order('fulfillment_priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    throwIfSupabaseError(error, 'Assignable orders');
    return (data ?? []).map((row) => ({
      id: String(row.id),
      orderName: row.order_name ? String(row.order_name) : String(row.shopify_order_id ?? row.id),
      omsStatus: String(row.oms_status),
      courier: row.courier_name ? String(row.courier_name) : '—',
      awb: row.tracking_awb ? String(row.tracking_awb) : null,
      pickListId: Array.isArray(row.pick_lists)
        ? (row.pick_lists[0]?.id ? String(row.pick_lists[0].id) : null)
        : (row.pick_lists as { id?: string } | null)?.id
          ? String((row.pick_lists as { id: string }).id)
          : null,
      createdAt: String(row.created_at),
    }));
  },

  async assignOrdersToEmployee(input: {
    employeeId: string;
    employeeName: string;
    orderIds: string[];
    actorEmail?: string;
  }) {
    const orderIds = [...new Set(input.orderIds.map(String).filter(Boolean))];
    if (!orderIds.length) throw new ValidationError('Select at least one order');
    if (!input.employeeId.trim() || !input.employeeName.trim()) {
      throw new ValidationError('Employee is required');
    }

    const { data: orders, error: ordersErr } = await supabase
      .from('commerce_orders')
      .select('id, order_name, shopify_order_id, assigned_batch_id, oms_status')
      .in('id', orderIds)
      .is('deleted_at', null);
    throwIfSupabaseError(ordersErr, 'Load orders for assignment');
    if ((orders ?? []).length !== orderIds.length) {
      throw new ValidationError('One or more orders are missing or deleted');
    }
    const alreadyAssigned = (orders ?? []).filter((o) => o.assigned_batch_id);
    if (alreadyAssigned.length) {
      throw new ValidationError('One or more orders are already assigned to a batch');
    }

    const batchNo = batchNumber();
    const { data: batch, error: batchErr } = await supabase
      .from('warehouse_label_batches')
      .insert({
        batch_number: batchNo,
        assigned_employee_id: input.employeeId.trim(),
        assigned_employee_name: input.employeeName.trim(),
        batch_status: 'assigned',
        total_orders: orderIds.length,
        created_by: input.actorEmail ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(batchErr, 'Create label batch');

    const batchId = String(batch.id);
    const labels: Array<Record<string, unknown>> = [];

    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i];
      const order = orders!.find((o) => String(o.id) === orderId);
      const orderName = order?.order_name
        ? String(order.order_name)
        : order?.shopify_order_id
          ? String(order.shopify_order_id)
          : orderId;
      const labelId = randomUUID();
      labels.push({
        id: labelId,
        commerce_order_id: orderId,
        label_batch_id: batchId,
        qr_code: buildLabelQrPayload(labelId, orderName),
        assigned_employee_id: input.employeeId.trim(),
        assigned_employee_name: input.employeeName.trim(),
        print_sequence: i + 1,
      });
    }

    const { error: labelsErr } = await supabase.from('shipping_labels').insert(labels);
    throwIfSupabaseError(labelsErr, 'Create shipping labels');

    const now = new Date().toISOString();
    const { error: patchErr } = await supabase
      .from('commerce_orders')
      .update({
        assigned_employee_id: input.employeeId.trim(),
        assigned_employee_name: input.employeeName.trim(),
        assigned_batch_id: batchId,
        oms_status: 'assigned',
        updated_at: now,
      })
      .in('id', orderIds);
    throwIfSupabaseError(patchErr, 'Assign orders to batch');

    for (const orderId of orderIds) {
      try {
        const pickListId = await fulfillmentService.getPickListIdForOrder(orderId);
        await pickListService.assignPicker(pickListId, input.employeeName.trim());
      } catch (err) {
        logger.warn({ err, orderId }, 'Picker assign on batch create failed');
      }
    }

    if (input.actorEmail) {
      await employeeActionLogService.log({
        actorEmail: input.actorEmail,
        actionType: 'employee_batch_assigned',
        entityType: 'warehouse_label_batch',
        entityId: batchId,
        details: { employee: input.employeeName, orderCount: orderIds.length },
      });
    }

    return { batch, orderIds };
  },

  async listBatches(opts?: { employeeId?: string; limit?: number }) {
    let q = supabase
      .from('warehouse_label_batches')
      .select('*')
      .neq('batch_status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 40);
    if (opts?.employeeId?.trim()) {
      q = q.eq('assigned_employee_id', opts.employeeId.trim());
    }
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Label batches');
    return data ?? [];
  },

  async getBatchDetail(batchId: string) {
    const { data: batch, error } = await supabase
      .from('warehouse_label_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Label batch');
    if (!batch) throw new NotFoundError('Label batch not found');

    const { data: labels, error: labelsErr } = await supabase
      .from('shipping_labels')
      .select(
        '*, commerce_orders(id, order_name, shopify_order_id, oms_status, tracking_awb, label_url, courier_name, dispatch_rack)'
      )
      .eq('label_batch_id', batchId)
      .order('print_sequence', { ascending: true });
    throwIfSupabaseError(labelsErr, 'Batch shipping labels');

    return { batch, labels: labels ?? [] };
  },

  async printBatch(batchId: string, actorEmail?: string) {
    const { batch, labels } = await this.getBatchDetail(batchId);
    if (batch.batch_status === 'cancelled') {
      throw new AppError('Batch is cancelled', 400, 'BATCH_CANCELLED');
    }

    const stack: Array<Record<string, unknown>> = [];

    for (const label of labels) {
      const orderId = String(label.commerce_order_id);
      const order = label.commerce_orders as Record<string, unknown> | null;
      let awb = label.awb ? String(label.awb) : null;
      let labelUrl = label.shiprocket_label_url ? String(label.shiprocket_label_url) : null;

      if (!awb) {
        try {
          const shipment = await fulfillmentService.provisionShipment(orderId, actorEmail, {
            forceRecreate: false,
          });
          awb = shipment.awb ?? null;
          labelUrl = shipment.labelUrl ?? labelUrl;
        } catch (err) {
          logger.warn({ err, orderId, batchId }, 'AWB provision during batch print failed');
        }
      }

      if (!labelUrl && order?.label_url) {
        labelUrl = String(order.label_url);
      }
      if (!awb && order?.tracking_awb) {
        awb = String(order.tracking_awb);
      }

      await supabase
        .from('shipping_labels')
        .update({
          awb,
          shiprocket_label_url: labelUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', label.id);

      stack.push({
        labelId: String(label.id),
        commerceOrderId: orderId,
        orderName:
          order?.order_name ?? order?.shopify_order_id ?? orderId,
        printSequence: Number(label.print_sequence),
        qrCode: String(label.qr_code),
        awb,
        labelUrl,
        courier: order?.courier_name ?? null,
      });
    }

    const printedAt = new Date().toISOString();
    await supabase
      .from('warehouse_label_batches')
      .update({
        batch_status: 'printed',
        printed_at: printedAt,
        updated_at: printedAt,
      })
      .eq('id', batchId);

    await supabase
      .from('commerce_orders')
      .update({
        oms_status: 'picking',
        updated_at: printedAt,
      })
      .eq('assigned_batch_id', batchId)
      .in('oms_status', ['assigned', 'confirmed', 'awb_generated']);

    if (actorEmail) {
      await employeeActionLogService.log({
        actorEmail,
        actionType: 'employee_batch_printed',
        entityType: 'warehouse_label_batch',
        entityId: batchId,
        details: { total: stack.length },
      });
    }

    return {
      batch: { ...batch, batch_status: 'printed', printed_at: printedAt },
      stack,
      trayNote: `Keep stack in ${batch.assigned_employee_name}'s label tray (top = first order).`,
    };
  },

  async startPicking(commerceOrderId: string, employeeId?: string) {
    const { data: order, error } = await supabase
      .from('commerce_orders')
      .select('id, assigned_employee_id, oms_status')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(error, 'Order for picking start');
    if (!order) throw new NotFoundError('Order not found');

    if (employeeId && order.assigned_employee_id && order.assigned_employee_id !== employeeId) {
      throw new AppError('Order is assigned to another employee', 403, 'WRONG_EMPLOYEE');
    }

    const now = new Date().toISOString();
    await supabase
      .from('commerce_orders')
      .update({
        oms_status: 'picking',
        picking_started_at: order.assigned_employee_id ? now : undefined,
        updated_at: now,
      })
      .eq('id', commerceOrderId);

    return { ok: true };
  },

  async verifyShippingLabel(input: {
    commerceOrderId: string;
    scannedCode: string;
    employeeId?: string;
    employeeName?: string;
    actorEmail?: string;
  }) {
    const parsed = parseLabelQrPayload(input.scannedCode);
    if (!parsed) {
      return {
        ok: false,
        matched: false,
        error: 'Invalid label QR — scan the shipping label on your tray',
        alert: 'wrong_label' as const,
      };
    }

    const { data: label, error: labelErr } = await supabase
      .from('shipping_labels')
      .select('*, commerce_orders(id, order_name, shopify_order_id, assigned_employee_id, courier_name)')
      .eq('id', parsed.labelId)
      .maybeSingle();
    throwIfSupabaseError(labelErr, 'Shipping label lookup');

    const expectedOrderId = String(input.commerceOrderId);
    const order = label?.commerce_orders as Record<string, unknown> | null;
    const expectedName =
      order?.order_name ?? order?.shopify_order_id ?? expectedOrderId;

    if (!label || String(label.commerce_order_id) !== expectedOrderId) {
      return {
        ok: false,
        matched: false,
        error: 'Wrong label — this QR does not match the open order',
        alert: 'wrong_label' as const,
        expected: { orderId: expectedOrderId, orderName: expectedName },
        scanned: parsed,
      };
    }

    if (input.employeeId && label.assigned_employee_id !== input.employeeId) {
      return {
        ok: false,
        matched: false,
        error: 'Wrong label — belongs to another employee tray',
        alert: 'wrong_label' as const,
        expected: { employee: label.assigned_employee_name },
      };
    }

    if (label.label_verified) {
      return {
        ok: true,
        matched: true,
        alreadyVerified: true,
        message: 'Label already verified',
      };
    }

    const now = new Date().toISOString();
    await supabase
      .from('shipping_labels')
      .update({
        label_verified: true,
        verified_at: now,
        updated_at: now,
      })
      .eq('id', label.id);

    const courierName = order?.courier_name ? String(order.courier_name) : null;
    await supabase
      .from('commerce_orders')
      .update({
        oms_status: 'ready_dispatch',
        label_verified_at: now,
        packed_at: now,
        ready_dispatch_at: now,
        dispatch_rack: suggestDispatchRack(courierName),
        updated_at: now,
      })
      .eq('id', expectedOrderId);

    await invoiceService.generateTaxInvoice(expectedOrderId).catch((err) => {
      logger.warn({ err, orderId: expectedOrderId }, 'Invoice after label verify failed');
    });

    if (input.actorEmail) {
      await employeeActionLogService.log({
        actorEmail: input.actorEmail,
        actionType: 'label_verified',
        entityType: 'commerce_order',
        entityId: expectedOrderId,
        details: { labelId: label.id, qr: label.qr_code },
      });
    }

    return {
      ok: true,
      matched: true,
      message: 'Correct label — paste on parcel and move to dispatch rack',
      orderName: expectedName,
      labelId: String(label.id),
    };
  },
};
