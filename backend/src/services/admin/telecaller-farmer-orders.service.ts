import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { resolveTrackingUrl } from '../../lib/shipment-tracking.js';

export type TelecallerOrderLine = {
  title: string;
  quantity: number;
  price?: number;
  imageUrl?: string | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  sku?: string | null;
};

export type TelecallerOrderRow = {
  id: string;
  orderId: string;
  orderRef: string | null;
  createdAt: string;
  dateLabel: string;
  lineItems: TelecallerOrderLine[];
  productTitle: string;
  productImageUrl: string | null;
  qty: number;
  amount: number;
  status: string;
  statusLabel: string;
  statusTone: string;
  paymentLabel: string;
  paymentSubtext: string;
  paymentTone: string;
  deliveryDateLabel: string;
  deliveryBy: string;
  trackingAwb?: string | null;
  trackingUrl?: string | null;
  courier?: string | null;
  blockName: string | null;
  blockId: string | null;
  source: 'crm_manual' | 'commerce';
  commerceOrderId?: string | null;
  notes?: string | null;
  deliveryAddress?: string | null;
  createdBy?: string | null;
};

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(iso);
  }
}

function formatDisplayOrderId(orderName: string | null | undefined, id: string, orderRef?: string | null): string {
  if (orderRef?.startsWith('CRM-')) return orderRef;
  if (orderName) {
    const digits = orderName.replace(/\D/g, '');
    if (digits) return `ORD-${digits}`;
    if (orderName.startsWith('#')) return `ORD${orderName.slice(1)}`;
  }
  return `ORD-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits || null;
}

function resolveCommerceStatus(row: Record<string, unknown>): string {
  const raw = row.raw_payload as Record<string, unknown> | null;
  if (raw?.cancelled_at) return 'cancelled';
  const fs = String(row.financial_status ?? '').toLowerCase();
  const ful = String(row.fulfillment_status ?? '').toLowerCase();
  if (fs === 'voided' || fs === 'refunded') return 'cancelled';
  if (ful === 'fulfilled' || ful === 'delivered') return 'delivered';
  if (ful === 'shipped' || ful === 'in_transit' || ful === 'partial') return 'shipped';
  if (fs === 'paid' || row.razorpay_payment_id) return 'processing';
  if (row.is_cod) return 'pending';
  return 'pending';
}

function commercePaymentMeta(row: Record<string, unknown>, status: string): {
  paymentLabel: string;
  paymentSubtext: string;
  paymentTone: string;
} {
  if (status === 'cancelled') {
    return { paymentLabel: 'Refunded', paymentSubtext: '', paymentTone: 'purple' };
  }
  if (row.is_cod) {
    return { paymentLabel: 'Paid', paymentSubtext: 'COD', paymentTone: 'success' };
  }
  const raw = row.raw_payload as Record<string, unknown> | null;
  const gateways = (raw?.payment_gateway_names as string[] | undefined) ?? [];
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

function statusMeta(status: string): { statusLabel: string; statusTone: string } {
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

function extractCommerceLineItems(raw: Record<string, unknown> | null): TelecallerOrderLine[] {
  if (!raw || !Array.isArray(raw.line_items)) return [];
  return (raw.line_items as Record<string, unknown>[]).map((li) => {
    const image = li.image as { src?: string } | undefined;
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

function manualStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s === 'fulfilled') return 'delivered';
  if (s === 'confirmed') return 'processing';
  if (s === 'cancelled') return 'cancelled';
  return 'pending';
}

function manualPaymentMeta(status: string, paymentMode: string | null): {
  paymentLabel: string;
  paymentSubtext: string;
  paymentTone: string;
} {
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

function mapManualRow(r: Record<string, unknown>): TelecallerOrderRow {
  const items = (r.line_items as TelecallerOrderLine[]) ?? [];
  const block = r.farm_blocks as { name?: string } | null;
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

function mapCommerceRow(r: Record<string, unknown>): TelecallerOrderRow {
  const raw = (r.raw_payload as Record<string, unknown> | null) ?? null;
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
    deliveryDateLabel:
      status === 'delivered'
        ? formatDt((r.updated_at as string) ?? createdAt)
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
  async listForFarmer(farmerId: string) {
    const { data: farmer, error: farmerErr } = await supabase
      .from('farmers')
      .select('phone')
      .eq('id', farmerId)
      .single();
    throwIfSupabaseError(farmerErr, 'Could not load farmer');
    const phone = normalizePhone(farmer?.phone as string);

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
        .is('deleted_at', null)
        .or(
          phone
            ? `farmer_id.eq.${farmerId},phone.ilike.%${phone}%`
            : `farmer_id.eq.${farmerId}`
        )
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    throwIfSupabaseError(manualRes.error, 'Could not load orders');
    throwIfSupabaseError(commerceRes.error, 'Could not load orders');

    const visibleCommerceIds = new Set(
      (commerceRes.data ?? []).map((r) => String(r.id))
    );

    const manual = (manualRes.data ?? [])
      .filter((r) => {
        const linkedCommerceId = r.commerce_order_id ? String(r.commerce_order_id) : null;
        if (!linkedCommerceId) return true;
        return visibleCommerceIds.has(linkedCommerceId);
      })
      .map((r) => mapManualRow(r as Record<string, unknown>));
    const commerce = (commerceRes.data ?? [])
      .filter((row) => {
        if (row.farmer_id === farmerId) return true;
        if (!phone) return false;
        return normalizePhone(String(row.phone ?? '')) === phone;
      })
      .map((r) => mapCommerceRow(r as Record<string, unknown>));

    const orders = [...manual, ...commerce].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { orders };
  },

  async getDetail(farmerId: string, orderId: string) {
    const { data: manual } = await supabase
      .from('crm_manual_orders')
      .select('*, farm_blocks(name)')
      .eq('farmer_id', farmerId)
      .or(`id.eq.${orderId},order_ref.eq.${orderId}`)
      .maybeSingle();

    if (manual) {
      const linkedCommerceId = manual.commerce_order_id ? String(manual.commerce_order_id) : null;
      if (linkedCommerceId) {
        const { data: linked } = await supabase
          .from('commerce_orders')
          .select('deleted_at')
          .eq('id', linkedCommerceId)
          .maybeSingle();
        if (!linked || linked.deleted_at) throw new NotFoundError('Order not found');
      }
      return mapManualRow(manual as Record<string, unknown>);
    }

    const { data: commerce, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', orderId)
      .is('deleted_at', null)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load order');
    if (!commerce) throw new NotFoundError('Order not found');

    const { data: farmer } = await supabase.from('farmers').select('phone').eq('id', farmerId).single();
    const phone = normalizePhone(farmer?.phone as string);
    const matchesFarmer =
      commerce.farmer_id === farmerId ||
      (phone && normalizePhone(String(commerce.phone ?? '')) === phone);
    if (!matchesFarmer) throw new NotFoundError('Order not found');

    return mapCommerceRow(commerce as Record<string, unknown>);
  },
};
