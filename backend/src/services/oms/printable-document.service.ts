import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { amountInIndianWords } from '../../lib/indian-currency-words.js';
import {
  computeInclusiveGstBreakup,
  finalizeInclusiveInvoiceTotals,
  halfGstRate,
  isSameIndianState,
  normalizeIndianState,
} from '../../lib/gst.js';
import { companySettingsService } from '../admin/company-settings.service.js';
import { invoiceService } from './invoice.service.js';
import { returnWorkflowService } from './return-workflow.service.js';

export type PrintableDocType =
  | 'picking_slip'
  | 'packing_slip'
  | 'tax_invoice'
  | 'courier_label'
  | 'return_inspection';

function formatAddress(addr: Record<string, unknown> | null | undefined): string[] {
  if (!addr) return [];
  const parts = [
    addr.name,
    addr.address1 ?? addr.line1,
    addr.address2 ?? addr.line2,
    [addr.city, addr.province ?? addr.state, addr.zip ?? addr.pincode].filter(Boolean).join(', '),
    addr.phone,
  ].filter(Boolean);
  return parts.map(String);
}

export const printableDocumentService = {
  async getDocument(type: PrintableDocType, entityId: string) {
    const company = await companySettingsService.snapshot();
    const companyBlock = {
      companyName: company.companyName,
      formattedAddress: company.formattedAddress,
      gstin: company.gstin,
      customerCareNumber: company.customerCareNumber,
      whatsappNumber: company.whatsappNumber,
      quotationLogoUrl: company.quotationLogoUrl,
      termsAndConditions: company.termsAndConditions,
    };

    switch (type) {
      case 'picking_slip':
        return { type, company: companyBlock, document: await this.buildPickingSlip(entityId) };
      case 'packing_slip':
        return { type, company: companyBlock, document: await this.buildPackingSlip(entityId) };
      case 'tax_invoice':
        return { type, company: companyBlock, document: await this.buildTaxInvoice(entityId) };
      case 'courier_label':
        return { type, company: companyBlock, document: await this.buildCourierLabel(entityId) };
      case 'return_inspection':
        return { type, company: companyBlock, document: await this.buildReturnInspection(entityId) };
      default:
        throw new NotFoundError('Unknown document type');
    }
  },

  async buildPickingSlip(pickListId: string) {
    const { data, error } = await supabase
      .from('pick_lists')
      .select(
        '*, commerce_orders(order_name, shopify_order_id, phone), pick_list_lines(*, inventory_items(barcode, product_title))'
      )
      .eq('id', pickListId)
      .single();
    throwIfSupabaseError(error, 'Picking slip');
    if (!data) throw new NotFoundError('Pick list not found');

    const order = data.commerce_orders as Record<string, unknown> | null;
    const lines = (data.pick_list_lines ?? []) as Array<Record<string, unknown>>;

    return {
      title: 'Picking Slip',
      orderId: order?.order_name ?? order?.shopify_order_id ?? data.commerce_order_id,
      pickListId: data.id,
      pickerId: data.picker_id,
      status: data.status,
      printedAt: new Date().toISOString(),
      lines: lines.map((l) => {
        const item = l.inventory_items as Record<string, unknown> | null;
        return {
          sku: l.sku,
          productTitle: l.product_title,
          barcode: item?.barcode ?? l.sku,
          batchCode: l.batch_code,
          rackLocation: l.rack_location,
          qty: l.qty_required,
          qrPayload: `PICK|${data.id}|${l.sku}|${l.batch_code ?? ''}`,
        };
      }),
    };
  },

  async buildPackingSlip(pickListId: string) {
    const { data, error } = await supabase
      .from('pick_lists')
      .select('*, commerce_orders(*)')
      .eq('id', pickListId)
      .single();
    throwIfSupabaseError(error, 'Packing slip');
    if (!data) throw new NotFoundError('Pick list not found');

    const order = data.commerce_orders as Record<string, unknown>;
    const { data: lines } = await supabase
      .from('pick_list_lines')
      .select('*')
      .eq('pick_list_id', pickListId);

    const shipAddr = order.shipping_address as Record<string, unknown> | null;
    const totalWeight = (lines ?? []).reduce((s, l) => s + Number(l.qty_required), 0);

    return {
      title: 'Packing Slip',
      orderId: order.order_name ?? order.shopify_order_id,
      customerName: order.order_name,
      phone: order.phone,
      shippingAddress: formatAddress(shipAddr),
      specialInstructions: null,
      totalWeightKg: totalWeight,
      printedAt: new Date().toISOString(),
      lines: (lines ?? []).map((l) => ({
        productTitle: l.product_title,
        sku: l.sku,
        batchCode: l.batch_code,
        qty: l.qty_required,
      })),
    };
  },

  async buildTaxInvoice(invoiceId: string) {
    const companyLive = await companySettingsService.get();

    let { data, error } = await supabase
      .from('invoices')
      .select(
        '*, invoice_lines(*), commerce_orders(order_name, shopify_order_id, order_source, payment_method, is_cod, phone, shipping_address, created_at, total_amount)'
      )
      .eq('id', invoiceId)
      .single();
    throwIfSupabaseError(error, 'Invoice document');
    if (!data) throw new NotFoundError('Invoice not found');

    const initialMeta = (data.metadata as Record<string, unknown> | null) ?? {};
    const storedCompanyState = normalizeIndianState(String(data.company_state ?? ''));
    const liveCompanyState = normalizeIndianState(companyLive.state);
    const needsTaxRepair =
      data.document_type === 'tax_invoice' &&
      (initialMeta.pricingMode !== 'tax_inclusive' ||
        (liveCompanyState.length > 0 &&
          storedCompanyState.toLowerCase() !== liveCompanyState.toLowerCase()));
    if (needsTaxRepair) {
      await invoiceService.repairTaxInvoice(invoiceId);
      const refetch = await supabase
        .from('invoices')
        .select(
          '*, invoice_lines(*), commerce_orders(order_name, shopify_order_id, order_source, payment_method, is_cod, phone, shipping_address, created_at, total_amount)'
        )
        .eq('id', invoiceId)
        .single();
      throwIfSupabaseError(refetch.error, 'Invoice document refetch');
      if (!refetch.data) throw new NotFoundError('Invoice not found');
      data = refetch.data;
    }

    const order = data.commerce_orders as Record<string, unknown> | null;
    const meta = (data.metadata as Record<string, unknown> | null) ?? {};
    const companySnap = (meta.company as Record<string, unknown> | null) ?? {};
    const companyState = normalizeIndianState(
      String(companyLive.state || companySnap.state || data.company_state || '')
    );
    const customerState = normalizeIndianState(
      String(data.customer_state || data.place_of_supply || '')
    );
    const sameState = isSameIndianState(companyState, customerState);
    const pricingMode =
      meta.pricingMode === 'tax_exclusive' ? 'tax_exclusive' : 'tax_inclusive';

    let skuByTitle = new Map<string, string>();
    if (data.commerce_order_id) {
      const { data: orderLines } = await supabase
        .from('commerce_order_lines')
        .select('product_title, sku')
        .eq('commerce_order_id', data.commerce_order_id);
      skuByTitle = new Map(
        (orderLines ?? []).map((ol) => [String(ol.product_title), String(ol.sku ?? '')])
      );
    }

    const rawLines = (data.invoice_lines ?? []) as Array<Record<string, unknown>>;
    const lines = rawLines.map((l) => {
      const qty = Number(l.qty) || 0;
      const unitPrice = Number(l.unit_price) || 0;
      const gstPercent = Number(l.gst_percent) || 18;
      const lineInclusive = Math.round(qty * unitPrice * 100) / 100;

      let taxableAmount = Number(l.taxable_amount) || 0;
      let cgst = Number(l.cgst) || 0;
      let sgst = Number(l.sgst) || 0;
      let igst = Number(l.igst) || 0;

      if (pricingMode === 'tax_inclusive' && lineInclusive > 0) {
        const breakup = computeInclusiveGstBreakup({
          inclusiveAmount: lineInclusive,
          gstPercent,
          companyState,
          customerState,
        });
        taxableAmount = breakup.taxableAmount;
        cgst = breakup.cgst;
        sgst = breakup.sgst;
        igst = breakup.igst;
      }

      const title = String(l.description ?? '');
      return {
        description: l.description,
        hsnCode: l.hsn_code,
        sku: skuByTitle.get(title) || null,
        qty,
        unitPrice,
        lineTotal: lineInclusive,
        taxableAmount,
        gstPercent,
        halfGstPercent: halfGstRate(gstPercent),
        cgst,
        sgst,
        igst,
        gstAmount: cgst + sgst + igst,
        batchCode: l.batch_code,
      };
    });

    const slabMap = new Map<number, { cgst: number; sgst: number; igst: number }>();
    for (const line of lines) {
      const prev = slabMap.get(line.gstPercent) ?? { cgst: 0, sgst: 0, igst: 0 };
      prev.cgst += line.cgst;
      prev.sgst += line.sgst;
      prev.igst += line.igst;
      slabMap.set(line.gstPercent, prev);
    }
    const gstSlabSummary = [...slabMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([gstPercent, taxes]) => {
        const cgstAmt = Math.round(taxes.cgst * 100) / 100;
        const sgstAmt = Math.round(taxes.sgst * 100) / 100;
        const igstAmt = Math.round(taxes.igst * 100) / 100;
        return {
          gstPercent,
          halfPercent: halfGstRate(gstPercent),
          cgst: cgstAmt,
          sgst: sgstAmt,
          igst: igstAmt,
          totalTax: Math.round((cgstAmt + sgstAmt + igstAmt) * 100) / 100,
        };
      });

    let subtotalTaxable = lines.reduce((s, l) => s + l.taxableAmount, 0);
    let subtotalInclusive = lines.reduce((s, l) => s + l.lineTotal, 0);
    let cgst = lines.reduce((s, l) => s + l.cgst, 0);
    let sgst = lines.reduce((s, l) => s + l.sgst, 0);
    let igst = lines.reduce((s, l) => s + l.igst, 0);
    let total =
      pricingMode === 'tax_inclusive' ? subtotalInclusive : Number(data.total) || 0;

    if (pricingMode === 'tax_inclusive') {
      const finalized = finalizeInclusiveInvoiceTotals({
        subtotalTaxable,
        subtotalInclusive,
        cgst,
        sgst,
        igst,
        sameState,
      });
      subtotalTaxable = finalized.subtotalTaxable;
      subtotalInclusive = finalized.subtotalInclusive;
      cgst = finalized.cgst;
      sgst = finalized.sgst;
      igst = finalized.igst;
      total = finalized.total;
    }

    const hsnMap = new Map<
      string,
      { hsn: string; gstPercent: number; taxable: number; cgst: number; sgst: number; igst: number }
    >();
    for (const line of lines) {
      const key = `${line.hsnCode ?? '—'}|${line.gstPercent}`;
      const prev = hsnMap.get(key) ?? {
        hsn: String(line.hsnCode ?? '—'),
        gstPercent: line.gstPercent,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
      };
      prev.taxable += line.taxableAmount;
      prev.cgst += line.cgst;
      prev.sgst += line.sgst;
      prev.igst += line.igst;
      hsnMap.set(key, prev);
    }

    const shipAddr = order?.shipping_address as Record<string, unknown> | null;
    const billAddr = shipAddr;
    const issued = data.issued_at ? new Date(String(data.issued_at)) : new Date();
    const paymentMethod =
      order?.payment_method ?? (order?.is_cod ? 'Cash on Delivery' : 'Prepaid');
    const codCollect = order?.is_cod ? Number(order.total_amount ?? data.total) : 0;

    return {
      title: 'Tax Invoice',
      invoiceNumber: data.invoice_number,
      documentType: data.document_type,
      issuedAt: data.issued_at,
      invoiceDate: issued.toLocaleDateString('en-IN'),
      orderDate: order?.created_at
        ? new Date(String(order.created_at)).toLocaleDateString('en-IN')
        : issued.toLocaleDateString('en-IN'),
      orderName: order?.order_name ?? order?.shopify_order_id ?? null,
      customerName: data.customer_name,
      customerGstin: data.customer_gstin,
      customerState: data.customer_state,
      placeOfSupply: data.place_of_supply,
      companyGstin: data.company_gstin,
      companyState,
      orderSource: order?.order_source ?? 'website',
      paymentMethod,
      paymentTerms: order?.is_cod ? 'Cash on Delivery' : 'Paid',
      termsOfDelivery: order?.is_cod ? 'Cash on Delivery' : 'Paid',
      codAmount: codCollect,
      subtotal: subtotalTaxable,
      subtotalInclusive,
      cgst,
      sgst,
      igst,
      freight: data.freight,
      total,
      balanceDue: total,
      totalInWords: amountInIndianWords(total),
      pricingMode,
      taxBreakup: { sameState, cgst, sgst, igst },
      billTo: formatAddress(billAddr),
      shipTo: formatAddress(shipAddr),
      bankDetails: {
        accountName:
          String(companySnap.bankAccountName ?? companyLive.bankAccountName ?? '') || null,
        accountNumber:
          String(companySnap.bankAccountNumber ?? companyLive.bankAccountNumber ?? '') || null,
        bankName: String(companySnap.bankName ?? companyLive.bankName ?? '') || null,
        branch: String(companySnap.bankBranch ?? companyLive.bankBranch ?? '') || null,
        ifsc: String(companySnap.bankIfsc ?? companyLive.bankIfsc ?? '') || null,
      },
      lines,
      gstSlabSummary,
      hsnSummary: [...hsnMap.values()].map((row) => ({
        hsn: row.hsn,
        gstPercent: row.gstPercent,
        halfPercent: halfGstRate(row.gstPercent),
        taxableAmount: Math.round(row.taxable * 100) / 100,
        cgst: Math.round(row.cgst * 100) / 100,
        sgst: Math.round(row.sgst * 100) / 100,
        igst: Math.round(row.igst * 100) / 100,
        totalTax: Math.round((row.cgst + row.sgst + row.igst) * 100) / 100,
      })),
      companySnapshot: companySnap,
      jurisdictionNote: `SUBJECT TO ${String(companySnap.district ?? companySnap.state ?? 'LOCAL').toUpperCase()} JURISDICTION`,
    };
  },

  async buildCourierLabel(commerceOrderId: string) {
    const { data: order, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(error, 'Courier label order');
    if (!order) throw new NotFoundError('Order not found');

    const shipAddr = order.shipping_address as Record<string, unknown> | null;
    const codAmount = order.is_cod ? Number(order.total_amount) : 0;

    const labelUrl = (order.label_url as string | null)?.trim() || null;

    const { data: shipLabel } = await supabase
      .from('shipping_labels')
      .select('id, qr_code, print_sequence, assigned_employee_name')
      .eq('commerce_order_id', commerceOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      title: 'Courier Label',
      orderId: order.order_name ?? order.shopify_order_id,
      awbCode: order.tracking_awb,
      courierName: order.courier_name ?? 'Shiprocket',
      dispatchRack: order.dispatch_rack ?? null,
      deliveryAddress: formatAddress(shipAddr),
      contactNumber: order.phone ?? shipAddr?.phone ?? null,
      codAmount,
      barcodePayload: order.tracking_awb ? `AWB|${order.tracking_awb}` : null,
      qrPayload: shipLabel?.qr_code ? String(shipLabel.qr_code) : null,
      assignedEmployee: shipLabel?.assigned_employee_name
        ? String(shipLabel.assigned_employee_name)
        : (order.assigned_employee_name as string | null) ?? null,
      printSequence: shipLabel?.print_sequence ?? null,
      shiprocketLabelUrl: labelUrl,
      printedAt: new Date().toISOString(),
    };
  },

  async buildReturnInspection(returnId: string) {
    const row = await returnWorkflowService.get(returnId);
    const order = row.commerce_orders as Record<string, unknown>;

    return {
      title: 'Return / Refund Inspection Sheet',
      returnNumber: row.return_number,
      status: row.status,
      orderId: order.order_name ?? order.shopify_order_id,
      reason: row.reason,
      customerComplaint: row.customer_complaint,
      verificationCallDone: row.verification_call_done,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at,
      receivedAt: row.received_at,
      productCondition: row.product_condition,
      inspectionNotes: row.inspection_notes,
      refundType: row.refund_type,
      refundAmount: row.refund_amount,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      stockAction: row.stock_action,
      lines: row.lines,
      printedAt: new Date().toISOString(),
    };
  },

  async getDocumentsForOrder(commerceOrderId: string) {
    const { data: pickList } = await supabase
      .from('pick_lists')
      .select('id')
      .eq('commerce_order_id', commerceOrderId)
      .maybeSingle();

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, document_type, invoice_number, status, issued_at')
      .eq('commerce_order_id', commerceOrderId)
      .order('created_at', { ascending: false });

    const { data: returns } = await supabase
      .from('return_requests')
      .select('id, return_number, status')
      .eq('commerce_order_id', commerceOrderId);

    return {
      pickListId: pickList?.id ?? null,
      invoices: invoices ?? [],
      returns: returns ?? [],
      printables: [
        pickList?.id
          ? { type: 'picking_slip' as const, id: pickList.id, label: 'Picking slip' }
          : null,
        pickList?.id
          ? { type: 'packing_slip' as const, id: pickList.id, label: 'Packing slip' }
          : null,
        ...(invoices ?? [])
          .filter((i) => i.document_type === 'tax_invoice')
          .map((i) => ({
            type: 'tax_invoice' as const,
            id: i.id,
            label: `Invoice ${i.invoice_number}`,
          })),
        { type: 'courier_label' as const, id: commerceOrderId, label: 'Courier label' },
        ...(returns ?? []).map((r) => ({
          type: 'return_inspection' as const,
          id: r.id,
          label: `Return ${r.return_number}`,
        })),
      ].filter(Boolean),
    };
  },
};
