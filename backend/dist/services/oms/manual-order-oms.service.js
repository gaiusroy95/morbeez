import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
import { omsWorkflowService } from './workflow.service.js';
import { employeeActionLogService } from './employee-action-log.service.js';
import { logger } from '../../lib/logger.js';
function skuFromLine(line, index) {
    if (line.sku?.trim())
        return line.sku.trim();
    if (line.variantId)
        return `VAR-${line.variantId}`;
    const slug = line.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
    return slug ? `CRM-${slug}` : `CRM-LINE-${index + 1}`;
}
export const manualOrderOmsService = {
    async pushToOms(manualOrderId, actorEmail) {
        const { data: manual, error } = await supabase
            .from('crm_manual_orders')
            .select('*, farmers(id, name, phone, state, district)')
            .eq('id', manualOrderId)
            .single();
        throwIfSupabaseError(error, 'Manual order');
        if (!manual)
            throw new NotFoundError('Manual order not found');
        if (manual.commerce_order_id) {
            const existing = await omsWorkflowService.getOrderWorkflow(String(manual.commerce_order_id));
            return { commerceOrderId: manual.commerce_order_id, order: existing, alreadyLinked: true };
        }
        if (manual.status === 'cancelled') {
            throw new AppError('Cancelled manual orders cannot enter OMS', 400, 'VALIDATION');
        }
        const farmer = manual.farmers;
        const lineItems = manual.line_items ?? [];
        if (!lineItems.length)
            throw new AppError('Manual order has no line items', 400, 'VALIDATION');
        const paymentMode = String(manual.payment_mode ?? '').toLowerCase();
        const isCod = paymentMode.includes('cod') || paymentMode === 'cash_on_delivery';
        const isPaid = paymentMode.includes('paid') ||
            paymentMode.includes('prepaid') ||
            paymentMode.includes('upi') ||
            paymentMode.includes('online');
        const syntheticShopifyId = `crm-manual-${manualOrderId}`;
        const shipLine = manual.delivery_address ? String(manual.delivery_address) : null;
        const { data: commerceOrder, error: orderErr } = await supabase
            .from('commerce_orders')
            .insert({
            shopify_order_id: syntheticShopifyId,
            order_name: manual.order_ref,
            phone: farmer?.phone ? String(farmer.phone) : null,
            farmer_id: manual.farmer_id,
            financial_status: isPaid ? 'paid' : isCod ? 'pending' : 'pending',
            fulfillment_status: null,
            total_amount: Number(manual.total_amount) || 0,
            currency: 'INR',
            is_cod: isCod,
            order_source: 'telecaller_manual',
            payment_method: isCod ? 'COD' : isPaid ? 'Prepaid' : 'Pending',
            customer_state: farmer?.state ? String(farmer.state) : null,
            shipping_address: shipLine
                ? {
                    name: farmer?.name ? String(farmer.name) : 'Customer',
                    line1: shipLine,
                    city: farmer?.district ? String(farmer.district) : null,
                    state: farmer?.state ? String(farmer.state) : null,
                    phone: farmer?.phone ? String(farmer.phone) : null,
                }
                : null,
            oms_status: 'pending',
            raw_payload: { source: 'crm_manual_orders', manualOrderId, orderRef: manual.order_ref },
        })
            .select('*')
            .single();
        throwIfSupabaseError(orderErr, 'Create commerce order from manual');
        for (let i = 0; i < lineItems.length; i++) {
            const line = lineItems[i];
            const sku = skuFromLine(line, i);
            const qty = Number(line.quantity) || 1;
            const unitPrice = Number(line.price) || 0;
            const item = await inventoryService.upsertItemFromSku({
                sku,
                productTitle: line.title,
                shopifyVariantId: line.variantId != null ? String(line.variantId) : null,
                hsnCode: line.hsnCode ?? null,
                gstPercent: line.gstPercent ?? 18,
            });
            const { error: lineErr } = await supabase.from('commerce_order_lines').insert({
                commerce_order_id: commerceOrder.id,
                inventory_item_id: item.id,
                sku,
                product_title: line.title,
                qty_ordered: qty,
                unit_price: unitPrice,
                hsn_code: line.hsnCode ?? item.hsn_code,
                gst_percent: line.gstPercent ?? item.gst_percent,
            });
            throwIfSupabaseError(lineErr, 'Manual order line sync');
        }
        await supabase
            .from('crm_manual_orders')
            .update({
            commerce_order_id: commerceOrder.id,
            status: 'confirmed',
            updated_at: new Date().toISOString(),
        })
            .eq('id', manualOrderId);
        let pickList = null;
        try {
            pickList = await omsWorkflowService.confirmOrder(String(commerceOrder.id));
        }
        catch (err) {
            logger.error({ err, manualOrderId, commerceOrderId: commerceOrder.id }, 'OMS confirm for manual order failed');
            throw err;
        }
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: 'manual_order_pushed_to_oms',
                entityType: 'crm_manual_order',
                entityId: manualOrderId,
                details: { commerceOrderId: commerceOrder.id },
            });
        }
        return {
            commerceOrderId: commerceOrder.id,
            pickList,
            alreadyLinked: false,
        };
    },
    async tryPushOnCreate(manualOrderId, actorEmail) {
        try {
            return await this.pushToOms(manualOrderId, actorEmail);
        }
        catch (err) {
            logger.warn({ err, manualOrderId }, 'Auto-push manual order to OMS failed — retry from warehouse');
            return null;
        }
    },
};
//# sourceMappingURL=manual-order-oms.service.js.map