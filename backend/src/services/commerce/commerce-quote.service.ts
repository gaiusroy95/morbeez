import { randomUUID } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { computeGstBreakup, normalizeIndianState } from '../../lib/gst.js';
import { env } from '../../config/env.js';
import { companySettingsService } from '../admin/company-settings.service.js';
import { razorpayCheckoutService } from '../razorpay/razorpay.checkout.service.js';
import { shopifyOrdersService } from '../shopify/shopify.orders.service.js';
import { invoiceService } from '../oms/invoice.service.js';

const QUOTE_TTL_HOURS = 48;

export type QuoteLineItem = {
  variantId?: number;
  productId?: number;
  sku?: string;
  title: string;
  variantTitle?: string;
  hsnCode?: string;
  qty: number;
  unitPrice: number;
  gstPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  amountInclGst: number;
};

export type CommerceQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerState: string;
  customerGstin: string | null;
  shippingAddress: Record<string, string>;
  lineItems: QuoteLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paymentType: string;
  prepaidAmount: number;
  codAmount: number;
  checkoutToken: string;
  expiresAt: string;
  commerceOrderId: string | null;
  invoiceId: string | null;
  razorpayOrderId: string | null;
  shopifyOrderId: string | null;
  shopifyOrderName: string | null;
  createdAt: string;
  updatedAt: string;
  hoursLeft?: number;
};

function quoteNumber(): string {
  return `QUO${Date.now().toString().slice(-10)}`;
}

function mapRow(row: Record<string, unknown>): CommerceQuote {
  const expiresAt = String(row.expires_at);
  const hoursLeft = Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))
  );
  return {
    id: String(row.id),
    quoteNumber: String(row.quote_number),
    status: String(row.status),
    customerName: String(row.customer_name),
    customerPhone: row.customer_phone ? String(row.customer_phone) : null,
    customerEmail: row.customer_email ? String(row.customer_email) : null,
    customerState: String(row.customer_state ?? 'Karnataka'),
    customerGstin: row.customer_gstin ? String(row.customer_gstin) : null,
    shippingAddress: (row.shipping_address as Record<string, string>) ?? {},
    lineItems: (row.line_items as QuoteLineItem[]) ?? [],
    subtotal: Number(row.subtotal) || 0,
    cgst: Number(row.cgst) || 0,
    sgst: Number(row.sgst) || 0,
    igst: Number(row.igst) || 0,
    total: Number(row.total) || 0,
    paymentType: String(row.payment_type ?? 'advance'),
    prepaidAmount: Number(row.prepaid_amount) || 0,
    codAmount: Number(row.cod_amount) || 0,
    checkoutToken: String(row.checkout_token),
    expiresAt,
    commerceOrderId: row.commerce_order_id ? String(row.commerce_order_id) : null,
    invoiceId: row.invoice_id ? String(row.invoice_id) : null,
    razorpayOrderId: row.razorpay_order_id ? String(row.razorpay_order_id) : null,
    shopifyOrderId: row.shopify_order_id ? String(row.shopify_order_id) : null,
    shopifyOrderName: row.shopify_order_name ? String(row.shopify_order_name) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    hoursLeft,
  };
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || 'Customer', lastName: '.' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function payAmount(quote: CommerceQuote): number {
  if (quote.paymentType === 'full') return quote.total;
  if (quote.paymentType === 'partial') return quote.prepaidAmount;
  return quote.prepaidAmount > 0 ? quote.prepaidAmount : quote.total;
}

async function computeLines(
  lines: Array<{
    variantId?: number;
    productId?: number;
    sku?: string;
    title: string;
    variantTitle?: string;
    hsnCode?: string;
    qty: number;
    unitPrice: number;
    gstPercent?: number;
  }>,
  customerState: string
): Promise<{
  lineItems: QuoteLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}> {
  const company = await companySettingsService.get();
  const companyState = normalizeIndianState(company.state || env.COMPANY_STATE);
  const custState = normalizeIndianState(customerState);

  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const lineItems: QuoteLineItem[] = [];

  for (const line of lines) {
    const taxable = line.qty * line.unitPrice;
    const gstPct = line.gstPercent ?? 18;
    const breakup = computeGstBreakup({
      taxableAmount: taxable,
      gstPercent: gstPct,
      companyState,
      customerState: custState,
    });
    subtotal += taxable;
    cgst += breakup.cgst;
    sgst += breakup.sgst;
    igst += breakup.igst;
    const tax = breakup.cgst + breakup.sgst + breakup.igst;
    lineItems.push({
      variantId: line.variantId,
      productId: line.productId,
      sku: line.sku,
      title: line.title,
      variantTitle: line.variantTitle,
      hsnCode: line.hsnCode ?? '382499',
      qty: line.qty,
      unitPrice: line.unitPrice,
      gstPercent: gstPct,
      taxableAmount: taxable,
      cgst: breakup.cgst,
      sgst: breakup.sgst,
      igst: breakup.igst,
      amountInclGst: Math.round((taxable + tax) * 100) / 100,
    });
  }

  const total = Math.round((subtotal + cgst + sgst + igst) * 100) / 100;
  return { lineItems, subtotal, cgst, sgst, igst, total };
}

export const commerceQuoteService = {
  async purgeExpired(): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('commerce_quotes')
      .delete()
      .in('status', ['pending', 'checkout'])
      .lt('expires_at', now)
      .select('id');
    throwIfSupabaseError(error, 'Purge expired quotes');
    return data?.length ?? 0;
  },

  async list(): Promise<CommerceQuote[]> {
    await this.purgeExpired();
    const { data, error } = await supabase
      .from('commerce_quotes')
      .select('*')
      .neq('status', 'expired')
      .order('created_at', { ascending: false })
      .limit(500);
    throwIfSupabaseError(error, 'List quotes');
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },

  async get(id: string): Promise<CommerceQuote> {
    await this.purgeExpired();
    const { data, error } = await supabase
      .from('commerce_quotes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error, 'Get quote');
    if (!data) throw new NotFoundError('Quote not found');
    const quote = mapRow(data as Record<string, unknown>);
    if (quote.status === 'pending' || quote.status === 'checkout') {
      if (new Date(quote.expiresAt).getTime() < Date.now()) {
        await supabase.from('commerce_quotes').delete().eq('id', id);
        throw new NotFoundError('Quote expired');
      }
    }
    return quote;
  },

  async getByToken(token: string): Promise<CommerceQuote> {
    await this.purgeExpired();
    const { data, error } = await supabase
      .from('commerce_quotes')
      .select('*')
      .eq('checkout_token', token)
      .maybeSingle();
    throwIfSupabaseError(error, 'Get quote by token');
    if (!data) throw new NotFoundError('Quote not found');
    return mapRow(data as Record<string, unknown>);
  },

  async create(
    input: {
      customerName: string;
      customerPhone?: string;
      customerEmail?: string;
      customerState: string;
      customerGstin?: string;
      shippingAddress?: Record<string, string>;
      paymentType?: 'full' | 'partial' | 'advance';
      prepaidAmount?: number;
      lines: Array<{
        variantId?: number;
        productId?: number;
        sku?: string;
        title: string;
        variantTitle?: string;
        hsnCode?: string;
        qty: number;
        unitPrice: number;
        gstPercent?: number;
      }>;
    },
    adminId?: string
  ): Promise<CommerceQuote> {
    if (!input.lines.length) throw new ValidationError('Select at least one product');

    const totals = await computeLines(input.lines, input.customerState);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + QUOTE_TTL_HOURS);

    const paymentType = input.paymentType ?? 'advance';
    const prepaidAmount = input.prepaidAmount ?? 0;
    const codAmount = Math.max(0, totals.total - prepaidAmount);

    const { data, error } = await supabase
      .from('commerce_quotes')
      .insert({
        quote_number: quoteNumber(),
        status: 'pending',
        customer_name: input.customerName.trim(),
        customer_phone: input.customerPhone?.trim() ?? null,
        customer_email: input.customerEmail?.trim() ?? null,
        customer_state: input.customerState.trim(),
        customer_gstin: input.customerGstin?.trim() ?? null,
        shipping_address: input.shippingAddress ?? {},
        line_items: totals.lineItems,
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        total: totals.total,
        payment_type: paymentType,
        prepaid_amount: prepaidAmount,
        cod_amount: codAmount,
        expires_at: expiresAt.toISOString(),
        created_by: adminId ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Create quote');

    const quote = mapRow(data as Record<string, unknown>);

    try {
      const inv = await invoiceService.generateQuotation({
        customerName: quote.customerName,
        customerState: quote.customerState,
        customerGstin: quote.customerGstin ?? undefined,
        validityDays: 2,
        lines: quote.lineItems.map((l) => ({
          description: l.title,
          hsnCode: l.hsnCode,
          qty: l.qty,
          unitPrice: l.unitPrice,
          gstPercent: l.gstPercent,
        })),
      });
      await supabase
        .from('commerce_quotes')
        .update({ invoice_id: inv.id, updated_at: new Date().toISOString() })
        .eq('id', quote.id);
      quote.invoiceId = String(inv.id);
    } catch {
      /* GST quotation optional if warehouse env missing */
    }

    return quote;
  },

  async startCheckout(
    id: string,
    input: { paymentType: 'full' | 'partial'; prepaidAmount?: number }
  ): Promise<CommerceQuote> {
    const quote = await this.get(id);
    if (quote.status !== 'pending' && quote.status !== 'checkout') {
      throw new ValidationError('Quote is not open for checkout');
    }

    let prepaidAmount = 0;
    let codAmount = quote.total;
    if (input.paymentType === 'full') {
      prepaidAmount = quote.total;
      codAmount = 0;
    } else {
      prepaidAmount = Math.min(quote.total, Math.max(0, input.prepaidAmount ?? 0));
      if (prepaidAmount <= 0 || prepaidAmount >= quote.total) {
        throw new ValidationError('Enter a prepaid amount less than the quote total');
      }
      codAmount = Math.round((quote.total - prepaidAmount) * 100) / 100;
    }

    const { data, error } = await supabase
      .from('commerce_quotes')
      .update({
        status: 'checkout',
        payment_type: input.paymentType,
        prepaid_amount: prepaidAmount,
        cod_amount: codAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Start quote checkout');
    return mapRow(data as Record<string, unknown>);
  },

  async createPayment(id: string) {
    const quote = await this.get(id);
    if (quote.status !== 'checkout') {
      throw new ValidationError('Process to checkout first');
    }
    const amountInr = payAmount(quote);
    if (amountInr <= 0) throw new ValidationError('Nothing to pay online');
    const amountPaise = Math.round(amountInr * 100);

    const receipt = `quo_${String(quote.id).replace(/-/g, '').slice(0, 18)}`;
    const rzOrder = await razorpayCheckoutService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { commerce_quote_id: quote.id, quote_number: quote.quoteNumber },
    });

    await supabase
      .from('commerce_quotes')
      .update({
        razorpay_order_id: rzOrder.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return {
      quoteId: quote.id,
      razorpayOrderId: rzOrder.id,
      amount: amountPaise,
      amountInr,
      currency: 'INR',
      keyId: razorpayCheckoutService.getPublicKey(),
      prefill: {
        name: quote.customerName,
        email: quote.customerEmail ?? 'customer@morbeez.in',
        contact: (quote.customerPhone ?? '').replace(/\D/g, '').slice(-10),
      },
    };
  },

  async verifyPayment(
    id: string,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ) {
    const quote = await this.get(id);
    if (quote.status === 'paid' && quote.shopifyOrderId) {
      return {
        alreadyCompleted: true,
        shopifyOrderId: quote.shopifyOrderId,
        orderName: quote.shopifyOrderName,
      };
    }

    if (
      !razorpayCheckoutService.verifyPaymentSignature(
        input.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature
      )
    ) {
      throw new UnauthorizedError('Payment verification failed');
    }

    const ship = quote.shippingAddress;
    const { firstName, lastName } = splitName(quote.customerName);
    const email = quote.customerEmail ?? `quote+${quote.quoteNumber.toLowerCase()}@morbeez.in`;
    const phone = quote.customerPhone ?? '';

    const lineItems = quote.lineItems
      .filter((l) => l.variantId)
      .map((l) => ({
        variantId: l.variantId!,
        quantity: l.qty,
        title: l.title,
      }));

    if (!lineItems.length) {
      throw new ValidationError('Quote has no Shopify variant lines — cannot convert to order');
    }

    const paidInr = payAmount(quote).toFixed(2);
    const note = [
      `Quote ${quote.quoteNumber}`,
      quote.codAmount > 0 ? `COD balance ₹${quote.codAmount.toFixed(2)}` : null,
      `Razorpay ${input.razorpayPaymentId}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const shopifyOrder = await shopifyOrdersService.createPaidOrder({
      email,
      phone,
      lineItems,
      shipping: {
        firstName,
        lastName,
        address1: ship.address1 ?? ship.address ?? 'Address on file',
        address2: ship.address2,
        city: ship.city ?? quote.customerState,
        province: ship.state ?? quote.customerState,
        zip: ship.pincode ?? ship.zip ?? '560001',
        country: 'IN',
        phone,
      },
      totalAmountInr: paidInr,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      note,
    });

    const sessionId = randomUUID();
    await supabase.from('checkout_sessions').insert({
      id: sessionId,
      razorpay_order_id: input.razorpayOrderId,
      receipt: `quo_${quote.quoteNumber}`,
      amount_paise: Math.round(payAmount(quote) * 100),
      currency: 'INR',
      line_items: quote.lineItems.map((l) => ({
        variantId: l.variantId,
        quantity: l.qty,
        title: l.title,
        price: Math.round(l.unitPrice * 100),
      })),
      customer: { email, phone, firstName, lastName },
      shipping: ship,
      status: 'paid',
      razorpay_payment_id: input.razorpayPaymentId,
      shopify_order_id: shopifyOrder.shopifyOrderId,
      shopify_order_name: shopifyOrder.orderName,
    });

    const { data: commerceOrder } = await supabase
      .from('commerce_orders')
      .select('id')
      .eq('shopify_order_id', shopifyOrder.shopifyOrderId)
      .maybeSingle();

    await supabase
      .from('commerce_quotes')
      .update({
        status: 'paid',
        razorpay_payment_id: input.razorpayPaymentId,
        shopify_order_id: shopifyOrder.shopifyOrderId,
        shopify_order_name: shopifyOrder.orderName,
        commerce_order_id: commerceOrder?.id ?? null,
        checkout_session_id: sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await supabase.from('payment_events').insert({
      provider: 'razorpay',
      external_id: input.razorpayPaymentId,
      event_type: 'quote.payment.captured',
      amount: payAmount(quote),
      currency: 'INR',
      status: 'captured',
      metadata: {
        commerce_quote_id: quote.id,
        shopify_order_id: shopifyOrder.shopifyOrderId,
      },
    });

    return {
      alreadyCompleted: false,
      shopifyOrderId: shopifyOrder.shopifyOrderId,
      orderName: shopifyOrder.orderName,
      orderStatusUrl: shopifyOrder.orderStatusUrl,
      commerceOrderId: commerceOrder?.id ?? null,
    };
  },

  async cancel(id: string): Promise<void> {
    const { error } = await supabase
      .from('commerce_quotes')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfSupabaseError(error, 'Cancel quote');
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('commerce_quotes').delete().eq('id', id);
    throwIfSupabaseError(error, 'Delete quote');
  },
};
