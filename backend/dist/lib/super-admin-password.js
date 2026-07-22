import { z } from 'zod';
import { UnauthorizedError } from './errors.js';
import { verifyPassword } from './password.js';
import { supabase } from './supabase.js';
import { throwIfSupabaseError } from './supabase-errors.js';
export const confirmPasswordSchema = z.string().min(8).max(128);
export async function assertSuperAdminPasswordConfirm(actor, confirmPassword) {
    if (actor.role !== 'super_admin') {
        throw new UnauthorizedError('Super admin role required for edit or delete');
    }
    await assertAdminPasswordConfirm(actor, confirmPassword);
}
/** Verify the signed-in staff user's password (any active admin role). */
export async function assertAdminPasswordConfirm(actor, confirmPassword) {
    const password = confirmPassword?.trim();
    if (!password) {
        throw new UnauthorizedError('Password confirmation required');
    }
    const { data: row, error } = await supabase
        .from('admin_users')
        .select('password_hash')
        .eq('id', actor.id)
        .eq('active', true)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not verify admin credentials');
    if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
        throw new UnauthorizedError('Password confirmation failed');
    }
}
export function extractConfirmPassword(body) {
    return confirmPasswordSchema.parse(body.confirmPassword);
}
//# sourceMappingURL=super-admin-password.js.map