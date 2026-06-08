import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { companySettingsService } from '../admin/company-settings.service.js';
import { returnWorkflowService } from './return-workflow.service.js';
function formatAddress(addr) {
    if (!addr)
        return [];
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
    async getDocument(type, entityId) {
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
    async buildPickingSlip(pickListId) {
        const { data, error } = await supabase
            .from('pick_lists')
            .select('*, commerce_orders(order_name, shopify_order_id, phone), pick_list_lines(*, inventory_items(barcode, product_title))')
            .eq('id', pickListId)
            .single();
        throwIfSupabaseError(error, 'Picking slip');
        if (!data)
            throw new NotFoundError('Pick list not found');
        const order = data.commerce_orders;
        const lines = (data.pick_list_lines ?? []);
        return {
            title: 'Picking Slip',
            orderId: order?.order_name ?? order?.shopify_order_id ?? data.commerce_order_id,
            pickListId: data.id,
            pickerId: data.picker_id,
            status: data.status,
            printedAt: new Date().toISOString(),
            lines: lines.map((l) => {
                const item = l.inventory_items;
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
    async buildPackingSlip(pickListId) {
        const { data, error } = await supabase
            .from('pick_lists')
            .select('*, commerce_orders(*)')
            .eq('id', pickListId)
            .single();
        throwIfSupabaseError(error, 'Packing slip');
        if (!data)
            throw new NotFoundError('Pick list not found');
        const order = data.commerce_orders;
        const { data: lines } = await supabase
            .from('pick_list_lines')
            .select('*')
            .eq('pick_list_id', pickListId);
        const shipAddr = order.shipping_address;
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
    async buildTaxInvoice(invoiceId) {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, invoice_lines(*), commerce_orders(order_name, order_source, payment_method, is_cod, phone)')
            .eq('id', invoiceId)
            .single();
        throwIfSupabaseError(error, 'Invoice document');
        if (!data)
            throw new NotFoundError('Invoice not found');
        const order = data.commerce_orders;
        const meta = data.metadata ?? {};
        return {
            title: 'Tax Invoice',
            invoiceNumber: data.invoice_number,
            documentType: data.document_type,
            issuedAt: data.issued_at,
            customerName: data.customer_name,
            customerGstin: data.customer_gstin,
            customerState: data.customer_state,
            placeOfSupply: data.place_of_supply,
            companyGstin: data.company_gstin,
            companyState: data.company_state,
            orderSource: order?.order_source ?? 'website',
            paymentMethod: order?.payment_method ?? (order?.is_cod ? 'COD' : 'Prepaid'),
            subtotal: data.subtotal,
            cgst: data.cgst,
            sgst: data.sgst,
            igst: data.igst,
            freight: data.freight,
            total: data.total,
            taxBreakup: {
                sameState: data.company_state === data.customer_state,
                cgst: data.cgst,
                sgst: data.sgst,
                igst: data.igst,
            },
            lines: (data.invoice_lines ?? []).map((l) => ({
                description: l.description,
                hsnCode: l.hsn_code,
                qty: l.qty,
                unitPrice: l.unit_price,
                taxableAmount: l.taxable_amount,
                gstPercent: l.gst_percent,
                cgst: l.cgst,
                sgst: l.sgst,
                igst: l.igst,
                batchCode: l.batch_code,
            })),
            companySnapshot: meta.company ?? null,
        };
    },
    async buildCourierLabel(commerceOrderId) {
        const { data: order, error } = await supabase
            .from('commerce_orders')
            .select('*')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(error, 'Courier label order');
        if (!order)
            throw new NotFoundError('Order not found');
        const shipAddr = order.shipping_address;
        const codAmount = order.is_cod ? Number(order.total_amount) : 0;
        return {
            title: 'Courier Label',
            orderId: order.order_name ?? order.shopify_order_id,
            awbCode: order.tracking_awb,
            courierName: order.courier_name ?? 'Shiprocket',
            deliveryAddress: formatAddress(shipAddr),
            contactNumber: order.phone ?? shipAddr?.phone ?? null,
            codAmount,
            barcodePayload: order.tracking_awb ? `AWB|${order.tracking_awb}` : null,
            printedAt: new Date().toISOString(),
        };
    },
    async buildReturnInspection(returnId) {
        const row = await returnWorkflowService.get(returnId);
        const order = row.commerce_orders;
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
    async getDocumentsForOrder(commerceOrderId) {
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
                    ? { type: 'picking_slip', id: pickList.id, label: 'Picking slip' }
                    : null,
                pickList?.id
                    ? { type: 'packing_slip', id: pickList.id, label: 'Packing slip' }
                    : null,
                ...(invoices ?? [])
                    .filter((i) => i.document_type === 'tax_invoice')
                    .map((i) => ({
                    type: 'tax_invoice',
                    id: i.id,
                    label: `Invoice ${i.invoice_number}`,
                })),
                { type: 'courier_label', id: commerceOrderId, label: 'Courier label' },
                ...(returns ?? []).map((r) => ({
                    type: 'return_inspection',
                    id: r.id,
                    label: `Return ${r.return_number}`,
                })),
            ].filter(Boolean),
        };
    },
};
//# sourceMappingURL=printable-document.service.js.map