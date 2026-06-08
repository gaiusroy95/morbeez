import { env } from '../../config/env.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { shiprocketService } from '../shiprocket/shiprocket.service.js';
import { verifyShiprocketAuth } from '../shiprocket/shiprocket.client.js';
function isPaid(row) {
    const fs = String(row.financial_status ?? '').toLowerCase();
    const ps = String(row.fulfillment_status ?? '').toLowerCase();
    if (fs === 'voided' || fs === 'refunded' || ps === 'cancelled')
        return false;
    return fs === 'paid' || fs === 'partially_paid';
}
function needsShipment(row) {
    if (!row.shopify_order_id)
        return false;
    if (!isPaid(row))
        return false;
    const ful = String(row.fulfillment_status ?? '').toLowerCase();
    if (ful === 'delivered' || ful === 'fulfilled' || ful === 'cancelled')
        return false;
    if (row.tracking_awb?.trim())
        return false;
    return true;
}
function formatDisplayId(orderName, id) {
    if (orderName) {
        const digits = orderName.replace(/\D/g, '');
        if (digits)
            return `ORD${digits}`;
    }
    return `ORD${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
export const shiprocketAdminService = {
    getOverview() {
        const apiBase = env.API_BASE_URL?.replace(/\/$/, '') ?? '';
        const webhookPath = '/webhooks/tracking';
        return {
            configured: Boolean(env.SHIPROCKET_EMAIL?.trim() && env.SHIPROCKET_PASSWORD?.trim()),
            autoShipEnabled: env.ENABLE_SHIPROCKET_AUTO_SHIP,
            shipAfterPackEnabled: env.ENABLE_SHIPROCKET_AFTER_PACK !== false,
            dashboardUrl: 'https://app.shiprocket.in/',
            webhookPath,
            webhookUrl: apiBase ? `${apiBase}${webhookPath}` : null,
            webhookTokenConfigured: Boolean(env.SHIPROCKET_WEBHOOK_TOKEN?.trim()),
            webhookReady: Boolean(env.SHIPROCKET_WEBHOOK_TOKEN?.trim() && apiBase),
        };
    },
    async getAuthStatus() {
        return verifyShiprocketAuth();
    },
    async listPending(limit = 25) {
        const { data, error } = await supabase
            .from('commerce_orders')
            .select('id, shopify_order_id, order_name, phone, financial_status, fulfillment_status, tracking_awb, total_amount, created_at')
            .not('shopify_order_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(300);
        throwIfSupabaseError(error, 'Could not load orders');
        const pending = (data ?? [])
            .filter((r) => needsShipment(r))
            .slice(0, limit)
            .map((r) => {
            const row = r;
            return {
                id: row.id,
                shopifyOrderId: row.shopify_order_id,
                displayOrderId: formatDisplayId(row.order_name, row.id),
                orderName: row.order_name,
                phone: row.phone,
                amount: Number(row.total_amount) || 0,
                financialStatus: row.financial_status,
                fulfillmentStatus: row.fulfillment_status,
                createdAt: row.created_at,
            };
        });
        return { pending, total: pending.length };
    },
    async listRecentEvents(limit = 30) {
        const safeLimit = Math.min(100, Math.max(5, limit));
        const { data, error } = await supabase
            .from('shipment_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(safeLimit);
        throwIfSupabaseError(error, 'Could not load shipment events');
        const shopifyIds = [
            ...new Set((data ?? [])
                .map((e) => e.shopify_order_id)
                .filter(Boolean)),
        ];
        const orderByShopify = new Map();
        if (shopifyIds.length) {
            const { data: orders } = await supabase
                .from('commerce_orders')
                .select('shopify_order_id, order_name, phone')
                .in('shopify_order_id', shopifyIds);
            for (const o of orders ?? []) {
                orderByShopify.set(String(o.shopify_order_id), {
                    orderName: o.order_name ? String(o.order_name) : null,
                    phone: o.phone ? String(o.phone) : null,
                });
            }
        }
        const events = (data ?? []).map((e) => {
            const shopifyOrderId = e.shopify_order_id ? String(e.shopify_order_id) : null;
            const meta = shopifyOrderId ? orderByShopify.get(shopifyOrderId) : undefined;
            return {
                id: String(e.id),
                shopifyOrderId,
                provider: String(e.provider ?? 'shiprocket'),
                shipmentId: e.shipment_id ? String(e.shipment_id) : null,
                awb: e.awb ? String(e.awb) : null,
                courier: e.courier ? String(e.courier) : null,
                status: e.status ? String(e.status) : null,
                eventType: e.event_type ? String(e.event_type) : null,
                createdAt: String(e.created_at),
                orderName: meta?.orderName ?? null,
                phone: meta?.phone ?? null,
            };
        });
        return { events };
    },
    async retryCreateShipment(shopifyOrderId) {
        const id = shopifyOrderId.trim();
        if (!id)
            throw new ValidationError('Shopify order id is required');
        const { data, error } = await supabase
            .from('commerce_orders')
            .select('id, shopify_order_id, financial_status, tracking_awb')
            .eq('shopify_order_id', id)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load order');
        if (!data)
            throw new NotFoundError('Order not found for this Shopify id');
        if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
            throw new ValidationError('Shiprocket is not configured on the API server');
        }
        await shiprocketService.createShipmentForShopifyOrder(id);
        const [{ data: updated }, { data: evt }] = await Promise.all([
            supabase
                .from('commerce_orders')
                .select('tracking_awb, fulfillment_status')
                .eq('shopify_order_id', id)
                .maybeSingle(),
            supabase
                .from('shipment_events')
                .select('awb, shipment_id, status')
                .eq('shopify_order_id', id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);
        const awb = updated?.tracking_awb ?? evt?.awb ?? null;
        return {
            ok: true,
            shopifyOrderId: id,
            trackingAwb: awb ? String(awb) : null,
            shipmentId: evt?.shipment_id ? String(evt.shipment_id) : null,
            status: evt?.status ? String(evt.status) : null,
            fulfillmentStatus: updated?.fulfillment_status ?? null,
        };
    },
};
//# sourceMappingURL=shiprocket-admin.service.js.map