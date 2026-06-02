import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { canApproveRecommendations } from '../../lib/console-roles.js';
export const agronomistTierService = {
    async getTierForAdmin(adminUserId, email) {
        const normalizedEmail = email.trim().toLowerCase();
        const { data: byAdmin, error: adminErr } = await supabase
            .from('employee_profiles')
            .select('agronomist_tier, role')
            .eq('admin_user_id', adminUserId)
            .maybeSingle();
        throwIfSupabaseError(adminErr, 'Could not load agronomist profile');
        if (byAdmin?.role === 'agronomist') {
            return normalizeTier(byAdmin.agronomist_tier);
        }
        if (normalizedEmail) {
            const { data: byEmail, error: emailErr } = await supabase
                .from('employee_profiles')
                .select('agronomist_tier, role')
                .eq('email', normalizedEmail)
                .maybeSingle();
            throwIfSupabaseError(emailErr, 'Could not load agronomist profile');
            if (byEmail?.role === 'agronomist') {
                return normalizeTier(byEmail.agronomist_tier);
            }
        }
        return null;
    },
    async canSelfApproveRecommendations(adminUserId, email, role) {
        if (role !== 'agronomist')
            return false;
        if (canApproveRecommendations(role))
            return false;
        const tier = await this.getTierForAdmin(adminUserId, email);
        return tier === 'experienced';
    },
    async assertOwnRecommendation(recommendationId, editorEmail) {
        const { data, error } = await supabase
            .from('recommendation_records')
            .select('created_by')
            .eq('id', recommendationId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load recommendation');
        const creator = data?.created_by ? String(data.created_by).toLowerCase() : '';
        if (creator !== editorEmail.trim().toLowerCase()) {
            const { AppError } = await import('../../lib/errors.js');
            throw new AppError('You can only approve your own submissions', 403, 'FORBIDDEN');
        }
    },
};
function normalizeTier(raw) {
    return raw === 'experienced' ? 'experienced' : 'new';
}
//# sourceMappingURL=agronomist-tier.service.js.map