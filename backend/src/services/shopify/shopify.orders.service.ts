import { shopifyAdmin } from './shopify.client.js';
import { AppError } from '../../lib/errors.js';
import {
  normalizeShopifyCountry,
  normalizeShopifyPhone,
  normalizeShopifyPincode,
  normalizeShopifyProvince,
  parseShopifyErrorBody,
} from '../../lib/shopify-address.js';

export interface CheckoutLineItem {
  variantId: number;
  quantity: number;
  title?: string;
  /** Pre-tax unit price from quote/catalog */
  unitPrice?: number;
  gstPercent?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface CheckoutAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country?: string;
  phone?: string;
}

export interface CreatePaidOrderInput {
  email: string;
  phone?: string;
  lineItems: CheckoutLineItem[];
  shipping: CheckoutAddress;
  billing?: CheckoutAddress;
  totalAmountInr: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  note?: string;
  tags?: string;
}

interface ShopifyOrderResponse {
  order: {
    id: number;
    name: string;
    order_status_url?: string;
    total_price?: string;
  };
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function buildLineItems(lines: CheckoutLineItem[]) {
  return lines.map((li) => {
    const unitPrice = li.unitPrice ?? 0;
    const taxLines: Array<{ title: string; price: string; rate: number }> = [];
    const gstPct = li.gstPercent ?? 18;

    if ((li.cgst ?? 0) > 0) {
      taxLines.push({ title: 'CGST', price: money(li.cgst!), rate: gstPct / 200 });
    }
    if ((li.sgst ?? 0) > 0) {
      taxLines.push({ title: 'SGST', price: money(li.sgst!), rate: gstPct / 200 });
    }
    if ((li.igst ?? 0) > 0) {
      taxLines.push({ title: 'IGST', price: money(li.igst!), rate: gstPct / 100 });
    }

    const row: Record<string, unknown> = {
      variant_id: li.variantId,
      quantity: li.quantity,
      price: money(unitPrice),
      taxable: taxLines.length > 0,
    };
    if (li.title) row.title = li.title;
    if (taxLines.length) row.tax_lines = taxLines;
    return row;
  });
}

function computeOrderTotal(lines: CheckoutLineItem[]): number {
  let total = 0;
  for (const li of lines) {
    const unit = li.unitPrice ?? 0;
    total += unit * li.quantity;
    total += (li.cgst ?? 0) + (li.sgst ?? 0) + (li.igst ?? 0);
  }
  return Math.round(total * 100) / 100;
}

function formatAddress(addr: CheckoutAddress, fallbackPhone?: string) {
  return {
    first_name: addr.firstName || 'Customer',
    last_name: addr.lastName || '.',
    address1: addr.address1 || 'Address on file',
    address2: addr.address2 ?? '',
    city: addr.city || 'City',
    province: normalizeShopifyProvince(addr.province),
    zip: normalizeShopifyPincode(addr.zip),
    country: normalizeShopifyCountry(addr.country),
    phone: normalizeShopifyPhone(addr.phone ?? fallbackPhone),
  };
}

async function createShopifyOrderPayload(input: CreatePaidOrderInput, financialStatus: 'paid' | 'pending') {
  const shipping = formatAddress(input.shipping, input.phone);
  const billing = input.billing ? formatAddress(input.billing, input.phone) : shipping;
  const lineItems = buildLineItems(input.lineItems);
  const computedTotal = computeOrderTotal(input.lineItems);
  const paidTotal = money(Number(input.totalAmountInr) || computedTotal);

  const order: Record<string, unknown> = {
    email: input.email,
    phone: normalizeShopifyPhone(input.phone),
    line_items: lineItems,
    shipping_address: shipping,
    billing_address: billing,
    financial_status: financialStatus,
    send_receipt: false,
    inventory_behaviour: 'decrement_obeying_policy',
    note: input.note ?? `Paid via Razorpay (${input.razorpayPaymentId})`,
    tags: input.tags ?? 'razorpay-checkout,commerce_quote,telecaller',
    taxes_included: false,
    currency: 'INR',
  };

  if (financialStatus === 'paid') {
    order.transactions = [
      {
        kind: 'sale',
        status: 'success',
        amount: paidTotal,
        gateway: 'manual',
        source: 'external',
      },
    ];
  }

  return { order, paidTotal, computedTotal };
}

export const shopifyOrdersService = {
  async createPaidOrder(input: CreatePaidOrderInput) {
    const { order, paidTotal, computedTotal } = await createShopifyOrderPayload(input, 'paid');

    if (computedTotal > 0 && Math.abs(Number(paidTotal) - computedTotal) > 0.05) {
      // Align transaction to computed Shopify line total when line prices are known
      (order.transactions as Array<Record<string, unknown>>)[0].amount = money(computedTotal);
    }

    try {
      const res = await shopifyAdmin<ShopifyOrderResponse>('/orders.json', {
        method: 'POST',
        body: JSON.stringify({ order }),
      });

      return {
        shopifyOrderId: String(res.order.id),
        orderName: res.order.name,
        orderStatusUrl: res.order.order_status_url ?? null,
      };
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 422) {
        const detail = parseShopifyErrorBody(String(err.details ?? ''));
        throw new AppError(
          `Shopify rejected order: ${detail}`,
          422,
          'SHOPIFY_API_ERROR',
          err.details
        );
      }
      throw err;
    }
  },

  async createCodOrder(input: Omit<CreatePaidOrderInput, 'razorpayPaymentId' | 'razorpayOrderId'>) {
    const shipping = formatAddress(input.shipping, input.phone);
    const lineItems = buildLineItems(
      input.lineItems.map((li) => ({ ...li, unitPrice: li.unitPrice ?? 0 }))
    );

    const order = {
      email: input.email,
      phone: normalizeShopifyPhone(input.phone),
      line_items: lineItems,
      shipping_address: shipping,
      billing_address: shipping,
      financial_status: 'pending',
      send_receipt: false,
      inventory_behaviour: 'decrement_obeying_policy',
      note: input.note ?? 'COD order from telecaller quote',
      tags: 'cod,commerce_quote,telecaller',
      taxes_included: false,
      currency: 'INR',
    };

    const res = await shopifyAdmin<ShopifyOrderResponse>('/orders.json', {
      method: 'POST',
      body: JSON.stringify({ order }),
    });

    return {
      shopifyOrderId: String(res.order.id),
      orderName: res.order.name,
      orderStatusUrl: res.order.order_status_url ?? null,
    };
  },
};
