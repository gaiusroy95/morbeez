import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { computeGstBreakup, normalizeIndianState } from '../../lib/gst.js';

function invoiceNumber(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export const invoiceService = {
  async generateTaxInvoice(commerceOrderId: string) {
    return this.generateDocument(commerceOrderId, 'tax_invoice');
  },

  async generateQuotation(input: {
    customerName: string;
    customerState: string;
    customerGstin?: string;
    lines: Array<{
      description: string;
      hsnCode?: string;
      qty: number;
      unitPrice: number;
      gstPercent?: number;
    }>;
    freight?: number;
    validityDays?: number;
    razorpayPaymentLinkUrl?: string;
  }) {
    const companyState = normalizeIndianState(env.COMPANY_STATE);
    const validity = new Date();
    validity.setDate(validity.getDate() + (input.validityDays ?? 7));

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const lineRows: Array<Record<string, unknown>> = [];

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
        company_gstin: env.COMPANY_GSTIN ?? null,
        company_state: companyState,
        subtotal,
        cgst,
        sgst,
        igst,
        freight,
        total,
        validity_date: validity.toISOString().slice(0, 10),
        razorpay_payment_link_url: input.razorpayPaymentLinkUrl ?? null,
        issued_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Quotation');

    await supabase.from('invoice_lines').insert(
      lineRows.map((r) => ({ ...r, invoice_id: inv.id }))
    );

    return inv;
  },

  async generateDeliveryChallan(commerceOrderId: string, purpose = 'stock_transfer') {
    const inv = await this.generateDocument(commerceOrderId, 'delivery_challan');
    await supabase
      .from('invoices')
      .update({ metadata: { purpose } })
      .eq('id', inv.id);
    return inv;
  },

  async generateDocument(
    commerceOrderId: string,
    documentType: 'tax_invoice' | 'delivery_challan'
  ) {
    const { data: order, error: orderErr } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(orderErr, 'Order for invoice');
    if (!order) throw new NotFoundError('Order not found');

    const { data: lines, error: lineErr } = await supabase
      .from('commerce_order_lines')
      .select('*, pick_list_lines(batch_code)')
      .eq('commerce_order_id', commerceOrderId);
    throwIfSupabaseError(lineErr, 'Invoice lines');

    const companyState = normalizeIndianState(env.COMPANY_STATE);
    const customerState = normalizeIndianState(order.customer_state);
    const prefix = documentType === 'tax_invoice' ? 'INV' : 'DC';

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const lineRows: Array<Record<string, unknown>> = [];

    for (const line of lines ?? []) {
      const qty = Number(line.qty_ordered) - Number(line.qty_cancelled);
      if (qty <= 0) continue;
      const unitPrice = Number(line.unit_price) || 0;
      const taxable = qty * unitPrice;
      const gstPct = Number(line.gst_percent) || 18;
      const breakup = computeGstBreakup({
        taxableAmount: taxable,
        gstPercent: gstPct,
        companyState,
        customerState,
      });
      subtotal += taxable;
      cgst += breakup.cgst;
      sgst += breakup.sgst;
      igst += breakup.igst;

      lineRows.push({
        description: line.product_title,
        hsn_code: line.hsn_code,
        qty,
        unit_price: unitPrice,
        taxable_amount: taxable,
        gst_percent: gstPct,
        cgst: breakup.cgst,
        sgst: breakup.sgst,
        igst: breakup.igst,
        batch_code: null,
      });
    }

    const total = subtotal + cgst + sgst + igst;

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
        company_gstin: env.COMPANY_GSTIN ?? null,
        company_state: companyState,
        subtotal,
        cgst,
        sgst,
        igst,
        total,
        issued_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Invoice');

    if (lineRows.length) {
      await supabase.from('invoice_lines').insert(
        lineRows.map((r) => ({ ...r, invoice_id: inv.id }))
      );
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

  async getInvoice(invoiceId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*)')
      .eq('id', invoiceId)
      .single();
    throwIfSupabaseError(error, 'Get invoice');
    if (!data) throw new NotFoundError('Invoice not found');
    return data;
  },
};
