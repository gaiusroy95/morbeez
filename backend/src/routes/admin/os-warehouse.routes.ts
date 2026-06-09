import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabase } from '../../lib/supabase.js';
import { assertModuleAccess } from '../../lib/rbac.js';
import {
  assertSuperAdminPasswordConfirm,
  confirmPasswordSchema,
} from '../../lib/super-admin-password.js';
import { warehouseService } from '../../services/wms/warehouse.service.js';
import { inventoryService } from '../../services/wms/inventory.service.js';
import { purchaseService } from '../../services/wms/purchase.service.js';
import { omsWorkflowService } from '../../services/oms/workflow.service.js';
import { pickListService } from '../../services/oms/pick-list.service.js';
import { packService } from '../../services/oms/pack.service.js';
import { invoiceService } from '../../services/oms/invoice.service.js';
import { ndrRtoService } from '../../services/oms/ndr-rto.service.js';
import { codService } from '../../services/oms/cod.service.js';
import { financeService } from '../../services/oms/finance.service.js';
import { printableDocumentService } from '../../services/oms/printable-document.service.js';
import { returnWorkflowService } from '../../services/oms/return-workflow.service.js';
import { dispatchService } from '../../services/oms/dispatch.service.js';
import { employeeActionLogService } from '../../services/oms/employee-action-log.service.js';
import { manualOrderOmsService } from '../../services/oms/manual-order-oms.service.js';
import { quoteOmsBridgeService } from '../../services/oms/quote-oms-bridge.service.js';
import { commerceQuoteService } from '../../services/commerce/commerce-quote.service.js';
import { fulfillmentService } from '../../services/oms/fulfillment.service.js';
import { employeeBatchService } from '../../services/oms/employee-batch.service.js';

export async function osWarehouseRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/os/warehouse';

  // ─── Overview ─────────────────────────────────────────────────────────────
  app.get(`${api}/overview`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const [warehouses, stock, finance, ndr] = await Promise.all([
      warehouseService.listWarehouses(),
      inventoryService.getStockSummary(),
      financeService.getDashboard(),
      ndrRtoService.listOpen(10),
    ]);
    return reply.send({
      ok: true,
      warehouses,
      stockItemCount: stock.length,
      finance,
      openExceptions: ndr.length,
    });
  });

  // ─── Warehouses & locations ───────────────────────────────────────────────
  app.get(`${api}/warehouses`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const warehouses = await warehouseService.listWarehouses();
    return reply.send({ ok: true, warehouses });
  });

  app.post(`${api}/warehouses`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        code: z.string().min(1).max(32),
        name: z.string().min(1).max(120),
        state: z.string().optional(),
      })
      .parse(request.body);
    const warehouse = await warehouseService.createWarehouse(body);
    return reply.send({ ok: true, warehouse });
  });

  app.patch(`${api}/warehouses/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        code: z.string().min(1).max(32).optional(),
        name: z.string().min(1).max(120).optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const warehouse = await warehouseService.updateWarehouse(id, patch);
    return reply.send({ ok: true, warehouse });
  });

  app.delete(`${api}/warehouses/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    await warehouseService.deactivateWarehouse(id);
    return reply.send({ ok: true });
  });

  app.get(`${api}/warehouses/:id/locations`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const locations = await warehouseService.listLocations(id);
    return reply.send({ ok: true, locations });
  });

  app.post(`${api}/locations`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        warehouseId: z.string().uuid(),
        zone: z.string().optional(),
        rack: z.string().min(1),
        shelf: z.string().optional(),
        bin: z.string().optional(),
      })
      .parse(request.body);
    const location = await warehouseService.createLocation(body);
    return reply.send({ ok: true, location });
  });

  app.patch(`${api}/locations/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        rack: z.string().min(1).optional(),
        shelf: z.string().optional(),
        bin: z.string().optional(),
        zone: z.string().optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const location = await warehouseService.updateLocation(id, patch);
    return reply.send({ ok: true, location });
  });

  app.delete(`${api}/locations/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    await warehouseService.deactivateLocation(id);
    return reply.send({ ok: true });
  });

  app.patch(`${api}/warehouses/:warehouseId/racks/:rackName`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { warehouseId, rackName } = request.params as { warehouseId: string; rackName: string };
    const body = z
      .object({ newRack: z.string().min(1), confirmPassword: confirmPasswordSchema })
      .parse(request.body);
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    await warehouseService.renameRack(warehouseId, decodeURIComponent(rackName), body.newRack);
    return reply.send({ ok: true });
  });

  app.delete(`${api}/warehouses/:warehouseId/racks/:rackName`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { warehouseId, rackName } = request.params as { warehouseId: string; rackName: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    await warehouseService.deactivateRack(warehouseId, decodeURIComponent(rackName));
    return reply.send({ ok: true });
  });

  // ─── Stock & inventory ────────────────────────────────────────────────────
  app.get(`${api}/stock`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { search?: string; warehouseId?: string; sync?: string };
    const stock = await inventoryService.getStockSummary({
      search: q.search,
      warehouseId: q.warehouseId,
      sync: q.sync !== '0',
      forceSync: q.sync === '1',
    });
    return reply.send({ ok: true, stock });
  });

  app.get(`${api}/stock/:inventoryItemId/batches`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { inventoryItemId } = request.params as { inventoryItemId: string };
    const q = request.query as { warehouseId?: string };
    const row = await inventoryService.getStockItemDetail(inventoryItemId, {
      warehouseId: q.warehouseId,
    });
    return reply.send({ ok: true, row });
  });

  app.get(`${api}/inventory-items`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { search?: string };
    const items = await inventoryService.listInventoryItems({ search: q.search });
    return reply.send({ ok: true, items });
  });

  app.post(`${api}/inventory-items`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        sku: z.string().min(1),
        productTitle: z.string().min(1),
        shopifyVariantId: z.string().optional(),
        barcode: z.string().optional(),
        hsnCode: z.string().optional(),
        gstPercent: z.number().optional(),
      })
      .parse(request.body);
    const item = await inventoryService.upsertItemFromSku(body);
    return reply.send({ ok: true, item });
  });

  app.patch(`${api}/inventory-items/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        sku: z.string().min(1).optional(),
        productTitle: z.string().min(1).optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const item = await inventoryService.updateInventoryItem(id, patch);
    return reply.send({ ok: true, item });
  });

  app.delete(`${api}/inventory-items/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    await inventoryService.deactivateInventoryItem(id);
    return reply.send({ ok: true });
  });

  // ─── Purchase orders & GRN ────────────────────────────────────────────────
  app.get(`${api}/suppliers`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const suppliers = await purchaseService.listSuppliers();
    return reply.send({ ok: true, suppliers });
  });

  app.post(`${api}/suppliers`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        name: z.string().min(1),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        gstin: z.string().optional(),
      })
      .parse(request.body);
    const supplier = await purchaseService.createSupplier(body);
    return reply.send({ ok: true, supplier });
  });

  app.get(`${api}/purchase-orders`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const orders = await purchaseService.listPurchaseOrders();
    return reply.send({ ok: true, orders });
  });

  app.get(`${api}/purchase-orders/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const purchaseOrder = await purchaseService.getPurchaseOrder(id);
    return reply.send({ ok: true, purchaseOrder });
  });

  app.post(`${api}/purchase-orders`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        supplierId: z.string().uuid().optional(),
        warehouseId: z.string().uuid(),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            inventoryItemId: z.string().uuid(),
            qtyOrdered: z.number().int().positive(),
            unitCost: z.number().optional(),
          })
        ),
      })
      .parse(request.body);
    const po = await purchaseService.createPurchaseOrder({
      ...body,
      createdBy: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, purchaseOrder: po });
  });

  app.post(`${api}/goods-receipts`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        purchaseOrderId: z.string().uuid().optional(),
        warehouseId: z.string().uuid(),
        supplierId: z.string().uuid().optional(),
        lines: z.array(
          z.object({
            inventoryItemId: z.string().uuid(),
            batchCode: z.string().min(1),
            qty: z.number().int().positive(),
            mfgDate: z.string().optional(),
            expiryDate: z.string().optional(),
            locationId: z.string().uuid().optional(),
            supplierCost: z.number().min(0).optional(),
            freightCost: z.number().min(0).optional(),
            customsCost: z.number().min(0).optional(),
            packagingCost: z.number().min(0).optional(),
            miscCost: z.number().min(0).optional(),
          })
        ),
      })
      .parse(request.body);
    const grn = await purchaseService.receiveGoods({
      ...body,
      receivedBy: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, goodsReceipt: grn });
  });

  // ─── OMS orders ───────────────────────────────────────────────────────────
  app.get(`${api}/quote-queue`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const queue = await quoteOmsBridgeService.listQuoteQueue();
    return reply.send({ ok: true, queue });
  });

  app.post(`${api}/quotes/:id/resync`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await commerceQuoteService.resyncToWarehouse(id);
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/orders`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { omsStatus?: string; limit?: string };
    const orders = await omsWorkflowService.listOmsOrders({
      omsStatus: q.omsStatus,
      limit: q.limit ? Number(q.limit) : 50,
    });
    return reply.send({ ok: true, orders });
  });

  app.get(`${api}/orders/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const order = await omsWorkflowService.getOrderWorkflow(id);
    return reply.send({ ok: true, order });
  });

  app.post(`${api}/orders/:id/confirm`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const pickList = await omsWorkflowService.confirmOrder(id);
    return reply.send({ ok: true, pickList });
  });

  // ─── Pick lists ───────────────────────────────────────────────────────────
  app.get(`${api}/pick-lists`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { status?: string };
    const pickLists = await pickListService.listPickLists({ status: q.status });
    return reply.send({ ok: true, pickLists });
  });

  app.get(`${api}/pick-lists/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const pickList = await pickListService.getPickList(id);
    return reply.send({ ok: true, pickList });
  });

  app.post(`${api}/pick-lists/:id/rebuild`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const pickList = await pickListService.rebuildPickList(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, pickList });
  });

  app.post(`${api}/pick-lists/:id/lines/:lineId/pick`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { lineId } = request.params as { id: string; lineId: string };
    const body = z.object({ qty: z.number().int().positive().optional() }).parse(request.body ?? {});
    const line = await pickListService.markLinePicked(lineId, body.qty);
    return reply.send({ ok: true, line });
  });

  app.post(`${api}/pick-lists/:id/lines/:lineId/verify`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { lineId } = request.params as { lineId: string };
    const line = await pickListService.manualVerifyLine(lineId);
    return reply.send({ ok: true, line });
  });

  app.post(`${api}/pick-lists/:id/complete-picking`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const pickList = await pickListService.completePicking(id);
    return reply.send({ ok: true, pickList });
  });

  app.post(`${api}/pick-lists/:id/assign-picker`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ pickerId: z.string().min(1) }).parse(request.body);
    const pickList = await pickListService.assignPicker(id, body.pickerId);
    const actor = (request as { adminEmail?: string }).adminEmail;
    if (actor) {
      await employeeActionLogService.log({
        actorEmail: actor,
        actionType: 'picker_assigned',
        entityType: 'pick_list',
        entityId: id,
        details: { pickerId: body.pickerId },
      });
    }
    return reply.send({ ok: true, pickList });
  });

  app.get(`${api}/documents/:type/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { type, id } = request.params as { type: string; id: string };
    const doc = await printableDocumentService.getDocument(
      type as 'picking_slip' | 'packing_slip' | 'tax_invoice' | 'courier_label' | 'return_inspection',
      id
    );
    return reply.send({ ok: true, ...doc });
  });

  app.get(`${api}/orders/:id/documents`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const documents = await printableDocumentService.getDocumentsForOrder(id);
    return reply.send({ ok: true, ...documents });
  });

  // ─── Pack & barcode scan ──────────────────────────────────────────────────
  app.post(`${api}/pick-lists/:id/pack-session`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ mode: z.enum(['barcode', 'manual']).optional() }).parse(request.body ?? {});
    const session = await packService.startSession(id, body.mode ?? 'manual');
    return reply.send({ ok: true, session });
  });

  app.post(`${api}/pack-sessions/:id/scan`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ code: z.string().min(1) }).parse(request.body);
    const result = await packService.scanBarcode(id, body.code);
    return reply.send(result);
  });

  app.post(`${api}/pick-lists/:id/complete-pack`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const actor = (request as { adminEmail?: string }).adminEmail;
    const result = await omsWorkflowService.completePacking(id, actor);
    if (actor) {
      await employeeActionLogService.log({
        actorEmail: actor,
        actionType: 'pack_completed',
        entityType: 'pick_list',
        entityId: id,
      });
    }
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/orders/:id/dispatch-session`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const session = await dispatchService.startSession(id);
    return reply.send({ ok: true, session });
  });

  app.post(`${api}/dispatch-sessions/:id/scan`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ code: z.string().min(1) }).parse(request.body);
    const result = await dispatchService.scanAwb(
      id,
      body.code,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send(result);
  });

  app.post(`${api}/orders/:id/confirm-dispatch`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await dispatchService.confirmDispatch(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send(result);
  });

  // ─── Unified fulfillment ──────────────────────────────────────────────────
  app.get(`${api}/fulfillment/stats`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const stats = await fulfillmentService.getStats();
    return reply.send({ ok: true, stats });
  });

  app.get(`${api}/fulfillment/queue`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { limit?: string; repair?: string };
    const queue = await fulfillmentService.getQueue({
      limit: q.limit ? Number(q.limit) : undefined,
      repair: q.repair === '1' || q.repair === 'true',
    });
    return reply.send({ ok: true, queue });
  });

  app.post(`${api}/fulfillment/sync-inventory`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const result = await fulfillmentService.repairStalePickLists();
    const queue = await fulfillmentService.getQueue({ repair: false });
    return reply.send({ ok: true, ...result, queue });
  });

  app.get(`${api}/fulfillment/orders/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const detail = await fulfillmentService.getOrderDetail(id);
    return reply.send({ ok: true, ...detail });
  });

  app.post(`${api}/fulfillment/orders/:id/rebuild-pick-list`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const pickList = await fulfillmentService.rebuildPickListForOrder(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, pickList });
  });

  app.post(`${api}/fulfillment/orders/:id/generate-awb`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    try {
      const result = await fulfillmentService.provisionShipment(
        id,
        (request as { adminEmail?: string }).adminEmail
      );
      return reply.send({ ok: true, shipment: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generate AWB failed';
      request.log.warn({ err, commerceOrderId: id }, 'Generate AWB failed');
      throw err instanceof Error ? err : new Error(message);
    }
  });

  app.post(`${api}/fulfillment/orders/:id/pack-session`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const session = await fulfillmentService.ensurePackSessionForOrder(id);
    return reply.send({ ok: true, session });
  });

  app.post(`${api}/fulfillment/pack-sessions/:id/scan`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ code: z.string().min(1) }).parse(request.body);
    const result = await fulfillmentService.scan(id, body.code);
    return reply.send(result);
  });

  app.post(`${api}/fulfillment/pack-sessions/:id/lookup-barcode`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ code: z.string().min(1) }).parse(request.body);
    const result = await fulfillmentService.lookupBarcode(id, body.code);
    return reply.send(result);
  });

  app.post(`${api}/fulfillment/pack-sessions/:id/confirm-pick`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        lineId: z.string().uuid(),
        qty: z.number().int().positive(),
      })
      .parse(request.body);
    const result = await fulfillmentService.confirmPick(id, body.lineId, body.qty);
    return reply.send(result);
  });

  app.post(`${api}/fulfillment/orders/:id/mark-packed`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await fulfillmentService.markPackedForOrder(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send(result);
  });

  app.post(`${api}/fulfillment/orders/:id/verify-label`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ code: z.string().min(1) }).parse(request.body);
    const { data: order } = await supabase
      .from('commerce_orders')
      .select('assigned_employee_id, assigned_employee_name')
      .eq('id', id)
      .maybeSingle();
    const result = await employeeBatchService.verifyShippingLabel({
      commerceOrderId: id,
      scannedCode: body.code,
      employeeId: order?.assigned_employee_id ? String(order.assigned_employee_id) : undefined,
      employeeName: order?.assigned_employee_name ? String(order.assigned_employee_name) : undefined,
      actorEmail: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send(result);
  });

  // ─── Employee label batches ───────────────────────────────────────────────
  app.get(`${api}/fulfillment/employees`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const employees = await employeeBatchService.listWarehouseEmployees();
    return reply.send({ ok: true, employees });
  });

  app.get(`${api}/fulfillment/assignable-orders`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { limit?: string };
    const orders = await employeeBatchService.listAssignableOrders(
      q.limit ? Number(q.limit) : 80
    );
    return reply.send({ ok: true, orders });
  });

  app.post(`${api}/fulfillment/assign-batch`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        employeeId: z.string().min(1),
        employeeName: z.string().min(1),
        orderIds: z.array(z.string().uuid()).min(1),
      })
      .parse(request.body);
    const result = await employeeBatchService.assignOrdersToEmployee({
      ...body,
      actorEmail: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/fulfillment/label-batches`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { employeeId?: string; limit?: string };
    const batches = await employeeBatchService.listBatches({
      employeeId: q.employeeId,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return reply.send({ ok: true, batches });
  });

  app.get(`${api}/fulfillment/label-batches/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const detail = await employeeBatchService.getBatchDetail(id);
    return reply.send({ ok: true, ...detail });
  });

  app.post(`${api}/fulfillment/label-batches/:id/print`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await employeeBatchService.printBatch(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/fulfillment/orders/:id/mark-label-printed`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await fulfillmentService.markLabelPrinted(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send(result);
  });

  app.post(`${api}/fulfillment/orders/:id/dispatch-rack`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ rack: z.string().min(1) }).parse(request.body);
    const result = await fulfillmentService.assignDispatchRack(id, body.rack);
    return reply.send(result);
  });

  app.post(`${api}/fulfillment/orders/:id/exception`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        type: z.enum([
          'stock_missing',
          'wrong_barcode',
          'reprint_label',
          'courier_failed',
          'weight_mismatch',
        ]),
        note: z.string().optional(),
      })
      .parse(request.body);
    const result = await fulfillmentService.reportException(
      id,
      body.type,
      body.note,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send(result);
  });

  // ─── Invoices & quotations ────────────────────────────────────────────────
  app.get(`${api}/invoices/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const invoice = await invoiceService.getInvoice(id);
    return reply.send({ ok: true, invoice });
  });

  app.post(`${api}/orders/:id/invoice`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const invoice = await invoiceService.generateTaxInvoice(id);
    return reply.send({ ok: true, invoice });
  });

  app.post(`${api}/quotations`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const body = z
      .object({
        customerName: z.string().min(1),
        customerState: z.string().min(1),
        customerGstin: z.string().optional(),
        freight: z.number().optional(),
        validityDays: z.number().optional(),
        razorpayPaymentLinkUrl: z.string().url().optional(),
        lines: z.array(
          z.object({
            description: z.string().min(1),
            hsnCode: z.string().optional(),
            qty: z.number().int().positive(),
            unitPrice: z.number().positive(),
            gstPercent: z.number().optional(),
          })
        ),
      })
      .parse(request.body);
    const quotation = await invoiceService.generateQuotation(body);
    return reply.send({ ok: true, quotation });
  });

  app.post(`${api}/orders/:id/delivery-challan`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ purpose: z.string().optional() }).parse(request.body ?? {});
    const challan = await invoiceService.generateDeliveryChallan(id, body.purpose);
    return reply.send({ ok: true, challan });
  });

  // ─── NDR / RTO ────────────────────────────────────────────────────────────
  app.get(`${api}/exceptions`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const exceptions = await ndrRtoService.listOpen();
    return reply.send({ ok: true, exceptions, ndrReasons: ndrRtoService.NDR_REASONS });
  });

  app.post(`${api}/exceptions/:id/resolve`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        action: z.enum(['reattempt', 'rto_received', 'restocked', 'written_off']),
        qcStatus: z.enum(['pass', 'damage']).optional(),
      })
      .parse(request.body);
    const result = await ndrRtoService.resolveException(id, body.action, body.qcStatus);
    return reply.send({ ok: true, exception: result });
  });

  // ─── COD reconciliation ───────────────────────────────────────────────────
  app.get(`${api}/cod/pending`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const rows = await codService.listPending();
    return reply.send({ ok: true, rows });
  });

  app.post(`${api}/cod/:commerceOrderId/remittance`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { commerceOrderId } = request.params as { commerceOrderId: string };
    const body = z
      .object({
        courierRemittance: z.number(),
        courierName: z.string().optional(),
        remittanceDate: z.string().optional(),
      })
      .parse(request.body);
    const row = await codService.updateRemittance({ commerceOrderId, ...body });
    return reply.send({ ok: true, row });
  });

  app.post(`${api}/manual-orders/:id/push-to-oms`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await manualOrderOmsService.pushToOms(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, ...result });
  });

  // ─── Returns & refunds ────────────────────────────────────────────────────
  app.get(`${api}/returns`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { status?: string };
    const returns = await returnWorkflowService.list({ status: q.status });
    return reply.send({ ok: true, returns });
  });

  app.get(`${api}/returns/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const { id } = request.params as { id: string };
    const returnRequest = await returnWorkflowService.get(id);
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/orders/:id/returns`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        reason: z.string().min(1),
        customerComplaint: z.string().optional(),
        lines: z
          .array(
            z.object({
              productTitle: z.string(),
              sku: z.string().optional(),
              qty: z.number().int().positive(),
              batchCode: z.string().optional(),
            })
          )
          .optional(),
      })
      .parse(request.body);
    const returnRequest = await returnWorkflowService.createRequest({
      commerceOrderId: id,
      ...body,
      createdBy: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/returns/:id/verify-call`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const returnRequest = await returnWorkflowService.markVerificationPending(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/returns/:id/approve`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        refundType: z.enum(['full', 'partial', 'none']),
        refundAmount: z.number().optional(),
      })
      .parse(request.body);
    const returnRequest = await returnWorkflowService.approveReturn(id, {
      ...body,
      approvedBy: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/returns/:id/reject`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().min(1) }).parse(request.body);
    const returnRequest = await returnWorkflowService.rejectReturn(
      id,
      body.reason,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/returns/:id/received`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const returnRequest = await returnWorkflowService.markReceived(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/returns/:id/inspect`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        productCondition: z.enum(['resalable', 'damaged', 'quarantine', 'unknown']),
        inspectionNotes: z.string().optional(),
        stockAction: z.enum(['resalable', 'damaged', 'quarantine', 'writeoff']),
      })
      .parse(request.body);
    const returnRequest = await returnWorkflowService.inspectReturn(id, {
      ...body,
      inspectedBy: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, returnRequest });
  });

  app.post(`${api}/returns/:id/refund`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const result = await returnWorkflowService.processRefund(
      id,
      (request as { adminEmail?: string }).adminEmail
    );
    return reply.send({ ok: true, ...result });
  });

  // ─── Inventory adjustments ────────────────────────────────────────────────
  app.post(`${api}/batches/:id/adjust`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        adjustment: z.number().int(),
        reason: z.string().min(1),
      })
      .parse(request.body);
    const batch = await inventoryService.adjustBatchStock({
      batchId: id,
      ...body,
      actorEmail: (request as { adminEmail?: string }).adminEmail,
    });
    return reply.send({ ok: true, batch });
  });

  app.post(`${api}/batches/:id/status`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum(['active', 'quarantine', 'expired', 'depleted']),
      })
      .parse(request.body);
    const batch = await inventoryService.setBatchStatus(id, body.status);
    return reply.send({ ok: true, batch });
  });

  app.get(`${api}/action-logs`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const q = request.query as { entityType: string; entityId: string };
    const logs = await employeeActionLogService.listForEntity(q.entityType, q.entityId);
    return reply.send({ ok: true, logs });
  });

  // ─── Finance dashboard ────────────────────────────────────────────────────
  app.get(`${api}/finance/dashboard`, async (request, reply) => {
    await assertModuleAccess(request, 'warehouse', 'read');
    const dashboard = await financeService.getDashboard();
    return reply.send({ ok: true, dashboard });
  });
}
