import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
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
export async function osWarehouseRoutes(app) {
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
    app.get(`${api}/warehouses/:id/locations`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const { id } = request.params;
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
    // ─── Stock & inventory ────────────────────────────────────────────────────
    app.get(`${api}/stock`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const q = request.query;
        const stock = await inventoryService.getStockSummary({
            search: q.search,
            warehouseId: q.warehouseId,
        });
        return reply.send({ ok: true, stock });
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
    app.post(`${api}/purchase-orders`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const body = z
            .object({
            supplierId: z.string().uuid().optional(),
            warehouseId: z.string().uuid(),
            notes: z.string().optional(),
            lines: z.array(z.object({
                inventoryItemId: z.string().uuid(),
                qtyOrdered: z.number().int().positive(),
                unitCost: z.number().optional(),
            })),
        })
            .parse(request.body);
        const po = await purchaseService.createPurchaseOrder({
            ...body,
            createdBy: request.adminEmail,
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
            lines: z.array(z.object({
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
            })),
        })
            .parse(request.body);
        const grn = await purchaseService.receiveGoods({
            ...body,
            receivedBy: request.adminEmail,
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
        const { id } = request.params;
        const result = await commerceQuoteService.resyncToWarehouse(id);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/orders`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const q = request.query;
        const orders = await omsWorkflowService.listOmsOrders({
            omsStatus: q.omsStatus,
            limit: q.limit ? Number(q.limit) : 50,
        });
        return reply.send({ ok: true, orders });
    });
    app.get(`${api}/orders/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const { id } = request.params;
        const order = await omsWorkflowService.getOrderWorkflow(id);
        return reply.send({ ok: true, order });
    });
    app.post(`${api}/orders/:id/confirm`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const pickList = await omsWorkflowService.confirmOrder(id);
        return reply.send({ ok: true, pickList });
    });
    // ─── Pick lists ───────────────────────────────────────────────────────────
    app.get(`${api}/pick-lists`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const q = request.query;
        const pickLists = await pickListService.listPickLists({ status: q.status });
        return reply.send({ ok: true, pickLists });
    });
    app.get(`${api}/pick-lists/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const { id } = request.params;
        const pickList = await pickListService.getPickList(id);
        return reply.send({ ok: true, pickList });
    });
    app.post(`${api}/pick-lists/:id/lines/:lineId/pick`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { lineId } = request.params;
        const body = z.object({ qty: z.number().int().positive().optional() }).parse(request.body ?? {});
        const line = await pickListService.markLinePicked(lineId, body.qty);
        return reply.send({ ok: true, line });
    });
    app.post(`${api}/pick-lists/:id/lines/:lineId/verify`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { lineId } = request.params;
        const line = await pickListService.manualVerifyLine(lineId);
        return reply.send({ ok: true, line });
    });
    app.post(`${api}/pick-lists/:id/complete-picking`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const pickList = await pickListService.completePicking(id);
        return reply.send({ ok: true, pickList });
    });
    app.post(`${api}/pick-lists/:id/assign-picker`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z.object({ pickerId: z.string().min(1) }).parse(request.body);
        const pickList = await pickListService.assignPicker(id, body.pickerId);
        const actor = request.adminEmail;
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
        const { type, id } = request.params;
        const doc = await printableDocumentService.getDocument(type, id);
        return reply.send({ ok: true, ...doc });
    });
    app.get(`${api}/orders/:id/documents`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const { id } = request.params;
        const documents = await printableDocumentService.getDocumentsForOrder(id);
        return reply.send({ ok: true, ...documents });
    });
    // ─── Pack & barcode scan ──────────────────────────────────────────────────
    app.post(`${api}/pick-lists/:id/pack-session`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z.object({ mode: z.enum(['barcode', 'manual']).optional() }).parse(request.body ?? {});
        const session = await packService.startSession(id, body.mode ?? 'manual');
        return reply.send({ ok: true, session });
    });
    app.post(`${api}/pack-sessions/:id/scan`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z.object({ code: z.string().min(1) }).parse(request.body);
        const result = await packService.scanBarcode(id, body.code);
        return reply.send(result);
    });
    app.post(`${api}/pick-lists/:id/complete-pack`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const actor = request.adminEmail;
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
        const { id } = request.params;
        const session = await dispatchService.startSession(id);
        return reply.send({ ok: true, session });
    });
    app.post(`${api}/dispatch-sessions/:id/scan`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z.object({ code: z.string().min(1) }).parse(request.body);
        const result = await dispatchService.scanAwb(id, body.code, request.adminEmail);
        return reply.send(result);
    });
    app.post(`${api}/orders/:id/confirm-dispatch`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const result = await dispatchService.confirmDispatch(id, request.adminEmail);
        return reply.send(result);
    });
    // ─── Invoices & quotations ────────────────────────────────────────────────
    app.get(`${api}/invoices/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const { id } = request.params;
        const invoice = await invoiceService.getInvoice(id);
        return reply.send({ ok: true, invoice });
    });
    app.post(`${api}/orders/:id/invoice`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
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
            lines: z.array(z.object({
                description: z.string().min(1),
                hsnCode: z.string().optional(),
                qty: z.number().int().positive(),
                unitPrice: z.number().positive(),
                gstPercent: z.number().optional(),
            })),
        })
            .parse(request.body);
        const quotation = await invoiceService.generateQuotation(body);
        return reply.send({ ok: true, quotation });
    });
    app.post(`${api}/orders/:id/delivery-challan`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
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
        const { id } = request.params;
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
        const { commerceOrderId } = request.params;
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
        const { id } = request.params;
        const result = await manualOrderOmsService.pushToOms(id, request.adminEmail);
        return reply.send({ ok: true, ...result });
    });
    // ─── Returns & refunds ────────────────────────────────────────────────────
    app.get(`${api}/returns`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const q = request.query;
        const returns = await returnWorkflowService.list({ status: q.status });
        return reply.send({ ok: true, returns });
    });
    app.get(`${api}/returns/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'read');
        const { id } = request.params;
        const returnRequest = await returnWorkflowService.get(id);
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/orders/:id/returns`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z
            .object({
            reason: z.string().min(1),
            customerComplaint: z.string().optional(),
            lines: z
                .array(z.object({
                productTitle: z.string(),
                sku: z.string().optional(),
                qty: z.number().int().positive(),
                batchCode: z.string().optional(),
            }))
                .optional(),
        })
            .parse(request.body);
        const returnRequest = await returnWorkflowService.createRequest({
            commerceOrderId: id,
            ...body,
            createdBy: request.adminEmail,
        });
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/returns/:id/verify-call`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const returnRequest = await returnWorkflowService.markVerificationPending(id, request.adminEmail);
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/returns/:id/approve`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z
            .object({
            refundType: z.enum(['full', 'partial', 'none']),
            refundAmount: z.number().optional(),
        })
            .parse(request.body);
        const returnRequest = await returnWorkflowService.approveReturn(id, {
            ...body,
            approvedBy: request.adminEmail,
        });
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/returns/:id/reject`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z.object({ reason: z.string().min(1) }).parse(request.body);
        const returnRequest = await returnWorkflowService.rejectReturn(id, body.reason, request.adminEmail);
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/returns/:id/received`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const returnRequest = await returnWorkflowService.markReceived(id, request.adminEmail);
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/returns/:id/inspect`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z
            .object({
            productCondition: z.enum(['resalable', 'damaged', 'quarantine', 'unknown']),
            inspectionNotes: z.string().optional(),
            stockAction: z.enum(['resalable', 'damaged', 'quarantine', 'writeoff']),
        })
            .parse(request.body);
        const returnRequest = await returnWorkflowService.inspectReturn(id, {
            ...body,
            inspectedBy: request.adminEmail,
        });
        return reply.send({ ok: true, returnRequest });
    });
    app.post(`${api}/returns/:id/refund`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const result = await returnWorkflowService.processRefund(id, request.adminEmail);
        return reply.send({ ok: true, ...result });
    });
    // ─── Inventory adjustments ────────────────────────────────────────────────
    app.post(`${api}/batches/:id/adjust`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
        const body = z
            .object({
            adjustment: z.number().int(),
            reason: z.string().min(1),
        })
            .parse(request.body);
        const batch = await inventoryService.adjustBatchStock({
            batchId: id,
            ...body,
            actorEmail: request.adminEmail,
        });
        return reply.send({ ok: true, batch });
    });
    app.post(`${api}/batches/:id/status`, async (request, reply) => {
        await assertModuleAccess(request, 'warehouse', 'write');
        const { id } = request.params;
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
        const q = request.query;
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
//# sourceMappingURL=os-warehouse.routes.js.map