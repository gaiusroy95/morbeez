import { eventBus } from '../../events/bus.js';
import { supabase } from '../../lib/supabase.js';
import { getOrder } from '../shopify/shopify.client.js';
import { shiprocketRequest } from './shiprocket.client.js';
import { logger } from '../../lib/logger.js';
import { ndrRtoService } from '../oms/ndr-rto.service.js';
import { resolveTrackingUrl } from '../../lib/shipment-tracking.js';
import { AppError } from '../../lib/errors.js';
function parseAddress(addr) {
    if (!addr)
        return null;
    const name = String(addr.name ?? addr.first_name ?? 'Customer').trim();
    const parts = name.split(/\s+/);
    const first = parts[0] ?? 'Customer';
    const last = parts.slice(1).join(' ') || '';
    const pincode = String(addr.pincode ?? addr.zip ?? '').trim();
    const city = String(addr.city ?? '').trim();
    const state = String(addr.state ?? addr.province ?? '').trim();
    const line1 = String(addr.line1 ?? addr.address1 ?? '').trim();
    if (!pincode || !line1)
        return null;
    return {
        first,
        last,
        line1,
        line2: String(addr.line2 ?? addr.address2 ?? '').trim() || undefined,
        city,
        state,
        pincode,
        phone: String(addr.phone ?? '').trim() || undefined,
        country: String(addr.country ?? 'India'),
    };
}
function orderItemsFromLines(lines) {
    return lines
        .filter((l) => l.qty_ordered > 0)
        .map((l) => ({
        name: l.product_title,
        sku: l.sku ?? 'SKU',
        units: l.qty_ordered,
        selling_price: Number(l.unit_price) || 0,
    }));
}
async function loadCommerceOrder(commerceOrderId) {
    const { data, error } = await supabase
        .from('commerce_orders')
        .select('id, shopify_order_id, order_name, phone, is_cod, financial_status, total_amount, shipping_address, shiprocket_shipment_id, tracking_awb')
        .eq('id', commerceOrderId)
        .single();
    if (error || !data)
        throw new AppError('Order not found', 404, 'NOT_FOUND');
    return data;
}
async function loadOrderLines(commerceOrderId) {
    const { data, error } = await supabase
        .from('commerce_order_lines')
        .select('product_title, sku, qty_ordered, qty_cancelled, unit_price')
        .eq('commerce_order_id', commerceOrderId);
    if (error)
        throw new AppError(error.message, 500, 'DB_ERROR');
    return (data ?? [])
        .map((l) => ({
        product_title: String(l.product_title),
        sku: l.sku,
        qty_ordered: Number(l.qty_ordered) - Number(l.qty_cancelled ?? 0),
        unit_price: Number(l.unit_price),
    }))
        .filter((l) => l.qty_ordered > 0);
}
async function pickCourier(shipmentId, pincode, weight, isCod) {
    const serviceability = await shiprocketRequest('/v1/external/courier/serviceability/', {
        method: 'POST',
        body: JSON.stringify({
            shipment_id: shipmentId,
            pickup_postcode: process.env.SHIPROCKET_PICKUP_PINCODE ?? '560001',
            delivery_postcode: pincode,
            cod: isCod ? 1 : 0,
            weight,
        }),
    });
    const couriers = serviceability.data?.available_courier_companies ?? [];
    if (!couriers.length)
        return null;
    const sorted = [...couriers].sort((a, b) => Number(a.rate) - Number(b.rate));
    return sorted[0];
}
async function assignAwb(shipmentId, courierId) {
    return shiprocketRequest('/v1/external/courier/assign/awb', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: shipmentId, courier_id: courierId }),
    });
}
async function fetchLabelUrl(shipmentId) {
    const label = await shiprocketRequest('/v1/external/courier/generate/label', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [shipmentId] }),
    });
    return label.label_url ?? label.response?.label_url ?? null;
}
/** Delhivery is assigned via Shiprocket courier rules — no separate API in M2 */
export const shiprocketService = {
    async provisionForCommerceOrder(commerceOrderId) {
        const order = await loadCommerceOrder(commerceOrderId);
        if (order.tracking_awb && order.shiprocket_shipment_id) {
            const { data: refreshed } = await supabase
                .from('commerce_orders')
                .select('label_url, courier_name, tracking_url')
                .eq('id', commerceOrderId)
                .single();
            return {
                shiprocketOrderId: null,
                shipmentId: order.shiprocket_shipment_id,
                awb: order.tracking_awb,
                courier: refreshed?.courier_name ?? null,
                labelUrl: refreshed?.label_url ?? null,
                trackingUrl: refreshed?.tracking_url ?? null,
            };
        }
        const lines = await loadOrderLines(commerceOrderId);
        if (!lines.length) {
            logger.warn({ commerceOrderId }, 'No order lines — skip Shiprocket');
            return null;
        }
        const addr = parseAddress(order.shipping_address);
        if (!addr) {
            logger.warn({ commerceOrderId }, 'No shipping address — skip Shiprocket');
            return null;
        }
        const paymentMethod = order.is_cod || order.financial_status !== 'paid' ? 'COD' : 'Prepaid';
        const subTotal = Number(order.total_amount) || lines.reduce((s, l) => s + l.unit_price * l.qty_ordered, 0);
        const weight = Math.max(0.2, lines.reduce((s, l) => s + l.qty_ordered * 0.15, 0.3));
        const payload = {
            order_id: order.order_name ?? order.shopify_order_id ?? commerceOrderId.slice(0, 8),
            order_date: new Date().toISOString().slice(0, 10),
            pickup_location: 'Primary',
            billing_customer_name: addr.first,
            billing_last_name: addr.last,
            billing_address: addr.line1,
            billing_address_2: addr.line2,
            billing_city: addr.city,
            billing_pincode: addr.pincode,
            billing_state: addr.state,
            billing_country: addr.country,
            billing_phone: order.phone ?? addr.phone,
            shipping_is_billing: true,
            order_items: orderItemsFromLines(lines),
            payment_method: paymentMethod,
            sub_total: subTotal,
            length: 10,
            breadth: 10,
            height: 10,
            weight,
        };
        const created = await shiprocketRequest('/v1/external/orders/create/adhoc', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const shipmentId = Number(created.shipment_id);
        if (!shipmentId)
            throw new AppError('Shiprocket returned no shipment', 502, 'SHIPROCKET_API_ERROR');
        let awb = created.awb_code ?? null;
        let courier = created.courier_name ?? null;
        if (!awb) {
            const best = await pickCourier(shipmentId, addr.pincode, weight, paymentMethod === 'COD');
            if (best) {
                const assigned = await assignAwb(shipmentId, best.courier_company_id);
                awb =
                    assigned.response?.data?.awb_code ??
                        assigned.awb_code ??
                        null;
                courier = assigned.response?.data?.courier_name ?? assigned.courier_name ?? best.courier_name;
            }
        }
        const labelUrl = await fetchLabelUrl(shipmentId).catch((err) => {
            logger.warn({ err, commerceOrderId }, 'Shiprocket label fetch failed');
            return null;
        });
        const trackingUrl = awb ? resolveTrackingUrl({ trackingId: awb, courier }) : null;
        await supabase.from('shipment_events').insert({
            shopify_order_id: order.shopify_order_id,
            provider: 'shiprocket',
            shipment_id: String(shipmentId),
            awb,
            status: 'created',
            courier: courier ?? 'auto',
            raw_payload: { created, labelUrl },
        });
        await eventBus.publish('shipment.created', {
            commerceOrderId,
            shopifyOrderId: order.shopify_order_id,
            shipmentId,
            awb,
            phone: order.phone,
            orderName: order.order_name,
        }, 'shiprocket');
        return {
            shiprocketOrderId: created.order_id != null ? String(created.order_id) : null,
            shipmentId: String(shipmentId),
            awb,
            courier,
            labelUrl,
            trackingUrl,
        };
    },
    async createShipmentForShopifyOrder(shopifyOrderId) {
        const { data: row } = await supabase
            .from('commerce_orders')
            .select('id')
            .eq('shopify_order_id', shopifyOrderId)
            .maybeSingle();
        if (row?.id) {
            const result = await this.provisionForCommerceOrder(String(row.id));
            if (!result)
                return null;
            return { awb: result.awb, courier: result.courier ?? 'Shiprocket' };
        }
        const { order } = await getOrder(shopifyOrderId);
        const addr = order.shipping_address;
        if (!addr) {
            logger.warn({ shopifyOrderId }, 'No shipping address — skip shipment');
            return null;
        }
        const payload = {
            order_id: order.name,
            order_date: new Date().toISOString().slice(0, 10),
            pickup_location: 'Primary',
            billing_customer_name: addr.first_name ?? 'Customer',
            billing_last_name: addr.last_name ?? '',
            billing_address: addr.address1,
            billing_city: addr.city,
            billing_pincode: addr.zip,
            billing_state: addr.province,
            billing_country: addr.country ?? 'India',
            billing_phone: order.phone ?? addr.phone,
            shipping_is_billing: true,
            order_items: order.line_items.map((li) => ({
                name: li.title,
                sku: li.sku ?? 'SKU',
                units: li.quantity,
                selling_price: 0,
            })),
            payment_method: order.financial_status === 'paid' ? 'Prepaid' : 'COD',
            sub_total: parseFloat(order.total_price),
            length: 10,
            breadth: 10,
            height: 10,
            weight: 0.5,
        };
        const result = await shiprocketRequest('/v1/external/orders/create/adhoc', { method: 'POST', body: JSON.stringify(payload) });
        const awb = result.awb_code ?? null;
        await supabase.from('shipment_events').insert({
            shopify_order_id: shopifyOrderId,
            provider: 'shiprocket',
            shipment_id: String(result.shipment_id),
            awb,
            status: 'created',
            courier: 'auto',
            raw_payload: result,
        });
        const { data: orderRow } = await supabase
            .from('commerce_orders')
            .select('phone, order_name')
            .eq('shopify_order_id', shopifyOrderId)
            .maybeSingle();
        await eventBus.publish('shipment.created', {
            shopifyOrderId,
            shipmentId: result.shipment_id,
            awb,
            phone: orderRow?.phone ?? order.phone,
            orderName: orderRow?.order_name ?? order.name,
        }, 'shiprocket');
        return { awb, courier: 'Shiprocket' };
    },
    async handleTrackingWebhook(body) {
        const awb = String(body.awb ?? '');
        const status = String(body.current_status ?? body.shipment_status ?? 'unknown');
        const orderId = body.order_id != null ? String(body.order_id) : undefined;
        await supabase.from('shipment_events').insert({
            shopify_order_id: orderId,
            provider: 'shiprocket',
            awb,
            status,
            event_type: 'tracking.update',
            raw_payload: body,
        });
        if (orderId) {
            const trackUrl = awb ? resolveTrackingUrl({ trackingId: awb, courier: 'Delhivery' }) : null;
            await supabase
                .from('commerce_orders')
                .update({
                tracking_awb: awb || undefined,
                tracking_url: trackUrl ?? undefined,
                fulfillment_status: status,
                updated_at: new Date().toISOString(),
            })
                .eq('shopify_order_id', orderId);
        }
        else if (awb) {
            const trackUrl = resolveTrackingUrl({ trackingId: awb, courier: 'Delhivery' });
            await supabase
                .from('commerce_orders')
                .update({
                tracking_awb: awb,
                tracking_url: trackUrl ?? undefined,
                fulfillment_status: status,
                updated_at: new Date().toISOString(),
            })
                .eq('tracking_awb', awb);
        }
        const statusLower = status.toLowerCase();
        if (/pick|ship|dispatch|out for delivery|in transit|transit/.test(statusLower) &&
            !statusLower.includes('delivered')) {
            await eventBus.publish('shipment.dispatched', { awb, status, shopifyOrderId: orderId }, 'shiprocket');
        }
        if (statusLower.includes('delivered')) {
            await eventBus.publish('shipment.delivered', { awb, status, shopifyOrderId: orderId }, 'shiprocket');
        }
        await ndrRtoService
            .detectFromTrackingStatus(orderId, status, body)
            .catch((err) => logger.error({ err, orderId, status }, 'NDR/RTO detection failed'));
    },
};
//# sourceMappingURL=shiprocket.service.js.map