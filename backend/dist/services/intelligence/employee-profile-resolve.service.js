import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
/**
 * Resolve staff actor to employee_profiles.id (Phase 0 convention).
 * Falls back to email match when only admin email is known (CRM assigned_to).
 */
export const employeeProfileResolveService = {
    async byAdminUserId(adminUserId) {
        const { data, error } = await supabase
            .from('employee_profiles')
            .select('id')
            .eq('admin_user_id', adminUserId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not resolve employee profile');
        return data?.id ? String(data.id) : null;
    },
    async byEmail(email) {
        const normalized = email.trim().toLowerCase();
        if (!normalized)
            return null;
        const { data: byProfile, error: profileErr } = await supabase
            .from('employee_profiles')
            .select('id, admin_user_id')
            .eq('email', normalized)
            .maybeSingle();
        throwIfSupabaseError(profileErr, 'Could not resolve employee by email');
        if (byProfile?.id)
            return String(byProfile.id);
        const { data: admin, error: adminErr } = await supabase
            .from('admin_users')
            .select('id')
            .eq('email', normalized)
            .maybeSingle();
        throwIfSupabaseError(adminErr, 'Could not resolve admin by email');
        if (!admin?.id)
            return null;
        return this.byAdminUserId(String(admin.id));
    },
    async resolve(input) {
        if (input.employeeProfileId)
            return input.employeeProfileId;
        if (input.adminUserId)
            return this.byAdminUserId(input.adminUserId);
        if (input.employeeEmail)
            return this.byEmail(input.employeeEmail);
        return null;
    },
};
//# sourceMappingURL=employee-profile-resolve.service.js.map