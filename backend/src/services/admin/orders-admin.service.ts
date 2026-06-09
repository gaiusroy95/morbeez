import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { commerceQuoteService } from '../commerce/commerce-quote.service.js';
import { resolveTrackingUrl } from '../../lib/shipment-tracking.js';
import { inventoryService } from '../wms/inventory.service.js';

export type OrderStatusTab =
  | 'all'
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrdersListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatusTab;
  payment?: 'cod' | 'paid' | '';
}

interface NormalizedOrder {
  id: string;
  source: 'shopify' | 'razorpay_checkout' | 'quote';
  commerceOrderId?: string | null;
  shopifyOrderId: string | null;
  orderName: string | null;
  displayOrderId: string;
  farmerName: string;
  email: string | null;
  phone: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  paymentStatus: string | null;
  totalAmount: number;
  currency: string;
  razorpayPaymentId: string | null;
  isCod: boolean;
  paymentLabel: string;
  status: Exclude<OrderStatusTab, 'all'>;
  omsStatus: string | null;
  createdAt: string;
  rawPayload?: Record<string, unknown> | null;
  trackingAwb?: string | null;
  trackingUrl?: string | null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || null;
}

function formatDisplayOrderId(orderName: string | null | undefined, id: string): string {
  if (orderName) {
    const digits = orderName.replace(/\D/g, '');
    if (digits) return `ORD${digits}`;
  }
  return `ORD${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function nameFromCustomer(customer: Record<string, unknown> | null | undefined): string | null {
  if (!customer) return null;
  const first = String(customer.firstName ?? customer.first_name ?? '').trim();
  const last = String(customer.lastName ?? customer.last_name ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  const name = customer.name;
  return name ? String(name).trim() : null;
}

function nameFromRaw(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  const customer = raw.customer as Record<string, unknown> | undefined;
  if (customer) {
    const first = String(customer.first_name ?? '').trim();
    const last = String(customer.last_name ?? '').trim();
    const full = [first, last].filter(Boolean).join(' ');
    if (full) return full;
  }
  const ship = raw.shipping_address as Record<string, unknown> | undefined;
  if (ship) {
    const full = [ship.first_name, ship.last_name].filter(Boolean).join(' ');
    if (full) return String(full).trim();
  }
  return null;
}

const ACTIVE_OMS_STATUSES = [
  'confirmed',
  'awb_generated',
  'picking',
  'packed',
  'ready_dispatch',
  'shipped',
  'delivered',
] as const;

function isMissingDeletedAtColumn(error: { code?: string; message?: string } | null): boolean {
  const msg = String(error?.message ?? '');
  return (
    error?.code === 'PGRST204' ||
    (msg.includes('deleted_at') && msg.includes('does not exist'))
  );
}

function resolveOrderSource(row: Record<string, unknown>): NormalizedOrder['source'] {
  const orderSource = String(row.order_source ?? '');
  const shopifyId = row.shopify_order_id ? String(row.shopify_order_id) : '';
  if (
    orderSource === 'telecaller_quote' ||
    shopifyId.startsWith('quote-paid-') ||
    shopifyId.startsWith('quote-cod-')
  ) {
    return 'quote';
  }
  return 'shopify';
}

function resolveStatus(o: {
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  paymentStatus: string | null;
  isCod: boolean;
  source: string;
  omsStatus?: string | null;
  rawPayload?: Record<string, unknown> | null;
}): Exclude<OrderStatusTab, 'all'> {
  const oms = String(o.omsStatus || '').toLowerCase();
  if (oms === 'cancelled') return 'cancelled';
  if (oms === 'delivered' || oms === 'completed') return 'delivered';
  if (oms === 'shipped') return 'shipped';
  if (ACTIVE_OMS_STATUSES.includes(oms as (typeof ACTIVE_OMS_STATUSES)[number])) {
    return 'processing';
  }

  const raw = o.rawPayload;
  if (raw?.cancelled_at) return 'cancelled';

  const fs = String(o.financialStatus || '').toLowerCase();
  const ful = String(o.fulfillmentStatus || '').toLowerCase();
  const pay = String(o.paymentStatus || '').toLowerCase();

  if (fs === 'voided' || fs === 'refunded' || pay === 'cancelled' || pay === 'voided') {
    return 'cancelled';
  }

  if (ful === 'fulfilled' || ful === 'success' || ful === 'delivered') return 'delivered';
  if (ful === 'partial' || ful === 'in_transit' || ful === 'shipped') return 'shipped';

  const fulfillments = raw?.fulfillments;
  if (Array.isArray(fulfillments) && fulfillments.length > 0) {
    const last = fulfillments[fulfillments.length - 1] as Record<string, unknown>;
    const st = String(last?.status ?? '').toLowerCase();
    if (st === 'success' || st === 'delivered') return 'delivered';
    return 'shipped';
  }

  if (fs === 'paid' || pay === 'paid' || o.source === 'razorpay_checkout') return 'processing';
  if (o.isCod && fs !== 'paid') return 'pending';
  return 'pending';
}

function paymentLabel(o: {
  isCod: boolean;
  razorpayPaymentId: string | null;
  financialStatus: string | null;
  rawPayload?: Record<string, unknown> | null;
}): string {
  if (o.isCod) return 'COD';
  if (o.razorpayPaymentId) return 'Paid (UPI)';
  const raw = o.rawPayload;
  const gateways = (raw?.payment_gateway_names as string[] | undefined) ?? [];
  if (gateways.some((g) => /card|credit|debit/i.test(g))) return 'Paid (Card)';
  if (gateways.some((g) => /upi|razorpay|paytm|phonepe/i.test(g))) return 'Paid (UPI)';
  const fs = String(o.financialStatus || '').toLowerCase();
  if (fs === 'paid' || fs === 'partially_paid') return 'Paid';
  return 'Pending';
}

function mapCommerceOrder(row: Record<string, unknown>): NormalizedOrder {
  const raw = (row.raw_payload as Record<string, unknown> | null) ?? null;
  const source = resolveOrderSource(row);
  const base = {
    id: String(row.id),
    source,
    shopifyOrderId: row.shopify_order_id ? String(row.shopify_order_id) : null,
    orderName: row.order_name ? String(row.order_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    financialStatus: row.financial_status ? String(row.financial_status) : null,
    fulfillmentStatus: row.fulfillment_status ? String(row.fulfillment_status) : null,
    paymentStatus: row.payment_status ? String(row.payment_status) : null,
    totalAmount: Number(row.total_amount) || 0,
    currency: row.currency ? String(row.currency) : 'INR',
    razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
    isCod: Boolean(row.is_cod),
    omsStatus: row.oms_status ? String(row.oms_status) : null,
    createdAt: String(row.created_at),
    rawPayload: raw,
    trackingAwb: row.tracking_awb ? String(row.tracking_awb) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
  };
  const farmerName =
    nameFromRaw(raw) ||
    (source === 'quote' && base.orderName ? String(base.orderName) : null) ||
    'Guest';
  const status = resolveStatus({ ...base, omsStatus: base.omsStatus });
  return {
    ...base,
    displayOrderId:
      source === 'quote' && base.orderName
        ? String(base.orderName)
        : formatDisplayOrderId(base.orderName, base.id),
    farmerName,
    paymentLabel: paymentLabel(base),
    status,
  };
}

function mapCheckoutSession(row: Record<string, unknown>): NormalizedOrder {
  const customer = row.customer as Record<string, unknown> | null;
  const base = {
    id: String(row.id),
    source: 'razorpay_checkout' as const,
    shopifyOrderId: row.shopify_order_id ? String(row.shopify_order_id) : null,
    orderName: row.shopify_order_name ? String(row.shopify_order_name) : null,
    email: customer?.email ? String(customer.email) : null,
    phone: customer?.phone ? String(customer.phone) : null,
    financialStatus: row.status === 'paid' ? 'paid' : String(row.status),
    fulfillmentStatus: null,
    paymentStatus: row.status === 'paid' ? 'paid' : String(row.status),
    totalAmount: (Number(row.amount_paise) || 0) / 100,
    currency: row.currency ? String(row.currency) : 'INR',
    razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
    isCod: false,
    omsStatus: null,
    createdAt: String(row.created_at),
    rawPayload: null,
  };
  const farmerName = nameFromCustomer(customer) || 'Guest';
  const status = resolveStatus(base);
  return {
    ...base,
    displayOrderId: formatDisplayOrderId(base.orderName, base.id),
    farmerName,
    paymentLabel: paymentLabel(base),
    status,
  };
}

async function attachFarmerNames(orders: NormalizedOrder[]): Promise<void> {
  const needsLookup = orders.some((o) => o.farmerName === 'Guest' && o.phone);
  if (!needsLookup) return;

  const { data, error } = await supabase.from('farmers').select('phone, name').limit(3000);
  throwIfSupabaseError(error, 'Could not load farmers');
  const byPhone = new Map<string, string>();
  for (const f of data ?? []) {
    const key = normalizePhone(f.phone as string);
    if (key && f.name) byPhone.set(key, String(f.name));
  }

  for (const o of orders) {
    if (o.farmerName !== 'Guest') continue;
    const key = normalizePhone(o.phone);
    if (key && byPhone.has(key)) o.farmerName = byPhone.get(key)!;
    else if (o.email) {
      const local = o.email.split('@')[0]?.replace(/[._]/g, ' ');
      if (local) o.farmerName = local.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
}

function mapQuote(row: Record<string, unknown>): NormalizedOrder {
  const quoteStatus = String(row.status);
  const orderStatus: Exclude<OrderStatusTab, 'all'> =
    quoteStatus === 'paid' || quoteStatus === 'checkout'
      ? 'processing'
      : quoteStatus === 'cancelled'
        ? 'cancelled'
        : 'pending';
  const total = Number(row.total) || 0;
  const prepaid = Number(row.prepaid_amount) || 0;
  const cod = Number(row.cod_amount) || 0;
  let paymentLabel = 'Quote (pending)';
  if (quoteStatus === 'paid') paymentLabel = 'Paid';
  else if (prepaid > 0) {
    paymentLabel = `Advance ₹${prepaid.toLocaleString('en-IN')}${cod > 0 ? ` + COD ₹${cod.toLocaleString('en-IN')}` : ''}`;
  }

  return {
    id: String(row.id),
    source: 'quote',
    commerceOrderId: row.commerce_order_id ? String(row.commerce_order_id) : null,
    shopifyOrderId: row.shopify_order_id ? String(row.shopify_order_id) : null,
    orderName: row.quote_number ? String(row.quote_number) : null,
    email: row.customer_email ? String(row.customer_email) : null,
    phone: row.customer_phone ? String(row.customer_phone) : null,
    financialStatus: quoteStatus === 'paid' ? 'paid' : 'pending',
    fulfillmentStatus: null,
    paymentStatus: quoteStatus,
    totalAmount: total,
    currency: 'INR',
    razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
    isCod: cod > 0,
    omsStatus: null,
    createdAt: String(row.created_at),
    rawPayload: {
      quote_number: row.quote_number,
      expires_at: row.expires_at,
      payment_type: row.payment_type,
      prepaid_amount: row.prepaid_amount,
      cod_amount: row.cod_amount,
      hours_left: row.expires_at
        ? Math.max(
            0,
            Math.round(
              (new Date(String(row.expires_at)).getTime() - Date.now()) / (1000 * 60 * 60)
            )
          )
        : 0,
    },
    displayOrderId: String(row.quote_number ?? row.id),
    farmerName: String(row.customer_name ?? 'Guest'),
    paymentLabel,
    status: orderStatus,
  };
}

function mergeOrders(
  commerce: NormalizedOrder[],
  checkouts: NormalizedOrder[],
  quotes: NormalizedOrder[] = [],
  hiddenShopifyIds: Set<string> = new Set()
): NormalizedOrder[] {
  const seenShopify = new Set(commerce.map((o) => o.shopifyOrderId).filter(Boolean));
  const commerceIds = new Set(commerce.map((o) => o.id));
  const filteredQuotes = quotes.filter((q) => {
    if (q.commerceOrderId && commerceIds.has(q.commerceOrderId)) return false;
    if (q.shopifyOrderId && seenShopify.has(q.shopifyOrderId)) return false;
    return true;
  });
  const extra = checkouts.filter(
    (c) =>
      !c.shopifyOrderId ||
      (!seenShopify.has(c.shopifyOrderId) && !hiddenShopifyIds.has(c.shopifyOrderId))
  );
  return [...filteredQuotes, ...commerce, ...extra].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function attachQuoteWarehouseMeta(orders: NormalizedOrder[]): Promise<void> {
  const linkedIds = [
    ...new Set(
      orders
        .filter((o) => o.source === 'quote' && o.commerceOrderId)
        .map((o) => String(o.commerceOrderId))
    ),
  ];
  if (!linkedIds.length) return;

  const { data, error } = await supabase
    .from('commerce_orders')
    .select('id, oms_status')
    .in('id', linkedIds);
  throwIfSupabaseError(error, 'Could not load quote warehouse status');
  const omsById = new Map((data ?? []).map((r) => [String(r.id), String(r.oms_status ?? '')]));

  for (const o of orders) {
    if (o.source === 'quote' && o.commerceOrderId) {
      o.omsStatus = omsById.get(String(o.commerceOrderId)) ?? o.omsStatus;
    }
  }
}

async function softDeleteCommerceOrder(
  id: string,
  now: string,
  actorEmail?: string
): Promise<{ id: string; shopifyOrderId: string | null } | null> {
  const { data, error } = await supabase
    .from('commerce_orders')
    .update({
      payment_status: 'cancelled',
      fulfillment_status: 'cancelled',
      financial_status: 'voided',
      oms_status: 'cancelled',
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, shopify_order_id')
    .maybeSingle();
  throwIfSupabaseError(error, 'Could not delete order');
  if (!data) return null;

  if (data.shopify_order_id) {
    await expireCheckoutSessions({ shopifyOrderId: String(data.shopify_order_id) }, now);
  }

  try {
    await inventoryService.releaseOrderAllocations(id, actorEmail);
  } catch {
    /* order may have no warehouse allocations */
  }

  const { error: manualErr } = await supabase
    .from('crm_manual_orders')
    .delete()
    .eq('commerce_order_id', id);
  if (manualErr) {
    throwIfSupabaseError(manualErr, 'Could not remove linked CRM orders');
  }

  return { id: String(data.id), shopifyOrderId: data.shopify_order_id ? String(data.shopify_order_id) : null };
}

async function cancelLinkedQuotesForCommerceOrder(
  commerceOrderId: string,
  shopifyOrderId: string | null,
  now: string
): Promise<void> {
  await supabase
    .from('commerce_quotes')
    .update({ status: 'cancelled', updated_at: now })
    .eq('commerce_order_id', commerceOrderId);

  if (shopifyOrderId?.startsWith('quote-paid-') || shopifyOrderId?.startsWith('quote-cod-')) {
    const quoteId = shopifyOrderId.replace(/^quote-(?:paid|cod)-/, '');
    if (quoteId) {
      await supabase
        .from('commerce_quotes')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', quoteId);
    }
  }
}

async function expireCheckoutSessions(
  filter: { id?: string; shopifyOrderId?: string },
  now: string
): Promise<void> {
  let q = supabase
    .from('checkout_sessions')
    .update({ status: 'expired', deleted_at: now, updated_at: now })
    .is('deleted_at', null);
  if (filter.id) q = q.eq('id', filter.id);
  else if (filter.shopifyOrderId) q = q.eq('shopify_order_id', filter.shopifyOrderId);
  else return;
  const { error } = await q;
  throwIfSupabaseError(error, 'Could not expire checkout session');
}

function toPublicOrder(o: NormalizedOrder) {
  const raw = o.rawPayload ?? {};
  return {
    id: o.id,
    source: o.source,
    commerceOrderId: o.commerceOrderId ?? null,
    shopifyOrderId: o.shopifyOrderId,
    orderName: o.orderName,
    displayOrderId: o.displayOrderId,
    farmerName: o.farmerName,
    email: o.email,
    phone: o.phone,
    amount: o.totalAmount,
    currency: o.currency,
    paymentLabel: o.paymentLabel,
    status: o.status,
    financialStatus: o.financialStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    omsStatus: o.omsStatus,
    createdAt: o.createdAt,
    quoteExpiresAt: o.source === 'quote' ? (raw.expires_at as string | undefined) : undefined,
    quoteHoursLeft: o.source === 'quote' ? (raw.hours_left as number | undefined) : undefined,
    quotePaymentType: o.source === 'quote' ? (raw.payment_type as string | undefined) : undefined,
    prepaidAmount: o.source === 'quote' ? Number(raw.prepaid_amount) || 0 : undefined,
    codAmount: o.source === 'quote' ? Number(raw.cod_amount) || 0 : undefined,
    isQuote: o.source === 'quote',
    quoteStatus: o.source === 'quote' ? String(o.paymentStatus ?? '') : undefined,
  };
}

function parseMoney(v: unknown): number {
  const n = parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatOrderDateTime(iso: string): string {
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
    return iso;
  }
}

function formatAddressLines(addr: Record<string, unknown> | undefined): string[] {
  if (!addr) return [];
  const lines: string[] = [];
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ');
  if (name) lines.push(String(name).trim());
  const line1 = addr.address1 ?? addr.address_1 ?? addr.line1;
  const line2 = addr.address2 ?? addr.address_2 ?? addr.line2;
  if (line1) lines.push(String(line1));
  if (line2) lines.push(String(line2));
  const city = addr.city;
  const province = addr.province ?? addr.state;
  const zip = addr.zip ?? addr.postal_code;
  const cityLine = [city, province, zip].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  const country = addr.country;
  if (country && country !== 'India' && country !== 'IN') lines.push(String(country));
  return lines;
}

function shortAddress(addr: Record<string, unknown> | undefined): string {
  if (!addr) return '—';
  const city = String(addr.city ?? '').trim();
  const province = String(addr.province ?? addr.state ?? '').trim();
  const zip = String(addr.zip ?? addr.postal_code ?? '').trim();
  const parts = [city, province].filter(Boolean).join(', ');
  return zip ? `${parts} - ${zip}` : parts || '—';
}

interface DetailLineItem {
  product: string;
  variant: string;
  mrp: number;
  price: number;
  qty: number;
  total: number;
  isFree: boolean;
}

function mapLineItem(
  title: string,
  variant: string,
  price: number,
  mrp: number,
  qty: number
): DetailLineItem {
  const total = Math.round(price * qty * 100) / 100;
  return {
    product: title,
    variant: variant || '—',
    mrp: mrp || price,
    price,
    qty,
    total,
    isFree: total <= 0,
  };
}

function lineItemsFromShopify(raw: Record<string, unknown>): DetailLineItem[] {
  const items = (raw.line_items as Record<string, unknown>[]) ?? [];
  if (!items.length) return [];
  return items.map((li) => {
    const price = parseMoney(li.price ?? li.final_price);
    const mrp = parseMoney(
      li.compare_at_price ?? li.original_price ?? li.pre_tax_price ?? li.price ?? price
    );
    const qty = Math.max(1, Number(li.quantity) || 1);
    const total = parseMoney(li.final_line_price ?? price * qty);
    return {
      ...mapLineItem(String(li.title ?? li.name ?? 'Product'), String(li.variant_title ?? ''), price, mrp, qty),
      total,
      isFree: total <= 0,
    };
  });
}

function lineItemsFromCheckout(items: unknown[]): DetailLineItem[] {
  if (!Array.isArray(items) || !items.length) return [];
  return items.map((row) => {
    const li = row as Record<string, unknown>;
    const rawPrice = Number(li.price) || 0;
    const unitPrice = rawPrice > 5000 ? rawPrice / 100 : rawPrice;
    const qty = Math.max(1, Number(li.quantity) || 1);
    return mapLineItem(
      String(li.title ?? 'Product'),
      String(li.variantTitle ?? li.variant_title ?? ''),
      unitPrice,
      unitPrice,
      qty
    );
  });
}

function paymentStatusLabel(o: NormalizedOrder): string {
  if (o.isCod) return o.status === 'pending' ? 'Pending (COD)' : 'Paid';
  const fs = String(o.financialStatus || '').toLowerCase();
  if (fs === 'paid' || fs === 'partially_paid' || o.razorpayPaymentId) return 'Paid';
  return 'Pending';
}

function buildTimeline(o: NormalizedOrder, raw: Record<string, unknown> | null) {
  const created = o.createdAt;
  const rank: Record<string, number> = {
    pending: 0,
    processing: 1,
    shipped: 2,
    delivered: 3,
    cancelled: -1,
  };
  const r = rank[o.status] ?? 0;
  const fs = String(o.financialStatus || '').toLowerCase();
  const paid =
    Boolean(o.razorpayPaymentId) ||
    fs === 'paid' ||
    fs === 'partially_paid' ||
    (o.source === 'razorpay_checkout' && String(o.paymentStatus || '').toLowerCase() === 'paid') ||
    (o.isCod && r >= 1);

  const fulfillments = (raw?.fulfillments as Record<string, unknown>[]) ?? [];
  const lastFulfillment = fulfillments[fulfillments.length - 1];
  const shippedAt =
    (lastFulfillment?.created_at ? String(lastFulfillment.created_at) : null) ||
    (r >= 2 ? created : null);
  const deliveredAt = r >= 3 ? shippedAt || created : null;

  const labels = [
    'Order Placed',
    'Payment Successful',
    'Packed',
    'Shipped',
    'Delivered',
  ];
  const doneFlags =
    o.status === 'cancelled'
      ? [true, false, false, false, false]
      : [true, paid, r >= 1, r >= 2, r >= 3];
  const times = [created, paid ? created : null, r >= 1 ? created : null, shippedAt, deliveredAt];

  return labels.map((label, i) => ({
    key: ['placed', 'payment', 'packed', 'shipped', 'delivered'][i],
    label,
    at: doneFlags[i] && times[i] ? formatOrderDateTime(times[i]!) : null,
    done: doneFlags[i],
    pending: i === 4 && !doneFlags[4],
  }));
}

function extractShippingMeta(
  raw: Record<string, unknown> | null,
  status: string,
  db?: { awb?: string | null; url?: string | null }
) {
  const fulfillments = (raw?.fulfillments as Record<string, unknown>[]) ?? [];
  const last = fulfillments[fulfillments.length - 1];
  let courier = '—';
  let trackingId = '—';
  let shopifyTrackingUrl: string | null = null;

  if (last) {
    const company = last.tracking_company ?? last.company;
    if (company) courier = String(company);
    const track = last.tracking_number ?? last.tracking_numbers;
    if (Array.isArray(track) && track[0]) trackingId = String(track[0]);
    else if (track) trackingId = String(track);
    const urls = last.tracking_urls ?? last.tracking_url;
    if (Array.isArray(urls) && urls[0]) shopifyTrackingUrl = String(urls[0]);
    else if (urls && typeof urls === 'string') shopifyTrackingUrl = urls;
  }

  if (db?.awb) trackingId = db.awb;
  if (courier === '—' && (status === 'shipped' || status === 'delivered')) {
    courier = 'Delhivery';
    if (trackingId === '—' && raw?.id) {
      trackingId = String(raw.id).replace(/\D/g, '').slice(0, 13) || '—';
    }
  }

  const trackingUrl = resolveTrackingUrl({
    trackingId: trackingId !== '—' ? trackingId : null,
    trackingUrl: db?.url ?? shopifyTrackingUrl,
    courier,
  });

  return { courier, trackingId, trackingUrl };
}

function buildOrderDetail(o: NormalizedOrder, sessionRow?: Record<string, unknown>) {
  const raw = o.rawPayload ?? null;
  let lineItems: DetailLineItem[] = [];
  let shippingAddr: Record<string, unknown> | undefined;
  let notes = '';

  if (raw) {
    lineItems = lineItemsFromShopify(raw);
    shippingAddr = raw.shipping_address as Record<string, unknown> | undefined;
    notes = String(raw.note ?? raw.note_attributes ?? '').trim();
    if (!notes && Array.isArray(raw.note_attributes)) {
      const attrs = raw.note_attributes as { name?: string; value?: string }[];
      const noteAttr = attrs.find((a) => /note/i.test(String(a.name)));
      if (noteAttr?.value) notes = String(noteAttr.value);
    }
  } else if (sessionRow) {
    lineItems = lineItemsFromCheckout((sessionRow.line_items as unknown[]) ?? []);
    shippingAddr = sessionRow.shipping as Record<string, unknown> | undefined;
  }

  const subtotalFromLines = lineItems.reduce((s, li) => s + li.total, 0);
  let subtotal = subtotalFromLines;
  let shipping = 0;
  let discount = 0;

  if (raw) {
    subtotal = parseMoney(raw.subtotal_price) || subtotalFromLines;
    shipping = parseMoney(
      (raw.total_shipping_price_set as { shop_money?: { amount?: string } })?.shop_money?.amount ??
        raw.total_shipping_price
    );
    discount = parseMoney(raw.total_discounts);
  } else if (sessionRow) {
    subtotal = subtotalFromLines || o.totalAmount;
    shipping = Math.max(0, o.totalAmount - subtotal);
  }

  if (!lineItems.length && o.totalAmount > 0) {
    lineItems = [
      mapLineItem('Order items', '—', o.totalAmount, o.totalAmount, 1),
    ];
  }

  const total = o.totalAmount || Math.max(0, subtotal + shipping - discount);
  if (!shipping && subtotal + discount < total) {
    shipping = Math.round((total - subtotal + discount) * 100) / 100;
  }
  if (!discount && subtotal + shipping > total) {
    discount = Math.round((subtotal + shipping - total) * 100) / 100;
  }

  const { courier, trackingId, trackingUrl } = extractShippingMeta(raw, o.status, {
    awb: o.trackingAwb,
    url: o.trackingUrl,
  });
  const shipLines = formatAddressLines(shippingAddr);
  const customerShort = shortAddress(shippingAddr);

  const st = o.status;
  const statusLabel =
    st.charAt(0).toUpperCase() + st.slice(1);

  return {
    ...toPublicOrder(o),
    orderDate: formatOrderDateTime(o.createdAt),
    paymentStatus: paymentStatusLabel(o),
    statusLabel,
    customer: {
      name: o.farmerName,
      phone: o.phone,
      email: o.email,
      addressShort: customerShort,
    },
    shipping: {
      name: o.farmerName,
      addressLines: shipLines.length ? shipLines : [customerShort],
      courier,
      trackingId,
      trackingUrl,
    },
    lineItems,
    totals: {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
    },
    timeline: buildTimeline(o, raw),
    notes: notes || '',
  };
}

async function repairOrphanedSoftDeletes(): Promise<number> {
  const { data, error } = await supabase
    .from('commerce_orders')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .not('deleted_at', 'is', null)
    .in('oms_status', [...ACTIVE_OMS_STATUSES])
    .select('id');
  if (error) {
    if (isMissingDeletedAtColumn(error)) return 0;
    throwIfSupabaseError(error, 'Could not repair soft-deleted warehouse orders');
  }
  return data?.length ?? 0;
}

async function loadCommerceOrdersForList() {
  let res = await supabase
    .from('commerce_orders')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (res.error && isMissingDeletedAtColumn(res.error)) {
    res = await supabase
      .from('commerce_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
  }
  throwIfSupabaseError(res.error, 'Could not load orders');
  return res.data ?? [];
}

async function loadCheckoutSessionsForList() {
  let res = await supabase
    .from('checkout_sessions')
    .select('*')
    .is('deleted_at', null)
    .in('status', ['paid', 'pending', 'failed'])
    .order('created_at', { ascending: false })
    .limit(500);
  if (res.error && isMissingDeletedAtColumn(res.error)) {
    res = await supabase
      .from('checkout_sessions')
      .select('*')
      .in('status', ['paid', 'pending', 'failed'])
      .order('created_at', { ascending: false })
      .limit(500);
  }
  throwIfSupabaseError(res.error, 'Could not load checkout orders');
  return res.data ?? [];
}

async function loadDeletedShopifyIds(): Promise<Set<string>> {
  let res = await supabase
    .from('commerce_orders')
    .select('shopify_order_id')
    .not('deleted_at', 'is', null)
    .not('shopify_order_id', 'is', null)
    .limit(500);
  if (res.error && isMissingDeletedAtColumn(res.error)) {
    return new Set();
  }
  throwIfSupabaseError(res.error, 'Could not load deleted order index');
  return new Set(
    (res.data ?? [])
      .map((r) => (r.shopify_order_id ? String(r.shopify_order_id) : ''))
      .filter(Boolean)
  );
}

export const ordersAdminService = {
  async repairWarehouseOrderVisibility() {
    return repairOrphanedSoftDeletes();
  },

  async list(query: OrdersListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(8, query.limit ?? 8));
    const statusFilter = query.status ?? 'all';

    await commerceQuoteService.purgeExpired();
    await repairOrphanedSoftDeletes();
    try {
      await commerceQuoteService.repairUnsyncedPaidQuotes(30);
    } catch {
      /* list still loads if warehouse repair fails */
    }

    const [commerceRows, checkoutRows, quotes, hiddenShopifyIds] = await Promise.all([
      loadCommerceOrdersForList(),
      loadCheckoutSessionsForList(),
      supabase
        .from('commerce_quotes')
        .select('*')
        .in('status', ['pending', 'checkout', 'paid'])
        .order('created_at', { ascending: false })
        .limit(500),
      loadDeletedShopifyIds(),
    ]);

    throwIfSupabaseError(quotes.error, 'Could not load quotes');

    let orders = mergeOrders(
      commerceRows.map((r) => mapCommerceOrder(r as Record<string, unknown>)),
      checkoutRows.map((r) => mapCheckoutSession(r as Record<string, unknown>)),
      (quotes.data ?? []).map((r) => mapQuote(r as Record<string, unknown>)),
      hiddenShopifyIds
    );

    await attachFarmerNames(orders);
    await attachQuoteWarehouseMeta(orders);

    if (query.search?.trim()) {
      const term = query.search.trim().toLowerCase();
      orders = orders.filter((o) => {
        const hay = [
          o.displayOrderId,
          o.orderName,
          o.farmerName,
          o.email,
          o.phone,
          o.shopifyOrderId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      });
    }

    if (query.payment === 'cod') {
      orders = orders.filter((o) => o.isCod);
    } else if (query.payment === 'paid') {
      orders = orders.filter(
        (o) =>
          !o.isCod &&
          (o.razorpayPaymentId ||
            String(o.financialStatus || '').toLowerCase() === 'paid' ||
            o.source === 'razorpay_checkout')
      );
    }

    const tabCounts = {
      all: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      processing: orders.filter((o) => o.status === 'processing').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };

    const filtered =
      statusFilter !== 'all' ? orders.filter((o) => o.status === statusFilter) : orders;

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;

    return {
      orders: filtered.slice(start, start + limit).map(toPublicOrder),
      tabCounts,
      pagination: { page: safePage, limit, total, pages },
    };
  },

  async get(id: string) {
    await repairOrphanedSoftDeletes();

    const { data: quoteRow, error: quoteErr } = await supabase
      .from('commerce_quotes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(quoteErr, 'Could not load quote');
    if (quoteRow) {
      const q = mapQuote(quoteRow as Record<string, unknown>);
      await attachQuoteWarehouseMeta([q]);
      const lineItems = ((quoteRow.line_items as Array<Record<string, unknown>>) ?? []).map((li) => ({
        product: String(li.title ?? 'Product'),
        variant: String(li.sku ?? li.variantTitle ?? '—'),
        mrp: Number(li.unitPrice) || 0,
        price: Number(li.unitPrice) || 0,
        qty: Number(li.qty) || 1,
        total: Number(li.amountInclGst) || 0,
        isFree: false,
        hsnCode: li.hsnCode ? String(li.hsnCode) : undefined,
        gstPercent: Number(li.gstPercent) || 18,
        sku: li.sku ? String(li.sku) : undefined,
      }));
      const subtotal = Number(quoteRow.subtotal) || 0;
      const cgst = Number(quoteRow.cgst) || 0;
      const sgst = Number(quoteRow.sgst) || 0;
      const igst = Number(quoteRow.igst) || 0;
      const total = Number(quoteRow.total) || 0;
      const ship = (quoteRow.shipping_address as Record<string, string>) ?? {};
      const shipLines = [
        ship.address1 ?? ship.address,
        ship.address2,
        [ship.city, ship.state, ship.pincode].filter(Boolean).join(', '),
      ].filter(Boolean) as string[];

      return {
        ...toPublicOrder(q),
        orderDate: formatOrderDateTime(q.createdAt),
        paymentStatus: q.paymentLabel,
        statusLabel:
          String(quoteRow.status).charAt(0).toUpperCase() + String(quoteRow.status).slice(1),
        customer: {
          name: q.farmerName,
          phone: q.phone,
          email: q.email,
          addressShort: shipLines.join(', ') || '—',
        },
        shipping: {
          name: q.farmerName,
          addressLines: shipLines.length ? shipLines : ['—'],
          courier: '—',
          trackingId: '—',
          trackingUrl: null,
        },
        lineItems,
        totals: {
          subtotal,
          shipping: 0,
          discount: 0,
          total,
          cgst,
          sgst,
          igst,
          prepaidAmount: Number(quoteRow.prepaid_amount) || 0,
          codAmount: Number(quoteRow.cod_amount) || 0,
        },
        timeline: buildTimeline(q, q.rawPayload ?? null),
        notes:
          q.source === 'quote'
            ? `Quote · expires ${formatOrderDateTime(String(quoteRow.expires_at))}`
            : '',
        isQuote: true,
        quoteStatus: String(quoteRow.status),
        checkoutToken: String(quoteRow.checkout_token),
      };
    }

    let res = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (res.error && isMissingDeletedAtColumn(res.error)) {
      res = await supabase.from('commerce_orders').select('*').eq('id', id).maybeSingle();
    }
    throwIfSupabaseError(res.error, 'Could not load order');
    if (res.data) {
      const data = res.data;
      const o = mapCommerceOrder(data);
      await attachFarmerNames([o]);
      return buildOrderDetail(o);
    }

    const { data: session, error: sErr } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    throwIfSupabaseError(sErr, 'Could not load order');
    if (session) {
      const o = mapCheckoutSession(session);
      await attachFarmerNames([o]);
      return buildOrderDetail(o, session as Record<string, unknown>);
    }

    throw new NotFoundError('Order not found');
  },

  async delete(
    id: string,
    source: 'shopify' | 'razorpay_checkout' | 'quote' | undefined,
    actorEmail?: string
  ): Promise<'commerce_quotes' | 'checkout_sessions' | 'commerce_orders'> {
    const now = new Date().toISOString();

    if (source === 'quote') {
      const { data: quoteRow, error: quoteLoadErr } = await supabase
        .from('commerce_quotes')
        .select('id, commerce_order_id')
        .eq('id', id)
        .maybeSingle();
      throwIfSupabaseError(quoteLoadErr, 'Could not load quote');

      if (quoteRow) {
        await commerceQuoteService.delete(id);
        if (quoteRow.commerce_order_id) {
          const removed = await softDeleteCommerceOrder(String(quoteRow.commerce_order_id), now, actorEmail);
          if (removed) {
            await cancelLinkedQuotesForCommerceOrder(removed.id, removed.shopifyOrderId, now);
          }
        }
        return 'commerce_quotes';
      }

      const removed = await softDeleteCommerceOrder(id, now, actorEmail);
      if (removed) {
        await cancelLinkedQuotesForCommerceOrder(removed.id, removed.shopifyOrderId, now);
        return 'commerce_orders';
      }

      throw new NotFoundError('Order not found');
    }

    if (source === 'razorpay_checkout') {
      const { data: checkout, error: loadErr } = await supabase
        .from('checkout_sessions')
        .select('id, shopify_order_id')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      throwIfSupabaseError(loadErr, 'Could not load checkout order');
      if (!checkout) throw new NotFoundError('Order not found');

      await expireCheckoutSessions({ id }, now);

      if (checkout.shopify_order_id) {
        await supabase
          .from('commerce_orders')
          .update({
            payment_status: 'cancelled',
            fulfillment_status: 'cancelled',
            financial_status: 'voided',
            oms_status: 'cancelled',
            deleted_at: now,
            updated_at: now,
          })
          .eq('shopify_order_id', String(checkout.shopify_order_id))
          .is('deleted_at', null);
      }

      return 'checkout_sessions';
    }

    const removed = await softDeleteCommerceOrder(id, now, actorEmail);
    if (!removed) throw new NotFoundError('Order not found');

    if (removed.shopifyOrderId?.startsWith('quote-')) {
      await cancelLinkedQuotesForCommerceOrder(removed.id, removed.shopifyOrderId, now);
    }

    return 'commerce_orders';
  },
};
