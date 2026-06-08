import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { invoiceService } from './invoice.service.js';
import { inventoryService } from '../wms/inventory.service.js';
import { employeeActionLogService } from './employee-action-log.service.js';
import { omsWorkflowService } from './workflow.service.js';
function returnNumber() {
    return `RET-${Date.now()}`;
}
export const returnWorkflowService = {
    async createRequest(input) {
        const { data: order, error: orderErr } = await supabase
            .from('commerce_orders')
            .select('id, order_name, total_amount')
            .eq('id', input.commerceOrderId)
            .single();
        throwIfSupabaseError(orderErr, 'Order for return');
        if (!order)
            throw new NotFoundError('Order not found');
        let lines = input.lines ?? [];
        if (!lines.length) {
            const { data: orderLines } = await supabase
                .from('commerce_order_lines')
                .select('product_title, sku, qty_ordered, qty_cancelled')
                .eq('commerce_order_id', input.commerceOrderId);
            lines = (orderLines ?? []).map((l) => ({
                productTitle: String(l.product_title),
                sku: l.sku ? String(l.sku) : undefined,
                qty: Number(l.qty_ordered) - Number(l.qty_cancelled),
            }));
        }
        const { data, error } = await supabase
            .from('return_requests')
            .insert({
            commerce_order_id: input.commerceOrderId,
            return_number: returnNumber(),
            status: 'requested',
            reason: input.reason,
            customer_complaint: input.customerComplaint ?? null,
            lines,
            created_by: input.createdBy ?? null,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Return request');
        if (input.createdBy) {
            await employeeActionLogService.log({
                actorEmail: input.createdBy,
                actionType: 'return_requested',
                entityType: 'return_request',
                entityId: String(data.id),
                details: { reason: input.reason },
            });
        }
        return data;
    },
    async list(opts) {
        let q = supabase
            .from('return_requests')
            .select('*, commerce_orders(order_name, phone, total_amount, oms_status)')
            .order('created_at', { ascending: false })
            .limit(opts?.limit ?? 50);
        if (opts?.status)
            q = q.eq('status', opts.status);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Return list');
        return data ?? [];
    },
    async get(returnId) {
        const { data, error } = await supabase
            .from('return_requests')
            .select('*, commerce_orders(*)')
            .eq('id', returnId)
            .single();
        throwIfSupabaseError(error, 'Return request');
        if (!data)
            throw new NotFoundError('Return request not found');
        return data;
    },
    async markVerificationPending(returnId, actorEmail) {
        return this.patchStatus(returnId, 'verification_pending', actorEmail, 'verification_call_scheduled');
    },
    async approveReturn(returnId, input) {
        const row = await this.get(returnId);
        const total = Number(row.commerce_orders?.total_amount) || 0;
        let refundAmount = input.refundAmount ?? 0;
        if (input.refundType === 'full')
            refundAmount = total;
        if (input.refundType === 'none')
            refundAmount = 0;
        const { data, error } = await supabase
            .from('return_requests')
            .update({
            status: 'approved',
            refund_type: input.refundType,
            refund_amount: refundAmount,
            approved_by: input.approvedBy ?? null,
            approved_at: new Date().toISOString(),
            verification_call_done: true,
            verified_by: input.approvedBy ?? null,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', returnId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Approve return');
        if (input.approvedBy) {
            await employeeActionLogService.log({
                actorEmail: input.approvedBy,
                actionType: 'return_approved',
                entityType: 'return_request',
                entityId: returnId,
                details: { refundType: input.refundType, refundAmount },
            });
        }
        return data;
    },
    async rejectReturn(returnId, reason, actorEmail) {
        const { data, error } = await supabase
            .from('return_requests')
            .update({
            status: 'rejected',
            inspection_notes: reason,
            updated_at: new Date().toISOString(),
        })
            .eq('id', returnId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Reject return');
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: 'return_rejected',
                entityType: 'return_request',
                entityId: returnId,
                details: { reason },
            });
        }
        return data;
    },
    async markReceived(returnId, actorEmail) {
        const { data, error } = await supabase
            .from('return_requests')
            .update({
            status: 'received',
            received_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', returnId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Return received');
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: 'return_received',
                entityType: 'return_request',
                entityId: returnId,
            });
        }
        return data;
    },
    async inspectReturn(returnId, input) {
        const row = await this.get(returnId);
        const commerceOrderId = String(row.commerce_order_id);
        await inventoryService.processReturnStock({
            commerceOrderId,
            stockAction: input.stockAction,
            lines: row.lines ?? [],
            actorEmail: input.inspectedBy,
        });
        const { data, error } = await supabase
            .from('return_requests')
            .update({
            status: 'inspected',
            product_condition: input.productCondition,
            inspection_notes: input.inspectionNotes ?? null,
            stock_action: input.stockAction,
            updated_at: new Date().toISOString(),
        })
            .eq('id', returnId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Return inspection');
        if (input.inspectedBy) {
            await employeeActionLogService.log({
                actorEmail: input.inspectedBy,
                actionType: 'return_inspected',
                entityType: 'return_request',
                entityId: returnId,
                details: {
                    productCondition: input.productCondition,
                    stockAction: input.stockAction,
                },
            });
        }
        return data;
    },
    async processRefund(returnId, actorEmail) {
        const row = await this.get(returnId);
        if (!row.refund_type || row.refund_type === 'none') {
            throw new AppError('No refund configured for this return', 400, 'NO_REFUND');
        }
        const creditNote = await invoiceService.generateCreditNote(String(row.commerce_order_id), Number(row.refund_amount) || 0, `Return ${row.return_number}`);
        const { data, error } = await supabase
            .from('return_requests')
            .update({
            status: 'refund_completed',
            credit_note_id: creditNote.id,
            updated_at: new Date().toISOString(),
        })
            .eq('id', returnId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Refund processing');
        await omsWorkflowService.updateStatus(String(row.commerce_order_id), 'returned');
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: 'refund_completed',
                entityType: 'return_request',
                entityId: returnId,
                details: { creditNoteId: creditNote.id, amount: row.refund_amount },
            });
        }
        return { returnRequest: data, creditNote };
    },
    async patchStatus(returnId, status, actorEmail, actionType) {
        const { data, error } = await supabase
            .from('return_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', returnId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Return status');
        if (actorEmail && actionType) {
            await employeeActionLogService.log({
                actorEmail,
                actionType,
                entityType: 'return_request',
                entityId: returnId,
                details: { status },
            });
        }
        return data;
    },
};
//# sourceMappingURL=return-workflow.service.js.map