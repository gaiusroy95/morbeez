import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { resolveTrackingUrl } from '../../lib/shipment-tracking.js';
function formatDt(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }
    catch {
        return String(iso);
    }
}
function formatDisplayOrderId(orderName, id, orderRef) {
    if (orderRef?.startsWith('CRM-'))
        return orderRef;
    if (orderName) {
        const digits = orderName.replace(/\D/g, '');
        if (digits)
            return `ORD-${digits}`;
        if (orderName.startsWith('#'))
            return `ORD${orderName.slice(1)}`;
    }
    return `ORD-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
function normalizePhone(phone) {
    if (!phone)
        return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits || null;
}
function resolveCommerceStatus(row) {
    const raw = row.raw_payload;
    if (raw?.cancelled_at)
        return 'cancelled';
    const fs = String(row.financial_status ?? '').toLowerCase();
    const ful = String(row.fulfillment_status ?? '').toLowerCase();
    if (fs === 'voided' || fs === 'refunded')
        return 'cancelled';
    if (ful === 'fulfilled' || ful === 'delivered')
        return 'delivered';
    if (ful === 'shipped' || ful === 'in_transit' || ful === 'partial')
        return 'shipped';
    if (fs === 'paid' || row.razorpay_payment_id)
        return 'processing';
    if (row.is_cod)
        return 'pending';
    return 'pending';
}
function commercePaymentMeta(row, status) {
    if (status === 'cancelled') {
        return { paymentLabel: 'Refunded', paymentSubtext: '', paymentTone: 'purple' };
    }
    if (row.is_cod) {
        return { paymentLabel: 'Paid', paymentSubtext: 'COD', paymentTone: 'success' };
    }
    const raw = row.raw_payload;
    const gateways = raw?.payment_gateway_names ?? [];
    if (gateways.some((g) => /card/i.test(g))) {
        return { paymentLabel: 'Paid', paymentSubtext: 'Online (Card)', paymentTone: 'success' };
    }
    if (row.razorpay_payment_id || gateways.some((g) => /upi|razorpay/i.test(g))) {
        return { paymentLabel: 'Paid', paymentSubtext: 'Online (UPI)', paymentTone: 'success' };
    }
    const fs = String(row.financial_status ?? '').toLowerCase();
    if (fs === 'paid') {
        return { paymentLabel: 'Paid', paymentSubtext: 'Online', paymentTone: 'success' };
    }
    return { paymentLabel: 'Pending', paymentSubtext: '', paymentTone: 'warning' };
}
function statusMeta(status) {
    switch (status) {
        case 'delivered':
            return { statusLabel: 'Delivered', statusTone: 'success' };
        case 'shipped':
            return { statusLabel: 'Shipped', statusTone: 'info' };
        case 'processing':
        case 'confirmed':
            return { statusLabel: 'Processing', statusTone: 'warning' };
        case 'cancelled':
            return { statusLabel: 'Cancelled', statusTone: 'danger' };
        default:
            return { statusLabel: 'Pending', statusTone: 'warning' };
    }
}
function extractCommerceLineItems(raw) {
    if (!raw || !Array.isArray(raw.line_items))
        return [];
    return raw.line_items.map((li) => {
        const image = li.image;
        return {
            title: String(li.title ?? li.name ?? 'Product'),
            quantity: Number(li.quantity) || 1,
            price: li.price != null ? Number(li.price) : undefined,
            imageUrl: image?.src ?? null,
            shopifyProductId: li.product_id != null ? String(li.product_id) : null,
            shopifyVariantId: li.variant_id != null ? String(li.variant_id) : null,
            sku: li.sku ? String(li.sku) : null,
        };
    });
}
function manualStatus(raw) {
    const s = raw.toLowerCase();
    if (s === 'fulfilled')
        return 'delivered';
    if (s === 'confirmed')
        return 'processing';
    if (s === 'cancelled')
        return 'cancelled';
    return 'pending';
}
function manualPaymentMeta(status, paymentMode) {
    if (status === 'cancelled') {
        return { paymentLabel: 'Refunded', paymentSubtext: '', paymentTone: 'purple' };
    }
    const mode = String(paymentMode ?? '').toLowerCase();
    if (mode.includes('cod')) {
        return { paymentLabel: 'Paid', paymentSubtext: 'COD', paymentTone: 'success' };
    }
    if (mode.includes('upi')) {
        return { paymentLabel: 'Paid', paymentSubtext: 'Online (UPI)', paymentTone: 'success' };
    }
    if (mode.includes('card')) {
        return { paymentLabel: 'Paid', paymentSubtext: 'Online (Card)', paymentTone: 'success' };
    }
    if (status === 'delivered' || status === 'processing') {
        return { paymentLabel: 'Paid', paymentSubtext: mode || 'CRM', paymentTone: 'success' };
    }
    return { paymentLabel: 'Pending', paymentSubtext: mode || '', paymentTone: 'warning' };
}
function mapManualRow(r) {
    const items = r.line_items ?? [];
    const block = r.farm_blocks;
    const status = manualStatus(String(r.status ?? 'pending'));
    const st = statusMeta(status);
    const pay = manualPaymentMeta(status, r.payment_mode ? String(r.payment_mode) : null);
    const createdAt = String(r.created_at);
    const internalId = String(r.id);
    const orderRef = r.order_ref ? String(r.order_ref) : null;
    return {
        id: internalId,
        orderId: formatDisplayOrderId(null, internalId, orderRef),
        orderRef,
        createdAt,
        dateLabel: formatDt(createdAt),
        lineItems: items.map((i) => ({ ...i, imageUrl: i.imageUrl ?? null })),
        productTitle: items[0]?.title ?? 'Order',
        productImageUrl: items[0]?.imageUrl ?? null,
        qty: items.reduce((s, i) => s + (i.quantity || 1), 0),
        amount: Number(r.total_amount) || 0,
        status,
        statusLabel: st.statusLabel,
        statusTone: st.statusTone,
        paymentLabel: pay.paymentLabel,
        paymentSubtext: pay.paymentSubtext,
        paymentTone: pay.paymentTone,
        deliveryDateLabel: status === 'delivered' ? formatDt(createdAt) : '—',
        deliveryBy: 'Morbeez Delivery',
        blockName: block?.name ?? null,
        blockId: r.block_id ? String(r.block_id) : null,
        source: 'crm_manual',
        commerceOrderId: r.commerce_order_id ? String(r.commerce_order_id) : null,
        notes: r.notes ? String(r.notes) : null,
        deliveryAddress: r.delivery_address ? String(r.delivery_address) : null,
        createdBy: r.created_by ? String(r.created_by) : null,
    };
}
function mapCommerceRow(r) {
    const raw = r.raw_payload ?? null;
    const lineItems = extractCommerceLineItems(raw);
    const status = resolveCommerceStatus(r);
    const st = statusMeta(status);
    const pay = commercePaymentMeta(r, status);
    const createdAt = String(r.created_at);
    const internalId = String(r.id);
    const orderName = r.order_name ? String(r.order_name) : null;
    const expected = r.expected_delivery_at ? formatDt(String(r.expected_delivery_at)) : null;
    const trackingAwb = r.tracking_awb ? String(r.tracking_awb) : null;
    const courier = trackingAwb ? 'Delhivery' : null;
    const trackingUrl = resolveTrackingUrl({
        trackingId: trackingAwb,
        trackingUrl: r.tracking_url ? String(r.tracking_url) : null,
        courier,
    });
    return {
        id: internalId,
        orderId: formatDisplayOrderId(orderName, internalId),
        orderRef: orderName,
        createdAt,
        dateLabel: formatDt(createdAt),
        lineItems: lineItems.length ? lineItems : [{ title: orderName ?? 'Shopify order', quantity: 1 }],
        productTitle: lineItems[0]?.title ?? orderName ?? 'Order',
        productImageUrl: lineItems[0]?.imageUrl ?? null,
        qty: lineItems.reduce((s, i) => s + i.quantity, 0) || 1,
        amount: Number(r.total_amount) || 0,
        status,
        statusLabel: st.statusLabel,
        statusTone: st.statusTone,
        paymentLabel: pay.paymentLabel,
        paymentSubtext: pay.paymentSubtext,
        paymentTone: pay.paymentTone,
        deliveryDateLabel: status === 'delivered'
            ? formatDt(r.updated_at ?? createdAt)
            : expected ?? '—',
        deliveryBy: trackingAwb ? 'Delhivery' : 'Morbeez Delivery',
        trackingAwb,
        trackingUrl,
        courier,
        blockName: null,
        blockId: null,
        source: 'commerce',
        commerceOrderId: String(r.id),
        notes: null,
        deliveryAddress: null,
        createdBy: null,
    };
}
export const telecallerFarmerOrdersService = {
    async listForFarmer(farmerId) {
        const { data: farmer, error: farmerErr } = await supabase
            .from('farmers')
            .select('phone')
            .eq('id', farmerId)
            .single();
        throwIfSupabaseError(farmerErr, 'Could not load farmer');
        const phone = normalizePhone(farmer?.phone);
        const [manualRes, commerceRes] = await Promise.all([
            supabase
                .from('crm_manual_orders')
                .select('*, farm_blocks(name)')
                .eq('farmer_id', farmerId)
                .order('created_at', { ascending: false })
                .limit(100),
            supabase
                .from('commerce_orders')
                .select('*')
                .or(phone
                ? `farmer_id.eq.${farmerId},phone.ilike.%${phone}%`
                : `farmer_id.eq.${farmerId}`)
                .order('created_at', { ascending: false })
                .limit(100),
        ]);
        throwIfSupabaseError(manualRes.error, 'Could not load orders');
        throwIfSupabaseError(commerceRes.error, 'Could not load orders');
        const manual = (manualRes.data ?? []).map((r) => mapManualRow(r));
        const commerce = (commerceRes.data ?? [])
            .filter((row) => {
            if (row.farmer_id === farmerId)
                return true;
            if (!phone)
                return false;
            return normalizePhone(String(row.phone ?? '')) === phone;
        })
            .map((r) => mapCommerceRow(r));
        const orders = [...manual, ...commerce].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { orders };
    },
    async getDetail(farmerId, orderId) {
        const { data: manual } = await supabase
            .from('crm_manual_orders')
            .select('*, farm_blocks(name)')
            .eq('farmer_id', farmerId)
            .or(`id.eq.${orderId},order_ref.eq.${orderId}`)
            .maybeSingle();
        if (manual)
            return mapManualRow(manual);
        const { data: commerce, error } = await supabase
            .from('commerce_orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load order');
        if (!commerce)
            throw new NotFoundError('Order not found');
        const { data: farmer } = await supabase.from('farmers').select('phone').eq('id', farmerId).single();
        const phone = normalizePhone(farmer?.phone);
        const matchesFarmer = commerce.farmer_id === farmerId ||
            (phone && normalizePhone(String(commerce.phone ?? '')) === phone);
        if (!matchesFarmer)
            throw new NotFoundError('Order not found');
        return mapCommerceRow(commerce);
    },
};
//# sourceMappingURL=telecaller-farmer-orders.service.js.map