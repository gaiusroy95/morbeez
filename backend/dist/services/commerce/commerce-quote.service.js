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
function quoteNumber() {
    const seq = String(Date.now()).slice(-5);
    return `QT-${seq}`;
}
function formatDocDate(iso) {
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
        return iso;
    }
}
function mapRow(row) {
    const expiresAt = String(row.expires_at);
    const hoursLeft = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
    return {
        id: String(row.id),
        quoteNumber: String(row.quote_number),
        status: String(row.status),
        leadId: row.lead_id ? String(row.lead_id) : null,
        farmerId: row.farmer_id ? String(row.farmer_id) : null,
        customerName: String(row.customer_name),
        customerPhone: row.customer_phone ? String(row.customer_phone) : null,
        customerEmail: row.customer_email ? String(row.customer_email) : null,
        customerState: String(row.customer_state ?? 'Karnataka'),
        customerGstin: row.customer_gstin ? String(row.customer_gstin) : null,
        shippingAddress: row.shipping_address ?? {},
        lineItems: row.line_items ?? [],
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
        preparedByName: row.prepared_by_name ? String(row.prepared_by_name) : null,
        sentAt: row.sent_at ? String(row.sent_at) : null,
        whatsappSentAt: row.whatsapp_sent_at ? String(row.whatsapp_sent_at) : null,
        emailSentAt: row.email_sent_at ? String(row.email_sent_at) : null,
        acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        hoursLeft,
    };
}
function quoteViewUrl(quoteId) {
    const base = (env.CONSOLE_PUBLIC_URL ?? 'https://morbeez.vercel.app').replace(/\/$/, '');
    return `${base}/commerce/quotes/${quoteId}`;
}
function quoteCheckoutUrl(quoteId) {
    const base = (env.CONSOLE_PUBLIC_URL ?? 'https://morbeez.vercel.app').replace(/\/$/, '');
    return `${base}/commerce/quotes/${quoteId}/checkout`;
}
function buildQuoteShareText(quote) {
    const lineText = quote.lineItems
        .map((l, i) => `${i + 1}. ${l.title} × ${l.qty} — ₹${l.amountInclGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
        .join('\n');
    const parts = [
        `🧾 *Quotation ${quote.quoteNumber}*`,
        '',
        `Dear ${quote.customerName},`,
        '',
        lineText,
        '',
        `*Total (incl. GST):* ₹${quote.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    ];
    if (quote.prepaidAmount > 0) {
        parts.push(`*Advance:* ₹${quote.prepaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, `*COD balance:* ₹${quote.codAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    }
    parts.push('', `Valid until: ${formatDocDate(quote.expiresAt)}`, '', `View quotation: ${quoteViewUrl(quote.id)}`);
    if (quote.preparedByName) {
        parts.push('', `Prepared by: ${quote.preparedByName}`);
    }
    parts.push('', '— Morbeez Agri Sciences');
    return parts.join('\n');
}
function buildMailtoUrl(email, quote) {
    const subject = encodeURIComponent(`Quotation ${quote.quoteNumber} — Morbeez`);
    const body = encodeURIComponent(buildQuoteShareText(quote));
    return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}
function buildWhatsAppUrl(phone, quote) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!digits)
        return null;
    return `https://wa.me/91${digits}?text=${encodeURIComponent(buildQuoteShareText(quote))}`;
}
async function persistQuoteLines(quoteId, customerState, input) {
    if (!input.lines.length)
        throw new ValidationError('Add at least one product');
    const totals = await computeLines(input.lines, customerState);
    const paymentType = input.paymentType ?? 'advance';
    const prepaidAmount = input.prepaidAmount ?? 0;
    const codAmount = Math.max(0, totals.total - prepaidAmount);
    const now = new Date().toISOString();
    const patch = {
        line_items: totals.lineItems,
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        total: totals.total,
        payment_type: paymentType,
        prepaid_amount: prepaidAmount,
        cod_amount: codAmount,
        updated_at: now,
    };
    if (input.preparedByName !== undefined) {
        patch.prepared_by_name = input.preparedByName.trim() || null;
    }
    const { data, error } = await supabase
        .from('commerce_quotes')
        .update(patch)
        .eq('id', quoteId)
        .select('*')
        .single();
    throwIfSupabaseError(error, 'Update quote');
    return mapRow(data);
}
function splitName(full) {
    const parts = full.trim().split(/\s+/);
    if (parts.length <= 1)
        return { firstName: parts[0] || 'Customer', lastName: '.' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
function payAmount(quote) {
    if (quote.paymentType === 'full')
        return quote.total;
    if (quote.paymentType === 'partial')
        return quote.prepaidAmount;
    return quote.prepaidAmount > 0 ? quote.prepaidAmount : quote.total;
}
async function computeLines(lines, customerState) {
    const company = await companySettingsService.get();
    const companyState = normalizeIndianState(company.state || env.COMPANY_STATE);
    const custState = normalizeIndianState(customerState);
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const lineItems = [];
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
    async purgeExpired() {
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
    async list() {
        await this.purgeExpired();
        const { data, error } = await supabase
            .from('commerce_quotes')
            .select('*')
            .neq('status', 'expired')
            .order('created_at', { ascending: false })
            .limit(500);
        throwIfSupabaseError(error, 'List quotes');
        return (data ?? []).map((r) => mapRow(r));
    },
    async get(id) {
        await this.purgeExpired();
        const { data, error } = await supabase
            .from('commerce_quotes')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        throwIfSupabaseError(error, 'Get quote');
        if (!data)
            throw new NotFoundError('Quote not found');
        const quote = mapRow(data);
        if (quote.status === 'pending' || quote.status === 'checkout') {
            if (new Date(quote.expiresAt).getTime() < Date.now()) {
                await supabase.from('commerce_quotes').delete().eq('id', id);
                throw new NotFoundError('Quote expired');
            }
        }
        return quote;
    },
    async getByToken(token) {
        await this.purgeExpired();
        const { data, error } = await supabase
            .from('commerce_quotes')
            .select('*')
            .eq('checkout_token', token)
            .maybeSingle();
        throwIfSupabaseError(error, 'Get quote by token');
        if (!data)
            throw new NotFoundError('Quote not found');
        return mapRow(data);
    },
    async listByLead(leadId) {
        await this.purgeExpired();
        const { data, error } = await supabase
            .from('commerce_quotes')
            .select('*')
            .eq('lead_id', leadId)
            .in('status', ['pending', 'checkout', 'paid'])
            .order('created_at', { ascending: false });
        throwIfSupabaseError(error, 'List lead estimates');
        return (data ?? []).map((r) => mapRow(r));
    },
    async getEstimateDetail(id, leadId) {
        const quote = await this.get(id);
        if (leadId && quote.leadId && quote.leadId !== leadId) {
            throw new NotFoundError('Estimate not found for this lead');
        }
        const company = await companySettingsService.get();
        const ship = quote.shippingAddress;
        const billToLines = [
            quote.customerName,
            quote.customerEmail,
            quote.customerPhone ? `+91 ${quote.customerPhone.replace(/\D/g, '').slice(-10)}` : null,
            [ship.address1 ?? ship.address, ship.city, ship.state, ship.pincode, 'India']
                .filter(Boolean)
                .join(', '),
        ].filter(Boolean);
        const paymentTypeLabel = quote.paymentType === 'full'
            ? 'Full payment'
            : quote.paymentType === 'partial'
                ? 'Partial'
                : 'Advance';
        return {
            quote,
            company,
            document: {
                title: 'Quotation',
                quotationId: quote.quoteNumber,
                dateLabel: formatDocDate(quote.createdAt),
                validUntilLabel: formatDocDate(quote.expiresAt),
                billTo: billToLines,
                shipTo: billToLines,
                paymentTypeLabel,
                preparedByName: quote.preparedByName,
                subtotal: quote.lineItems.reduce((s, l) => s + l.amountInclGst, 0),
                totalInclGst: quote.total,
            },
        };
    },
    async createFromLead(leadId, input, adminId) {
        const { telecallerAdminService } = await import('../admin/telecaller-admin.service.js');
        const detail = await telecallerAdminService.getLeadDetail(leadId);
        const lead = detail.lead;
        const farmer = detail.farmer;
        const shipLine = farmer.shippingAddress ??
            [farmer.village, lead.district, lead.state, farmer.deliveryPincode].filter(Boolean).join(', ');
        return this.create({
            customerName: String(lead.farmerName || 'Customer'),
            customerPhone: lead.phone ? String(lead.phone) : undefined,
            customerEmail: farmer.email ? String(farmer.email) : undefined,
            customerState: String(lead.state ?? farmer.state ?? 'Karnataka'),
            shippingAddress: {
                address: shipLine || undefined,
                address1: shipLine || undefined,
                city: lead.district ? String(lead.district) : undefined,
                state: lead.state ? String(lead.state) : undefined,
                pincode: (farmer.deliveryPincode ?? lead.pincode)
                    ? String(farmer.deliveryPincode ?? lead.pincode)
                    : undefined,
            },
            paymentType: input.paymentType ?? 'advance',
            prepaidAmount: input.prepaidAmount ?? 0,
            lines: input.lines,
            leadId,
            farmerId: String(lead.farmerId),
            preparedByName: input.preparedByName,
        }, adminId);
    },
    async updateFromLead(quoteId, leadId, input) {
        const quote = await this.get(quoteId);
        if (quote.leadId && quote.leadId !== leadId) {
            throw new NotFoundError('Estimate not found for this lead');
        }
        if (quote.status !== 'pending') {
            throw new ValidationError('Only pending quotes can be edited');
        }
        return persistQuoteLines(quoteId, quote.customerState, input);
    },
    async getShareLinks(quoteId, leadId) {
        const quote = await this.get(quoteId);
        if (leadId && quote.leadId && quote.leadId !== leadId) {
            throw new NotFoundError('Estimate not found for this lead');
        }
        const phone = quote.customerPhone ?? '';
        const text = buildQuoteShareText(quote);
        return {
            text,
            checkoutUrl: quoteCheckoutUrl(quote.id),
            viewUrl: quoteViewUrl(quote.id),
            whatsappUrl: buildWhatsAppUrl(phone, quote),
            mailtoUrl: quote.customerEmail ? buildMailtoUrl(quote.customerEmail, quote) : null,
        };
    },
    async sendQuote(quoteId, leadId, channels, agentEmail) {
        const quote = await this.get(quoteId);
        if (quote.leadId && quote.leadId !== leadId) {
            throw new NotFoundError('Estimate not found for this lead');
        }
        if (quote.status === 'expired' || quote.status === 'cancelled') {
            throw new ValidationError('Quote is no longer active');
        }
        const { telecallerAdminService } = await import('../admin/telecaller-admin.service.js');
        const detail = await telecallerAdminService.getLeadDetail(leadId);
        const farmerId = String(detail.lead.farmerId);
        const phone = String(detail.lead.phone ?? quote.customerPhone ?? '');
        const text = buildQuoteShareText(quote);
        const now = new Date().toISOString();
        const patch = { sent_at: now, updated_at: now };
        const result = {
            text,
            whatsappUrl: buildWhatsAppUrl(phone, quote),
            mailtoUrl: quote.customerEmail ? buildMailtoUrl(quote.customerEmail, quote) : null,
            whatsappSent: false,
            emailSent: false,
        };
        if (channels.includes('whatsapp')) {
            if (phone.replace(/\D/g, '').length >= 10) {
                try {
                    await telecallerAdminService.sendWhatsAppMessage(farmerId, text, agentEmail ?? 'Telecaller');
                    result.whatsappSent = true;
                    patch.whatsapp_sent_at = now;
                }
                catch {
                    /* fall back to wa.me link on client */
                }
            }
        }
        if (channels.includes('email')) {
            patch.email_sent_at = now;
            result.emailSent = Boolean(result.mailtoUrl);
        }
        await supabase.from('commerce_quotes').update(patch).eq('id', quoteId);
        return result;
    },
    async create(input, adminId) {
        if (!input.lines.length)
            throw new ValidationError('Select at least one product');
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
            lead_id: input.leadId ?? null,
            farmer_id: input.farmerId ?? null,
            prepared_by_name: input.preparedByName?.trim() ?? null,
            created_by: adminId ?? null,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create quote');
        const quote = mapRow(data);
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
        }
        catch {
            /* GST quotation optional if warehouse env missing */
        }
        return quote;
    },
    async startCheckout(id, input) {
        const quote = await this.get(id);
        if (quote.status !== 'pending' && quote.status !== 'checkout') {
            throw new ValidationError('Quote is not open for checkout');
        }
        let prepaidAmount = 0;
        let codAmount = quote.total;
        if (input.paymentType === 'full') {
            prepaidAmount = quote.total;
            codAmount = 0;
        }
        else {
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
        return mapRow(data);
    },
    async createPayment(id) {
        const quote = await this.get(id);
        if (quote.status !== 'checkout') {
            throw new ValidationError('Process to checkout first');
        }
        const amountInr = payAmount(quote);
        if (amountInr <= 0)
            throw new ValidationError('Nothing to pay online');
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
    async verifyPayment(id, input) {
        const quote = await this.get(id);
        if (quote.status === 'paid' && quote.shopifyOrderId) {
            return {
                alreadyCompleted: true,
                shopifyOrderId: quote.shopifyOrderId,
                orderName: quote.shopifyOrderName,
            };
        }
        if (!razorpayCheckoutService.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
            throw new UnauthorizedError('Payment verification failed');
        }
        const ship = quote.shippingAddress;
        const { firstName, lastName } = splitName(quote.customerName);
        const email = quote.customerEmail ?? `quote+${quote.quoteNumber.toLowerCase()}@morbeez.in`;
        const phone = quote.customerPhone ?? '';
        const lineItems = quote.lineItems
            .filter((l) => l.variantId)
            .map((l) => ({
            variantId: l.variantId,
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
    async acceptQuote(id) {
        const quote = await this.get(id);
        if (quote.status === 'paid') {
            throw new ValidationError('Quote is already paid');
        }
        if (quote.status === 'expired' || quote.status === 'cancelled') {
            throw new ValidationError('Quote is no longer active');
        }
        if (quote.acceptedAt)
            return quote;
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('commerce_quotes')
            .update({ accepted_at: now, updated_at: now })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Accept quote');
        return mapRow(data);
    },
    async cancel(id) {
        const { error } = await supabase
            .from('commerce_quotes')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);
        throwIfSupabaseError(error, 'Cancel quote');
    },
    async delete(id) {
        const { error } = await supabase.from('commerce_quotes').delete().eq('id', id);
        throwIfSupabaseError(error, 'Delete quote');
    },
    async deleteFromLead(id, leadId) {
        const quote = await this.get(id);
        if (quote.leadId && quote.leadId !== leadId) {
            throw new NotFoundError('Estimate not found for this lead');
        }
        if (quote.status === 'paid') {
            throw new ValidationError('Paid quotes cannot be deleted');
        }
        await this.delete(id);
    },
};
//# sourceMappingURL=commerce-quote.service.js.map