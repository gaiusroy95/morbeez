import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { pricingConfigService } from './pricing-config.service.js';
export const bulkMarginReviewService = {
    async isApprovedForQuote(quoteId) {
        const { data } = await supabase
            .from('bulk_margin_review_requests')
            .select('status')
            .eq('commerce_quote_id', quoteId)
            .eq('status', 'approved')
            .maybeSingle();
        return Boolean(data);
    },
    async createRequest(input) {
        const config = await pricingConfigService.getConfig();
        const { data, error } = await supabase
            .from('bulk_margin_review_requests')
            .upsert({
            commerce_quote_id: input.quoteId,
            lead_id: input.leadId ?? null,
            admin_user_id: input.adminUserId ?? null,
            employee_profile_id: input.employeeProfileId ?? null,
            order_value_inr: input.orderValueInr,
            gross_profit_inr: input.grossProfitInr,
            gross_margin_pct: input.grossMarginPct,
            min_required_pct: config.bulkMinGrossMarginPct,
            status: 'pending',
            requested_by_name: input.requestedByName ?? null,
            reviewed_by: null,
            reviewed_at: null,
            review_notes: null,
        }, { onConflict: 'commerce_quote_id' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create bulk margin review');
        await supabase
            .from('commerce_quotes')
            .update({ bulk_margin_review_status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', input.quoteId);
        return data;
    },
    async approve(reviewId, reviewerId, notes) {
        const { data, error } = await supabase
            .from('bulk_margin_review_requests')
            .update({
            status: 'approved',
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            review_notes: notes ?? null,
        })
            .eq('id', reviewId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Approve bulk review');
        if (!data)
            throw new NotFoundError('Review not found');
        await supabase
            .from('commerce_quotes')
            .update({ bulk_margin_review_status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', data.commerce_quote_id);
        return data;
    },
    async reject(reviewId, reviewerId, notes) {
        const { data, error } = await supabase
            .from('bulk_margin_review_requests')
            .update({
            status: 'rejected',
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            review_notes: notes ?? null,
        })
            .eq('id', reviewId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Reject bulk review');
        if (!data)
            throw new NotFoundError('Review not found');
        await supabase
            .from('commerce_quotes')
            .update({ bulk_margin_review_status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', data.commerce_quote_id);
        return data;
    },
    async listPending(limit = 50) {
        const { data, error } = await supabase
            .from('bulk_margin_review_requests')
            .select('*, employee_profiles(full_name, employee_code), commerce_quotes(quote_number, customer_name, total)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'List pending bulk reviews');
        return data ?? [];
    },
};
//# sourceMappingURL=bulk-margin-review.service.js.map