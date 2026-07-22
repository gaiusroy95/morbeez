import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { getOrder } from '../shopify/shopify.client.js';
import { shopifyWebhookService } from '../shopify/shopify.webhook.service.js';
import { omsWorkflowService } from '../oms/workflow.service.js';
import { logger } from '../../lib/logger.js';
const FULFILLMENT_STATUSES = new Set([
    'confirmed',
    'awb_generated',
    'picking',
    'packed',
    'ready_dispatch',
    'shipped',
    'delivered',
    'completed',
]);
export const checkoutOmsBridgeService = {
    /** Sync a storefront Razorpay checkout into commerce_orders and enter warehouse picking. */
    async syncToWarehouse(input) {
        let order;
        try {
            ({ order } = await getOrder(input.shopifyOrderId));
        }
        catch (err) {
            logger.warn({ err, shopifyOrderId: input.shopifyOrderId }, 'Shopify order not found for checkout warehouse sync');
            return { commerceOrderId: null, omsStatus: null, orderName: null };
        }
        await shopifyWebhookService.syncOrder(order);
        const { data: commerceOrder, error } = await supabase
            .from('commerce_orders')
            .select('id, oms_status')
            .eq('shopify_order_id', input.shopifyOrderId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Commerce order lookup after checkout sync');
        if (!commerceOrder?.id) {
            logger.error({ shopifyOrderId: input.shopifyOrderId }, 'Commerce order missing after checkout sync');
            return { commerceOrderId: null, omsStatus: null, orderName: order.name };
        }
        const patch = {
            order_source: 'website',
            payment_method: 'Prepaid',
            updated_at: new Date().toISOString(),
        };
        if (input.razorpayPaymentId)
            patch.razorpay_payment_id = input.razorpayPaymentId;
        await supabase.from('commerce_orders').update(patch).eq('id', commerceOrder.id);
        let omsStatus = String(commerceOrder.oms_status ?? 'pending');
        if (omsStatus === 'pending') {
            await omsWorkflowService.confirmOrder(String(commerceOrder.id));
            const { data: refreshed } = await supabase
                .from('commerce_orders')
                .select('oms_status')
                .eq('id', commerceOrder.id)
                .maybeSingle();
            omsStatus = String(refreshed?.oms_status ?? 'confirmed');
        }
        return {
            commerceOrderId: commerceOrder.id,
            omsStatus,
            orderName: order.name,
        };
    },
    /** Backfill paid storefront checkouts that never reached commerce_orders / warehouse. */
    async repairUnsyncedPaidCheckouts(limit = 30) {
        const { data: sessions, error } = await supabase
            .from('checkout_sessions')
            .select('id, shopify_order_id, razorpay_payment_id, status')
            .eq('status', 'paid')
            .not('shopify_order_id', 'is', null)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .limit(limit * 3);
        throwIfSupabaseError(error, 'Load paid checkout sessions for warehouse repair');
        const shopifyIds = [
            ...new Set((sessions ?? [])
                .map((s) => (s.shopify_order_id ? String(s.shopify_order_id) : ''))
                .filter(Boolean)),
        ];
        if (!shopifyIds.length)
            return { repaired: 0, failed: 0, scanned: 0 };
        const { data: commerceRows, error: commerceErr } = await supabase
            .from('commerce_orders')
            .select('id, shopify_order_id, oms_status, deleted_at')
            .in('shopify_order_id', shopifyIds);
        throwIfSupabaseError(commerceErr, 'Load commerce orders for checkout repair');
        const commerceByShopify = new Map((commerceRows ?? []).map((row) => [String(row.shopify_order_id), row]));
        const needsSync = (sessions ?? []).filter((session) => {
            const shopifyOrderId = String(session.shopify_order_id);
            const commerce = commerceByShopify.get(shopifyOrderId);
            if (!commerce || commerce.deleted_at)
                return true;
            return !FULFILLMENT_STATUSES.has(String(commerce.oms_status ?? 'pending'));
        });
        let repaired = 0;
        let failed = 0;
        for (const session of needsSync.slice(0, limit)) {
            try {
                const result = await this.syncToWarehouse({
                    shopifyOrderId: String(session.shopify_order_id),
                    razorpayPaymentId: session.razorpay_payment_id
                        ? String(session.razorpay_payment_id)
                        : undefined,
                });
                if (result.commerceOrderId)
                    repaired += 1;
                else
                    failed += 1;
            }
            catch (err) {
                failed += 1;
                logger.warn({ err, checkoutSessionId: session.id, shopifyOrderId: session.shopify_order_id }, 'Paid checkout warehouse repair failed');
            }
        }
        return { repaired, failed, scanned: needsSync.length };
    },
};
//# sourceMappingURL=checkout-oms-bridge.service.js.map