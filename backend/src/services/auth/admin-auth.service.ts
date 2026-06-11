import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';
import { createAdminToken } from '../../lib/admin-jwt.js';
import { isValidIndianPhone } from '../../lib/phone.js';
import { findActiveAdminByPhone } from './staff-phone-lookup.js';

export interface AdminLoginInput {
  phone?: string;
  email?: string;
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicAdmin(row: Record<string, unknown>) {
  return {
    id: row.id,
    email: row.email ? String(row.email) : undefined,
    fullName: row.full_name,
    role: row.role,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export const adminAuthService = {
  async login(input: AdminLoginInput) {
    if (!input.password) throw new ValidationError('Password is required');

    let data: Record<string, unknown>;

    if (input.phone?.trim()) {
      if (!isValidIndianPhone(input.phone)) {
        throw new ValidationError('Enter a valid 10-digit mobile number');
      }
      data = await findActiveAdminByPhone(input.phone);
      if (!data.password_hash) throw new UnauthorizedError('Invalid mobile number or password');
      if (input.email?.trim()) {
        const email = normalizeEmail(input.email);
        if (data.email && normalizeEmail(String(data.email)) !== email) {
          throw new UnauthorizedError('Invalid mobile number or password');
        }
      }
    } else if (input.email?.trim()) {
      const email = normalizeEmail(input.email);
      const { data: row, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      throwIfSupabaseError(error, 'Could not load admin account');
      if (!row?.password_hash) throw new UnauthorizedError('Invalid email or password');
      if (!row.active) {
        if (!row.email_verified_at) {
          throw new UnauthorizedError(
            'Activate your account using the invitation link sent to your email'
          );
        }
        throw new UnauthorizedError('Account is inactive');
      }
      if (!row.email_verified_at && row.role !== 'super_admin') {
        throw new UnauthorizedError('Complete email verification using your invitation link');
      }
      data = row;
    } else {
      throw new ValidationError('Mobile number is required');
    }

    if (!verifyPassword(input.password, String(data.password_hash))) {
      throw new UnauthorizedError(input.phone ? 'Invalid mobile number or password' : 'Invalid email or password');
    }

    const now = new Date().toISOString();
    await supabase.from('admin_users').update({ last_login_at: now, updated_at: now }).eq('id', data.id);

    const email = String(data.email ?? '');
    const token = createAdminToken(String(data.id), email, String(data.role));
    return { token, admin: publicAdmin({ ...data, last_login_at: now }) };
  },

  async me(adminId: string) {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', adminId)
      .eq('active', true)
      .single();

    if (error || !data) throw new UnauthorizedError('Session invalid');
    return publicAdmin(data);
  },
};
