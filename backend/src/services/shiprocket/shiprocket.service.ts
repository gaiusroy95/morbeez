import { eventBus } from '../../events/bus.js';
import { supabase } from '../../lib/supabase.js';
import { env } from '../../config/env.js';
import { getOrder } from '../shopify/shopify.client.js';
import { shiprocketRequest } from './shiprocket.client.js';
import { logger } from '../../lib/logger.js';
import { ndrRtoService } from '../oms/ndr-rto.service.js';
import { resolveTrackingUrl } from '../../lib/shipment-tracking.js';
import { AppError } from '../../lib/errors.js';

export type ShiprocketProvisionResult = {
  shiprocketOrderId: string | null;
  shipmentId: string | null;
  awb: string | null;
  courier: string | null;
  labelUrl: string | null;
  trackingUrl: string | null;
};

type CommerceOrderRow = {
  id: string;
  shopify_order_id: string | null;
  order_name: string | null;
  phone: string | null;
  is_cod: boolean;
  financial_status: string | null;
  total_amount: number | null;
  shipping_address: Record<string, unknown> | null;
  shiprocket_order_id: string | null;
  shiprocket_shipment_id: string | null;
  tracking_awb: string | null;
};

function parseAddress(addr: Record<string, unknown> | null) {
  if (!addr) return null;
  const name = String(addr.name ?? addr.first_name ?? 'Customer').trim();
  const parts = name.split(/\s+/);
  const first = parts[0] ?? 'Customer';
  const last = parts.slice(1).join(' ') || '';
  const pincode = String(addr.pincode ?? addr.zip ?? '').trim();
  const city = String(addr.city ?? '').trim();
  const state = String(addr.state ?? addr.province ?? '').trim();
  const line1 = String(addr.line1 ?? addr.address1 ?? '').trim();
  if (!pincode || !line1) return null;
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

function orderItemsFromLines(
  lines: Array<{ product_title: string; sku: string | null; qty_ordered: number; unit_price: number }>
) {
  return lines
    .filter((l) => l.qty_ordered > 0)
    .map((l) => ({
      name: l.product_title,
      sku: l.sku ?? 'SKU',
      units: l.qty_ordered,
      selling_price: Number(l.unit_price) || 0,
    }));
}

async function loadCommerceOrder(commerceOrderId: string): Promise<CommerceOrderRow> {
  const { data, error } = await supabase
    .from('commerce_orders')
    .select(
      'id, shopify_order_id, order_name, phone, is_cod, financial_status, total_amount, shipping_address, shiprocket_order_id, shiprocket_shipment_id, tracking_awb'
    )
    .eq('id', commerceOrderId)
    .single();
  if (error || !data) throw new AppError('Order not found', 404, 'NOT_FOUND');
  return data as CommerceOrderRow;
}

async function loadOrderLines(commerceOrderId: string) {
  const { data, error } = await supabase
    .from('commerce_order_lines')
    .select('product_title, sku, qty_ordered, qty_cancelled, unit_price')
    .eq('commerce_order_id', commerceOrderId);
  if (error) throw new AppError(error.message, 500, 'DB_ERROR');
  return (data ?? [])
    .map((l) => ({
      product_title: String(l.product_title),
      sku: l.sku as string | null,
      qty_ordered: Number(l.qty_ordered) - Number(l.qty_cancelled ?? 0),
      unit_price: Number(l.unit_price),
    }))
    .filter((l) => l.qty_ordered > 0);
}

type CourierOption = {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  etd?: string;
};

function parseServiceableCouriers(payload: Record<string, unknown>): CourierOption[] {
  const data = payload.data as Record<string, unknown> | undefined;
  const list =
    (data?.available_courier_companies as CourierOption[] | undefined) ??
    (payload.available_courier_companies as CourierOption[] | undefined) ??
    [];
  return Array.isArray(list) ? list : [];
}

/** Shiprocket serviceability is GET with query params — POST returns 405. */
async function pickCourier(
  shiprocketOrderId: number | undefined,
  pincode: string,
  weight: number,
  isCod: boolean
) {
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode(),
    delivery_postcode: pincode,
    cod: String(isCod ? 1 : 0),
    weight: String(Math.max(0.1, weight)),
  });
  if (shiprocketOrderId) params.set('order_id', String(shiprocketOrderId));

  const serviceability = await shiprocketRequest<Record<string, unknown>>(
    `/v1/external/courier/serviceability/?${params.toString()}`,
    { method: 'GET' }
  );

  const couriers = parseServiceableCouriers(serviceability);
  if (!couriers.length) return null;

  const data = serviceability.data as Record<string, unknown> | undefined;
  const recommendedId = Number(
    data?.recommended_courier_company_id ?? data?.shiprocket_recommended_courier_id ?? 0
  );
  if (recommendedId) {
    const match = couriers.find((c) => c.courier_company_id === recommendedId);
    if (match) return match;
  }

  const sorted = [...couriers].sort((a, b) => Number(a.rate) - Number(b.rate));
  return sorted[0];
}

function pickupLocationName() {
  return env.SHIPROCKET_PICKUP_LOCATION?.trim() || 'Primary';
}

function pickupPincode() {
  return env.SHIPROCKET_PICKUP_PINCODE?.trim() || '560001';
}

async function getWalletBalance(): Promise<number | null> {
  try {
    const res = await shiprocketRequest<Record<string, unknown>>(
      '/v1/external/account/details/wallet-balance',
      { method: 'GET' }
    );
    const data = res.data as Record<string, unknown> | undefined;
    const raw = data?.balance_amount ?? data?.balance ?? res.balance_amount ?? res.balance;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch (err) {
    logger.warn({ err }, 'Shiprocket wallet balance lookup failed');
    return null;
  }
}

async function cancelShiprocketOrders(shiprocketOrderIds: number[]) {
  const ids = [...new Set(shiprocketOrderIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return;
  await shiprocketRequest<Record<string, unknown>>('/v1/external/orders/cancel', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

async function cancelShiprocketShipments(shipmentIds: number[]) {
  const ids = [...new Set(shipmentIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return;
  try {
    await shiprocketRequest<Record<string, unknown>>('/v1/external/orders/cancel/shipment', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: ids }),
    });
  } catch (err) {
    logger.warn({ err, shipmentIds: ids }, 'Shiprocket shipment cancel failed');
  }
}

async function clearCommerceShipmentRefs(commerceOrderId: string) {
  await supabase
    .from('commerce_orders')
    .update({
      shiprocket_order_id: null,
      shiprocket_shipment_id: null,
      tracking_awb: null,
      tracking_url: null,
      label_url: null,
      courier_name: null,
      awb_generated_at: null,
      shiprocket_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commerceOrderId);
}

function shiprocketPhone(raw?: string | null): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

async function listPickupLocations(): Promise<Array<Record<string, unknown>>> {
  const res = await shiprocketRequest<Record<string, unknown>>(
    '/v1/external/settings/company/pickup',
    { method: 'GET' }
  );
  const data = res.data as Record<string, unknown> | undefined;
  const list =
    (data?.shipping_address as unknown[]) ??
    (res.shipping_address as unknown[]) ??
    (Array.isArray(res.data) ? res.data : []);
  return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
}

async function resolvePickupLocation(): Promise<string> {
  const configured = pickupLocationName();
  try {
    const locs = await listPickupLocations();
    const names = locs
      .map((l) => String(l.pickup_location ?? '').trim())
      .filter(Boolean);
    if (names.includes(configured)) return configured;
    if (names.length) {
      logger.warn(
        { configured, available: names },
        'SHIPROCKET_PICKUP_LOCATION mismatch — using first Shiprocket pickup'
      );
      return names[0]!;
    }
  } catch (err) {
    logger.warn({ err }, 'Could not list Shiprocket pickup locations');
  }
  return configured;
}

export function formatShiprocketErrorForDisplay(
  storedError: string | null | undefined,
  wallet: number | null
): string | null {
  if (!storedError?.trim()) return null;
  const err = storedError.trim();
  if (!/wallet|balance|recharge/i.test(err)) return err;
  if (wallet == null) {
    return `${err} — Click Generate AWB to retry (live wallet could not be checked).`;
  }
  if (wallet >= 100) {
    return (
      `Stale AWB error — Shiprocket previously said: "${err}". ` +
      `Live API wallet balance is ₹${wallet.toFixed(2)} (OK). ` +
      `Click Generate AWB to retry with a fresh shipment.`
    );
  }
  return `${err} Live API wallet balance: ₹${wallet.toFixed(2)}.`;
}

export type ShiprocketDiagnostics = {
  walletBalanceInr: number | null;
  pickupLocationConfigured: string;
  pickupLocationsAvailable: string[];
  apiUserEmail: string | null;
};

async function getDiagnostics(): Promise<ShiprocketDiagnostics> {
  const [wallet, locs] = await Promise.all([
    getWalletBalance(),
    listPickupLocations().catch(() => [] as Array<Record<string, unknown>>),
  ]);
  return {
    walletBalanceInr: wallet,
    pickupLocationConfigured: pickupLocationName(),
    pickupLocationsAvailable: locs
      .map((l) => String(l.pickup_location ?? '').trim())
      .filter(Boolean),
    apiUserEmail: env.SHIPROCKET_EMAIL?.trim() ?? null,
  };
}

function formatAwbFailureMessage(
  parsedMessage: string | null,
  wallet: number | null,
  courier: CourierOption | null
): string {
  const base =
    parsedMessage?.trim() ||
    'Shiprocket could not generate AWB — open Shiprocket dashboard and assign courier manually, then retry';

  if (!/wallet|balance|recharge|insufficient/i.test(base)) {
    return base;
  }

  const parts = [base];
  if (wallet != null) {
    parts.push(`API wallet balance: ₹${wallet.toFixed(2)}`);
  }
  if (courier?.rate != null) {
    parts.push(`Courier freight for this order: ~₹${Number(courier.rate).toFixed(2)}`);
  }
  if (wallet != null && courier?.rate != null && wallet < Number(courier.rate)) {
    parts.push(
      `Balance is lower than shipping cost — recharge by at least ₹${Math.ceil(Number(courier.rate) - wallet)}.`
    );
  } else if (wallet != null && wallet >= 100) {
    parts.push(
      'Dashboard balance can differ from API wallet, or a stale shipment may be holding funds. Use Generate AWB again (fresh shipment) or cancel the order in Shiprocket → Orders.'
    );
  }
  return parts.join(' ');
}

function parseCreateAdhocResponse(created: Record<string, unknown>) {
  const payload = created.payload as Record<string, unknown> | undefined;
  const data = created.data as Record<string, unknown> | undefined;
  const shipmentId = Number(
    created.shipment_id ?? payload?.shipment_id ?? data?.shipment_id ?? 0
  );
  const orderIdRaw = created.order_id ?? payload?.order_id ?? data?.order_id;
  const shiprocketOrderId = orderIdRaw != null ? Number(orderIdRaw) : undefined;
  const orderStatusRaw = created.status ?? payload?.status ?? data?.status;
  const orderStatus = orderStatusRaw != null ? String(orderStatusRaw) : undefined;
  const awb =
    (created.awb_code ? String(created.awb_code) : null) ||
    (payload?.awb_code ? String(payload.awb_code) : null) ||
    (data?.awb_code ? String(data.awb_code) : null);
  const courier =
    (created.courier_name ? String(created.courier_name) : null) ||
    (payload?.courier_name ? String(payload.courier_name) : null) ||
    (data?.courier_name ? String(data.courier_name) : null);
  return { shipmentId, shiprocketOrderId, orderStatus, awb, courier };
}

function uniqueShiprocketOrderId(base: string, commerceOrderId: string, recreate: boolean) {
  const normalized = base.trim() || commerceOrderId.slice(0, 8);
  if (!recreate) return normalized;
  return `${normalized}-${commerceOrderId.slice(0, 4)}`;
}

function parseAssignAwbResult(payload: Record<string, unknown>) {
  const assignStatus = payload.awb_assign_status;
  const accepted = assignStatus === 1 || assignStatus === '1';

  const response = payload.response as Record<string, unknown> | undefined;
  const rawData = response?.data;
  let row: Record<string, unknown> | undefined;

  if (Array.isArray(rawData) && rawData.length) {
    row = rawData[0] as Record<string, unknown>;
  } else if (rawData && typeof rawData === 'object') {
    row = rawData as Record<string, unknown>;
  }

  const awb =
    (row?.awb_code ? String(row.awb_code).trim() : null) ||
    (payload.awb_code ? String(payload.awb_code).trim() : null) ||
    null;

  const courierName =
    (row?.courier_name ? String(row.courier_name) : null) ||
    (payload.courier_name ? String(payload.courier_name) : null) ||
    null;

  let message: string | null = null;
  if (!accepted && !awb) {
    message =
      (row?.awb_assign_error ? String(row.awb_assign_error) : null) ||
      (row?.error ? String(row.error) : null) ||
      (typeof rawData === 'string' ? rawData : null) ||
      String(response?.message ?? payload.message ?? 'AWB assignment rejected by Shiprocket');
  }

  return { awb, courierName, accepted, message, raw: payload };
}

/** Shiprocket expects shipment_id as an array. */
async function assignAwb(
  shipmentId: number,
  courierId: number,
  orderStatus?: string | null
) {
  const body: Record<string, unknown> = {
    shipment_id: [shipmentId],
    courier_id: courierId,
  };
  if (orderStatus) body.status = orderStatus;

  return shiprocketRequest<Record<string, unknown>>('/v1/external/courier/assign/awb', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function assignAwbWithFallback(
  shipmentId: number,
  preferredCourierId: number,
  orderStatus?: string | null
) {
  let assigned = await assignAwb(shipmentId, preferredCourierId, orderStatus);
  let parsed = parseAssignAwbResult(assigned);
  if (parsed.awb) return { assigned, parsed };

  const walletMsg = parsed.message && /wallet|balance|recharge/i.test(parsed.message);
  if (walletMsg || !parsed.accepted) {
    logger.warn(
      { shipmentId, preferredCourierId, message: parsed.message },
      'Shiprocket assign AWB retrying with auto courier (courier_id 0)'
    );
    assigned = await assignAwb(shipmentId, 0, orderStatus);
    parsed = parseAssignAwbResult(assigned);
  }
  return { assigned, parsed };
}

async function fetchShipmentAwb(shipmentId: number): Promise<string | null> {
  const detail = await shiprocketRequest<Record<string, unknown>>(
    `/v1/external/shipments/${shipmentId}`,
    { method: 'GET' }
  );
  const data = detail.data as Record<string, unknown> | undefined;
  const awb = data?.awb ?? data?.awb_code ?? detail.awb ?? detail.awb_code;
  return awb ? String(awb).trim() : null;
}

async function persistPartialShipment(
  commerceOrderId: string,
  shipmentId: number,
  shiprocketOrderId?: number | null
) {
  await supabase
    .from('commerce_orders')
    .update({
      shiprocket_shipment_id: String(shipmentId),
      shiprocket_order_id:
        shiprocketOrderId != null ? String(shiprocketOrderId) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commerceOrderId);
}

async function fetchLabelUrl(shipmentId: number): Promise<string | null> {
  const label = await shiprocketRequest<{
    label_url?: string;
    label_created?: number;
    response?: { label_url?: string };
  }>('/v1/external/courier/generate/label', {
    method: 'POST',
    body: JSON.stringify({ shipment_id: [shipmentId] }),
  });
  return label.label_url ?? label.response?.label_url ?? null;
}

/** Delhivery is assigned via Shiprocket courier rules — no separate API in M2 */
export const shiprocketService = {
  getWalletBalance,
  getDiagnostics,
  formatShiprocketErrorForDisplay,

  async provisionForCommerceOrder(
    commerceOrderId: string,
    opts?: { forceRecreate?: boolean }
  ): Promise<ShiprocketProvisionResult | null> {
    const existing = await loadCommerceOrder(commerceOrderId);
    const hasPartialShipment =
      Boolean(existing.shiprocket_shipment_id) && !existing.tracking_awb;

    if (!opts?.forceRecreate && hasPartialShipment) {
      try {
        return await this._provisionForCommerceOrderOnce(commerceOrderId, {
          recreateOnAssignFailure: true,
        });
      } catch (err) {
        logger.warn(
          { err, commerceOrderId },
          'Assign AWB on existing Shiprocket shipment failed — recreating shipment'
        );
      }
    }

    if (opts?.forceRecreate || hasPartialShipment) {
      if (existing.shiprocket_shipment_id) {
        await cancelShiprocketShipments([Number(existing.shiprocket_shipment_id)]);
      }
      if (existing.shiprocket_order_id) {
        try {
          await cancelShiprocketOrders([Number(existing.shiprocket_order_id)]);
        } catch (err) {
          logger.warn({ err, commerceOrderId }, 'Shiprocket cancel before recreate failed');
        }
      }
      await clearCommerceShipmentRefs(commerceOrderId);
    }

    return this._provisionForCommerceOrderOnce(commerceOrderId, {
      recreateOnAssignFailure: false,
      freshOrderId: Boolean(opts?.forceRecreate || hasPartialShipment),
    });
  },

  async _provisionForCommerceOrderOnce(
    commerceOrderId: string,
    opts?: { recreateOnAssignFailure?: boolean; freshOrderId?: boolean }
  ): Promise<ShiprocketProvisionResult | null> {
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
        courier: (refreshed?.courier_name as string) ?? null,
        labelUrl: (refreshed?.label_url as string) ?? null,
        trackingUrl: (refreshed?.tracking_url as string) ?? null,
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

    const paymentMethod =
      order.is_cod || order.financial_status !== 'paid' ? 'COD' : 'Prepaid';
    const subTotal = Number(order.total_amount) || lines.reduce((s, l) => s + l.unit_price * l.qty_ordered, 0);
    const weight = Math.max(0.2, lines.reduce((s, l) => s + l.qty_ordered * 0.15, 0.3));

    let shipmentId = order.shiprocket_shipment_id ? Number(order.shiprocket_shipment_id) : 0;
    let shiprocketOrderId = order.shiprocket_order_id ? Number(order.shiprocket_order_id) : undefined;
    let orderStatus: string | undefined;
    let awb: string | null = null;
    let courier: string | null = null;

    const billingPhone = shiprocketPhone(order.phone ?? addr.phone);
    if (!billingPhone) {
      throw new AppError(
        'Customer phone must be a valid 10-digit Indian number for Shiprocket AWB',
        409,
        'SHIPROCKET_PHONE'
      );
    }

    if (!shipmentId) {
      const pickupLocation = await resolvePickupLocation();
      const orderIdBase = order.order_name ?? order.shopify_order_id ?? commerceOrderId.slice(0, 8);
      const payload = {
        order_id: uniqueShiprocketOrderId(orderIdBase, commerceOrderId, Boolean(opts?.freshOrderId)),
        order_date: new Date().toISOString().slice(0, 10),
        pickup_location: pickupLocation,
        billing_customer_name: addr.first,
        billing_last_name: addr.last,
        billing_address: addr.line1,
        billing_address_2: addr.line2,
        billing_city: addr.city,
        billing_pincode: addr.pincode,
        billing_state: addr.state,
        billing_country: addr.country,
        billing_phone: billingPhone,
        shipping_is_billing: true,
        order_items: orderItemsFromLines(lines),
        payment_method: paymentMethod,
        sub_total: subTotal,
        length: 10,
        breadth: 10,
        height: 10,
        weight,
      };

      const created = await shiprocketRequest<Record<string, unknown>>(
        '/v1/external/orders/create/adhoc',
        { method: 'POST', body: JSON.stringify(payload) }
      );

      const parsedCreate = parseCreateAdhocResponse(created);
      shipmentId = parsedCreate.shipmentId;
      if (!shipmentId) {
        throw new AppError(
          'Shiprocket returned no shipment — check pickup location and order details in Shiprocket dashboard',
          502,
          'SHIPROCKET_API_ERROR'
        );
      }

      shiprocketOrderId = parsedCreate.shiprocketOrderId ?? shiprocketOrderId;
      orderStatus = parsedCreate.orderStatus;
      awb = parsedCreate.awb;
      courier = parsedCreate.courier;

      await persistPartialShipment(commerceOrderId, shipmentId, shiprocketOrderId);
    }

    if (!awb) {
      const best = await pickCourier(shiprocketOrderId, addr.pincode, weight, paymentMethod === 'COD');
      if (!best) {
        throw new AppError(
          `No courier serviceable for pincode ${addr.pincode} — check Shiprocket pickup pincode (${pickupPincode()}) and pickup location "${pickupLocationName()}" in Shiprocket settings`,
          409,
          'SHIPROCKET_NO_COURIER'
        );
      }

      const wallet = await getWalletBalance();
      if (wallet != null && best.rate != null && wallet < Number(best.rate)) {
        throw new AppError(
          `Shiprocket wallet has ₹${wallet.toFixed(2)} but this shipment needs ~₹${Number(best.rate).toFixed(2)} freight. Recharge by at least ₹${Math.ceil(Number(best.rate) - wallet)}.`,
          409,
          'SHIPROCKET_LOW_BALANCE'
        );
      }

      const { assigned, parsed } = await assignAwbWithFallback(
        shipmentId,
        best.courier_company_id,
        orderStatus
      );

      awb = parsed.awb;
      courier = parsed.courierName ?? best.courier_name;

      if (!awb) {
        awb = await fetchShipmentAwb(shipmentId).catch(() => null);
      }

      if (!awb) {
        logger.error(
          {
            commerceOrderId,
            shipmentId,
            assignStatus: assigned.awb_assign_status,
            wallet,
            courierRate: best.rate,
            assigned,
          },
          'Shiprocket assign AWB returned no awb_code'
        );

        if (opts?.recreateOnAssignFailure) {
          logger.warn({ commerceOrderId }, 'Retrying Shiprocket with fresh shipment after AWB failure');
          await cancelShiprocketShipments([shipmentId]);
          try {
            if (shiprocketOrderId) await cancelShiprocketOrders([shiprocketOrderId]);
          } catch (err) {
            logger.warn({ err, commerceOrderId }, 'Shiprocket cancel during AWB retry failed');
          }
          await clearCommerceShipmentRefs(commerceOrderId);
          return this._provisionForCommerceOrderOnce(commerceOrderId, {
            recreateOnAssignFailure: false,
            freshOrderId: true,
          });
        }

        throw new AppError(
          formatAwbFailureMessage(parsed.message, wallet, best),
          502,
          'SHIPROCKET_NO_AWB'
        );
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
      raw_payload: { shipmentId, awb, labelUrl },
    });

    await eventBus.publish(
      'shipment.created',
      {
        commerceOrderId,
        shopifyOrderId: order.shopify_order_id,
        shipmentId,
        awb,
        phone: order.phone,
        orderName: order.order_name,
      },
      'shiprocket'
    );

    return {
      shiprocketOrderId: shiprocketOrderId != null ? String(shiprocketOrderId) : null,
      shipmentId: String(shipmentId),
      awb,
      courier,
      labelUrl,
      trackingUrl,
    };
  },

  async createShipmentForShopifyOrder(
    shopifyOrderId: string
  ): Promise<{ awb: string | null; courier: string } | null> {
    const { data: row } = await supabase
      .from('commerce_orders')
      .select('id')
      .eq('shopify_order_id', shopifyOrderId)
      .maybeSingle();

    if (row?.id) {
      const result = await this.provisionForCommerceOrder(String(row.id));
      if (!result) return null;
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
      pickup_location: pickupLocationName(),
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

    const result = await shiprocketRequest<{ shipment_id: number; awb_code?: string }>(
      '/v1/external/orders/create/adhoc',
      { method: 'POST', body: JSON.stringify(payload) }
    );

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

    await eventBus.publish(
      'shipment.created',
      {
        shopifyOrderId,
        shipmentId: result.shipment_id,
        awb,
        phone: orderRow?.phone ?? order.phone,
        orderName: orderRow?.order_name ?? order.name,
      },
      'shiprocket'
    );

    return { awb, courier: 'Shiprocket' };
  },

  async handleTrackingWebhook(body: Record<string, unknown>): Promise<void> {
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
    } else if (awb) {
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
    if (
      /pick|ship|dispatch|out for delivery|in transit|transit/.test(statusLower) &&
      !statusLower.includes('delivered')
    ) {
      await eventBus.publish(
        'shipment.dispatched',
        { awb, status, shopifyOrderId: orderId },
        'shiprocket'
      );
    }

    if (statusLower.includes('delivered')) {
      await eventBus.publish('shipment.delivered', { awb, status, shopifyOrderId: orderId }, 'shiprocket');
    }

    await ndrRtoService
      .detectFromTrackingStatus(orderId, status, body)
      .catch((err) => logger.error({ err, orderId, status }, 'NDR/RTO detection failed'));
  },
};
