import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { getOrder } from '../shopify/shopify.client.js';
import { shopifyWebhookService } from '../shopify/shopify.webhook.service.js';
import { inventoryService } from '../wms/inventory.service.js';
import { omsWorkflowService } from './workflow.service.js';
import { logger } from '../../lib/logger.js';
import { normalizeShopifyCountry, normalizeShopifyPincode, normalizeShopifyProvince, } from '../../lib/shopify-address.js';
function skuFromQuoteLine(line, index) {
    if (line.sku?.trim())
        return line.sku.trim();
    if (line.variantId)
        return `VAR-${line.variantId}`;
    const slug = line.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40);
    return slug ? `QT-${slug}` : `QT-LINE-${index + 1}`;
}
export const quoteOmsBridgeService = {
    /** Sync a Shopify order into commerce_orders + lines and auto-confirm for warehouse picking. */
    async syncShopifyOrderToWarehouse(input) {
        const { order } = await getOrder(input.shopifyOrderId);
        await shopifyWebhookService.syncOrder(order);
        const { data: commerceOrder, error } = await supabase
            .from('commerce_orders')
            .select('id, oms_status')
            .eq('shopify_order_id', input.shopifyOrderId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Commerce order lookup after quote sync');
        if (!commerceOrder?.id) {
            logger.error({ shopifyOrderId: input.shopifyOrderId }, 'Commerce order missing after sync');
            return { commerceOrderId: null, omsStatus: null };
        }
        const patch = {
            order_source: 'telecaller_quote',
            updated_at: new Date().toISOString(),
        };
        if (input.farmerId)
            patch.farmer_id = input.farmerId;
        if (input.paymentMethod)
            patch.payment_method = input.paymentMethod;
        await supabase.from('commerce_orders').update(patch).eq('id', commerceOrder.id);
        if (input.quoteId) {
            await supabase
                .from('commerce_quotes')
                .update({
                commerce_order_id: commerceOrder.id,
                updated_at: new Date().toISOString(),
            })
                .eq('id', input.quoteId);
        }
        return {
            commerceOrderId: commerceOrder.id,
            omsStatus: commerceOrder.oms_status,
            orderName: order.name,
        };
    },
    /**
     * Fallback when Shopify order API fails after Razorpay payment is already captured.
     * Creates commerce_orders + lines locally and enters the warehouse pipeline.
     */
    async createLocalOrderFromQuote(input) {
        const mode = input.fulfillmentMode ?? 'paid';
        const syntheticId = mode === 'cod' ? `quote-cod-${input.quoteId}` : `quote-paid-${input.quoteId}`;
        const { data: existing } = await supabase
            .from('commerce_orders')
            .select('id')
            .eq('shopify_order_id', syntheticId)
            .maybeSingle();
        if (existing?.id) {
            const pickList = await omsWorkflowService.getOrderWorkflow(String(existing.id));
            return {
                commerceOrderId: existing.id,
                shopifyOrderId: syntheticId,
                orderName: input.quoteNumber,
                order: pickList,
                alreadyExists: true,
            };
        }
        const ship = input.shippingAddress;
        const isCod = input.codAmount > 0;
        const { data: commerceOrder, error: orderErr } = await supabase
            .from('commerce_orders')
            .insert({
            shopify_order_id: syntheticId,
            order_name: input.quoteNumber,
            email: input.customerEmail,
            phone: input.customerPhone,
            farmer_id: input.farmerId ?? null,
            financial_status: mode === 'cod' ? 'pending' : 'paid',
            total_amount: input.total,
            currency: 'INR',
            is_cod: isCod,
            razorpay_payment_id: input.razorpayPaymentId,
            order_source: 'telecaller_quote',
            payment_method: isCod ? 'COD' : 'Prepaid',
            customer_state: normalizeShopifyProvince(input.customerState),
            shipping_address: {
                name: input.customerName,
                line1: ship.address1 ?? ship.address ?? 'Address on file',
                city: ship.city ?? input.customerState,
                state: normalizeShopifyProvince(ship.state ?? input.customerState),
                pincode: normalizeShopifyPincode(ship.pincode ?? ship.zip),
                country: normalizeShopifyCountry(ship.country),
                phone: input.customerPhone,
            },
            oms_status: 'pending',
            raw_payload: {
                source: 'commerce_quotes_local',
                quoteId: input.quoteId,
                razorpayOrderId: input.razorpayOrderId,
            },
        })
            .select('*')
            .single();
        throwIfSupabaseError(orderErr, 'Local quote commerce order');
        for (let i = 0; i < input.lineItems.length; i++) {
            const line = input.lineItems[i];
            const sku = skuFromQuoteLine(line, i);
            const item = await inventoryService.upsertItemFromSku({
                sku,
                productTitle: line.title,
                shopifyVariantId: line.variantId != null ? String(line.variantId) : null,
                hsnCode: line.hsnCode ?? null,
                gstPercent: line.gstPercent ?? 18,
            });
            await supabase.from('commerce_order_lines').insert({
                commerce_order_id: commerceOrder.id,
                inventory_item_id: item.id,
                sku,
                product_title: line.title,
                qty_ordered: line.qty,
                unit_price: line.unitPrice,
                hsn_code: line.hsnCode ?? item.hsn_code,
                gst_percent: line.gstPercent ?? item.gst_percent,
            });
        }
        await supabase
            .from('commerce_quotes')
            .update({
            commerce_order_id: commerceOrder.id,
            shopify_order_id: syntheticId,
            shopify_order_name: input.quoteNumber,
            updated_at: new Date().toISOString(),
        })
            .eq('id', input.quoteId);
        const pickList = await omsWorkflowService.confirmOrder(String(commerceOrder.id));
        return {
            commerceOrderId: commerceOrder.id,
            shopifyOrderId: syntheticId,
            orderName: input.quoteNumber,
            pickList,
            alreadyExists: false,
        };
    },
    async listQuoteQueue(limit = 30) {
        const { data: quotes, error } = await supabase
            .from('commerce_quotes')
            .select('id, quote_number, status, customer_name, total, prepaid_amount, cod_amount, commerce_order_id, shopify_order_id, created_at, updated_at')
            .in('status', ['checkout', 'paid'])
            .order('updated_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Quote queue');
        const rows = quotes ?? [];
        const orderIds = rows.map((q) => q.commerce_order_id).filter(Boolean);
        let pickByOrder = new Map();
        if (orderIds.length) {
            const { data: picks } = await supabase
                .from('pick_lists')
                .select('id, commerce_order_id, status')
                .in('commerce_order_id', orderIds);
            pickByOrder = new Map((picks ?? []).map((p) => [String(p.commerce_order_id), String(p.status)]));
        }
        return rows.map((q) => {
            const commerceOrderId = q.commerce_order_id ? String(q.commerce_order_id) : null;
            const pickStatus = commerceOrderId ? pickByOrder.get(commerceOrderId) : undefined;
            let queueStatus = 'awaiting_payment';
            if (q.status === 'paid' || commerceOrderId) {
                queueStatus = pickStatus ? 'in_warehouse' : 'awaiting_warehouse';
            }
            if (q.status === 'checkout')
                queueStatus = 'awaiting_payment';
            return {
                id: q.id,
                quoteNumber: q.quote_number,
                status: q.status,
                customerName: q.customer_name,
                total: Number(q.total),
                prepaidAmount: Number(q.prepaid_amount),
                codAmount: Number(q.cod_amount),
                commerceOrderId,
                shopifyOrderId: q.shopify_order_id,
                pickStatus: pickStatus ?? null,
                queueStatus,
                updatedAt: q.updated_at,
            };
        });
    },
};
//# sourceMappingURL=quote-oms-bridge.service.js.map