import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';

export function tenDigitPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

function profilePhoneMatches(profile: Record<string, unknown>, ten: string): boolean {
  for (const field of ['personal_mobile', 'company_whatsapp', 'alternate_mobile']) {
    const value = profile[field];
    if (value && tenDigitPhone(String(value)) === ten) return true;
  }
  return false;
}

export async function findActiveAdminByPhone(phoneRaw: string) {
  const ten = tenDigitPhone(phoneRaw);
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) {
    throw new ValidationError('Enter a valid 10-digit Indian mobile number');
  }

  const { data: profiles, error } = await supabase
    .from('employee_profiles')
    .select('admin_user_id, status, personal_mobile, company_whatsapp, alternate_mobile')
    .eq('status', 'active')
    .not('admin_user_id', 'is', null);
  throwIfSupabaseError(error, 'Could not load employee profiles');

  const profile = (profiles ?? []).find((row) => profilePhoneMatches(row as Record<string, unknown>, ten));
  if (!profile?.admin_user_id) {
    throw new UnauthorizedError(
      'No staff account is linked to this mobile number. Ask your manager to add it in HR.'
    );
  }

  const { data: admin, error: adminErr } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', profile.admin_user_id)
    .maybeSingle();
  throwIfSupabaseError(adminErr, 'Could not load staff account');

  if (!admin?.active) throw new UnauthorizedError('Staff account is inactive');
  if (!admin.email_verified_at && admin.role !== 'super_admin') {
    throw new UnauthorizedError('Complete email verification using your invitation link');
  }

  return admin;
}
