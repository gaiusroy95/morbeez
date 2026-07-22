import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { computeGstBreakup, computeInclusiveGstBreakup, finalizeInclusiveInvoiceTotals, isSameIndianState, normalizeIndianState, } from '../../lib/gst.js';
import { companySettingsService } from '../admin/company-settings.service.js';
function invoiceNumber(prefix) {
    return `${prefix}-${Date.now()}`;
}
export const invoiceService = {
    async generateTaxInvoice(commerceOrderId) {
        return this.generateDocument(commerceOrderId, 'tax_invoice');
    },
    async generateQuotation(input) {
        const company = await companySettingsService.snapshot();
        const companyState = normalizeIndianState(company.state || env.COMPANY_STATE);
        const validity = new Date();
        validity.setDate(validity.getDate() + (input.validityDays ?? 7));
        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        const lineRows = [];
        for (const line of input.lines) {
            const taxable = line.qty * line.unitPrice;
            const gstPct = line.gstPercent ?? 18;
            const breakup = computeGstBreakup({
                taxableAmount: taxable,
                gstPercent: gstPct,
                companyState,
                customerState: input.customerState,
            });
            subtotal += taxable;
            cgst += breakup.cgst;
            sgst += breakup.sgst;
            igst += breakup.igst;
            lineRows.push({
                description: line.description,
                hsn_code: line.hsnCode ?? null,
                qty: line.qty,
                unit_price: line.unitPrice,
                taxable_amount: taxable,
                gst_percent: gstPct,
                cgst: breakup.cgst,
                sgst: breakup.sgst,
                igst: breakup.igst,
            });
        }
        const freight = input.freight ?? 0;
        const total = subtotal + cgst + sgst + igst + freight;
        const { data: inv, error } = await supabase
            .from('invoices')
            .insert({
            invoice_number: invoiceNumber('QUO'),
            document_type: 'quotation',
            status: 'issued',
            customer_name: input.customerName,
            customer_gstin: input.customerGstin ?? null,
            customer_state: input.customerState,
            place_of_supply: input.customerState,
            company_gstin: company.gstin || env.COMPANY_GSTIN || null,
            company_state: companyState,
            subtotal,
            cgst,
            sgst,
            igst,
            freight,
            total,
            validity_date: validity.toISOString().slice(0, 10),
            razorpay_payment_link_url: input.razorpayPaymentLinkUrl ?? null,
            metadata: { company: company.companySnapshot },
            issued_at: new Date().toISOString(),
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Quotation');
        await supabase.from('invoice_lines').insert(lineRows.map((r) => ({ ...r, invoice_id: inv.id })));
        return inv;
    },
    async generateDeliveryChallan(commerceOrderId, purpose = 'stock_transfer') {
        const inv = await this.generateDocument(commerceOrderId, 'delivery_challan');
        const existingMeta = inv.metadata ?? {};
        const metadata = { ...existingMeta, purpose };
        await supabase.from('invoices').update({ metadata }).eq('id', inv.id);
        return { ...inv, metadata };
    },
    async generateDocument(commerceOrderId, documentType) {
        const { data: order, error: orderErr } = await supabase
            .from('commerce_orders')
            .select('*')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(orderErr, 'Order for invoice');
        if (!order)
            throw new NotFoundError('Order not found');
        const { data: lines, error: lineErr } = await supabase
            .from('commerce_order_lines')
            .select('*')
            .eq('commerce_order_id', commerceOrderId);
        throwIfSupabaseError(lineErr, 'Invoice lines');
        const { data: pickLines } = await supabase
            .from('pick_list_lines')
            .select('order_line_id, batch_code')
            .in('order_line_id', (lines ?? []).map((l) => l.id));
        const batchByLine = new Map((pickLines ?? []).map((pl) => [String(pl.order_line_id), pl.batch_code]));
        const company = await companySettingsService.snapshot();
        const companyState = normalizeIndianState(company.state || env.COMPANY_STATE);
        const customerState = normalizeIndianState(order.customer_state);
        const prefix = documentType === 'tax_invoice' ? 'INV' : 'DC';
        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        const lineRows = [];
        let totalInclusive = 0;
        for (const line of lines ?? []) {
            const qty = Number(line.qty_ordered) - Number(line.qty_cancelled);
            if (qty <= 0)
                continue;
            const unitPriceInclusive = Number(line.unit_price) || 0;
            const lineInclusive = Math.round(qty * unitPriceInclusive * 100) / 100;
            const gstPct = Number(line.gst_percent) || 18;
            const breakup = computeInclusiveGstBreakup({
                inclusiveAmount: lineInclusive,
                gstPercent: gstPct,
                companyState,
                customerState,
            });
            subtotal += breakup.taxableAmount;
            cgst += breakup.cgst;
            sgst += breakup.sgst;
            igst += breakup.igst;
            totalInclusive += lineInclusive;
            lineRows.push({
                description: line.product_title,
                hsn_code: line.hsn_code,
                qty,
                unit_price: unitPriceInclusive,
                taxable_amount: breakup.taxableAmount,
                gst_percent: gstPct,
                cgst: breakup.cgst,
                sgst: breakup.sgst,
                igst: breakup.igst,
                batch_code: batchByLine.get(String(line.id)) ?? null,
            });
        }
        const sameState = companyState === customerState && companyState.length > 0;
        const finalized = finalizeInclusiveInvoiceTotals({
            subtotalTaxable: subtotal,
            subtotalInclusive: totalInclusive,
            cgst,
            sgst,
            igst,
            sameState,
        });
        subtotal = finalized.subtotalTaxable;
        cgst = finalized.cgst;
        sgst = finalized.sgst;
        igst = finalized.igst;
        const total = finalized.total;
        const paymentMethod = order.is_cod ? 'COD' : order.payment_method ?? 'Prepaid';
        const { data: inv, error } = await supabase
            .from('invoices')
            .insert({
            commerce_order_id: commerceOrderId,
            invoice_number: invoiceNumber(prefix),
            document_type: documentType,
            status: 'issued',
            customer_name: order.order_name,
            customer_gstin: order.customer_gstin,
            customer_state: customerState,
            place_of_supply: customerState,
            company_gstin: company.gstin || env.COMPANY_GSTIN || null,
            company_state: companyState,
            subtotal,
            cgst,
            sgst,
            igst,
            total,
            metadata: {
                company: company.companySnapshot,
                orderSource: order.order_source ?? 'website',
                paymentMethod,
                pricingMode: 'tax_inclusive',
            },
            issued_at: new Date().toISOString(),
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Invoice');
        if (lineRows.length) {
            await supabase.from('invoice_lines').insert(lineRows.map((r) => ({ ...r, invoice_id: inv.id })));
        }
        return {
            ...inv,
            taxBreakup: {
                sameState: companyState === customerState && companyState.length > 0,
                cgst,
                sgst,
                igst,
            },
        };
    },
    async repairTaxInvoice(invoiceId) {
        const { data: inv, error: invErr } = await supabase
            .from('invoices')
            .select('*, invoice_lines(*)')
            .eq('id', invoiceId)
            .single();
        throwIfSupabaseError(invErr, 'Invoice repair');
        if (!inv)
            throw new NotFoundError('Invoice not found');
        if (inv.document_type !== 'tax_invoice' || !inv.commerce_order_id)
            return inv;
        const meta = inv.metadata ?? {};
        const company = await companySettingsService.snapshot();
        const companyState = normalizeIndianState(company.state);
        const storedCompanyState = normalizeIndianState(inv.company_state);
        const alreadyInclusive = meta.pricingMode === 'tax_inclusive';
        const companyStateMatches = !companyState ||
            storedCompanyState.toLowerCase() === companyState.toLowerCase();
        if (alreadyInclusive && companyStateMatches)
            return inv;
        const { data: order, error: orderErr } = await supabase
            .from('commerce_orders')
            .select('*')
            .eq('id', inv.commerce_order_id)
            .single();
        throwIfSupabaseError(orderErr, 'Order for invoice backfill');
        if (!order)
            throw new NotFoundError('Order not found');
        const { data: lines, error: lineErr } = await supabase
            .from('commerce_order_lines')
            .select('*')
            .eq('commerce_order_id', inv.commerce_order_id);
        throwIfSupabaseError(lineErr, 'Invoice backfill lines');
        const { data: pickLines } = await supabase
            .from('pick_list_lines')
            .select('order_line_id, batch_code')
            .in('order_line_id', (lines ?? []).map((l) => l.id));
        const batchByLine = new Map((pickLines ?? []).map((pl) => [String(pl.order_line_id), pl.batch_code]));
        const customerState = normalizeIndianState(inv.customer_state || inv.place_of_supply);
        const sameState = isSameIndianState(companyState, customerState);
        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let totalInclusive = 0;
        const lineRows = [];
        for (const line of lines ?? []) {
            const qty = Number(line.qty_ordered) - Number(line.qty_cancelled);
            if (qty <= 0)
                continue;
            const unitPriceInclusive = Number(line.unit_price) || 0;
            const lineInclusive = Math.round(qty * unitPriceInclusive * 100) / 100;
            const gstPct = Number(line.gst_percent) || 18;
            const breakup = computeInclusiveGstBreakup({
                inclusiveAmount: lineInclusive,
                gstPercent: gstPct,
                companyState,
                customerState,
            });
            subtotal += breakup.taxableAmount;
            cgst += breakup.cgst;
            sgst += breakup.sgst;
            igst += breakup.igst;
            totalInclusive += lineInclusive;
            lineRows.push({
                description: line.product_title,
                hsn_code: line.hsn_code,
                qty,
                unit_price: unitPriceInclusive,
                taxable_amount: breakup.taxableAmount,
                gst_percent: gstPct,
                cgst: breakup.cgst,
                sgst: breakup.sgst,
                igst: breakup.igst,
                batch_code: batchByLine.get(String(line.id)) ?? null,
            });
        }
        const finalized = finalizeInclusiveInvoiceTotals({
            subtotalTaxable: subtotal,
            subtotalInclusive: totalInclusive,
            cgst,
            sgst,
            igst,
            sameState,
        });
        const { error: updateErr } = await supabase
            .from('invoices')
            .update({
            company_state: companyState,
            subtotal: finalized.subtotalTaxable,
            cgst: finalized.cgst,
            sgst: finalized.sgst,
            igst: finalized.igst,
            total: finalized.total,
            metadata: {
                ...meta,
                pricingMode: 'tax_inclusive',
                company: company.companySnapshot,
            },
        })
            .eq('id', invoiceId);
        throwIfSupabaseError(updateErr, 'Invoice repair update');
        await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);
        if (lineRows.length) {
            await supabase.from('invoice_lines').insert(lineRows.map((r) => ({ ...r, invoice_id: invoiceId })));
        }
        return this.getInvoice(invoiceId);
    },
    async getInvoice(invoiceId) {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, invoice_lines(*)')
            .eq('id', invoiceId)
            .single();
        throwIfSupabaseError(error, 'Get invoice');
        if (!data)
            throw new NotFoundError('Invoice not found');
        return data;
    },
    async generateCreditNote(commerceOrderId, refundAmount, reason) {
        const { data: order, error: orderErr } = await supabase
            .from('commerce_orders')
            .select('*')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(orderErr, 'Order for credit note');
        if (!order)
            throw new NotFoundError('Order not found');
        const company = await companySettingsService.snapshot();
        const companyState = normalizeIndianState(company.state || env.COMPANY_STATE);
        const customerState = normalizeIndianState(order.customer_state);
        const { data: inv, error } = await supabase
            .from('invoices')
            .insert({
            commerce_order_id: commerceOrderId,
            invoice_number: invoiceNumber('CN'),
            document_type: 'credit_note',
            status: 'issued',
            customer_name: order.order_name,
            customer_gstin: order.customer_gstin,
            customer_state: customerState,
            place_of_supply: customerState,
            company_gstin: company.gstin || env.COMPANY_GSTIN || null,
            company_state: companyState,
            subtotal: refundAmount,
            total: refundAmount,
            metadata: { company: company.companySnapshot, reason },
            issued_at: new Date().toISOString(),
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Credit note');
        await supabase.from('invoice_lines').insert({
            invoice_id: inv.id,
            description: reason,
            qty: 1,
            unit_price: refundAmount,
            taxable_amount: refundAmount,
            gst_percent: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
        });
        return inv;
    },
};
//# sourceMappingURL=invoice.service.js.map