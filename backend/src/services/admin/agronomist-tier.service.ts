import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { canApproveRecommendations } from '../../lib/console-roles.js';
import { logger } from '../../lib/logger.js';

export type AgronomistTier = 'new' | 'experienced';

function isMissingAgronomistTierColumn(error: PostgrestError | null): boolean {
  const msg = error?.message ?? '';
  return (
    error?.code === 'PGRST204' ||
    (msg.includes('agronomist_tier') && msg.includes('does not exist'))
  );
}

async function loadProfileRole(
  filter: { column: 'admin_user_id' | 'email'; value: string },
  includeTier: boolean
): Promise<{ role: string | null; agronomistTier: unknown } | null> {
  const select = includeTier ? 'agronomist_tier, role' : 'role';
  const { data, error } = await supabase
    .from('employee_profiles')
    .select(select)
    .eq(filter.column, filter.value)
    .maybeSingle();

  if (error && isMissingAgronomistTierColumn(error) && includeTier) {
    return loadProfileRole(filter, false);
  }
  throwIfSupabaseError(error, 'Could not load agronomist profile');
  if (!data) return null;
  const row = data as { role?: string; agronomist_tier?: unknown };
  return { role: row.role ?? null, agronomistTier: row.agronomist_tier };
}

export const agronomistTierService = {
  async getTierForAdmin(adminUserId: string, email: string): Promise<AgronomistTier | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const byAdmin = await loadProfileRole(
      { column: 'admin_user_id', value: adminUserId },
      true
    );
    if (byAdmin?.role === 'agronomist') {
      if (byAdmin.agronomistTier === undefined) {
        logger.warn('employee_profiles.agronomist_tier missing — run supabase migration 20260636000000');
        return 'new';
      }
      return normalizeTier(byAdmin.agronomistTier);
    }

    if (normalizedEmail) {
      const byEmail = await loadProfileRole(
        { column: 'email', value: normalizedEmail },
        true
      );
      if (byEmail?.role === 'agronomist') {
        if (byEmail.agronomistTier === undefined) return 'new';
        return normalizeTier(byEmail.agronomistTier);
      }
    }

    return null;
  },

  async canSelfApproveRecommendations(
    adminUserId: string,
    email: string,
    role: string
  ): Promise<boolean> {
    if (role !== 'agronomist') return false;
    if (canApproveRecommendations(role)) return false;
    const tier = await this.getTierForAdmin(adminUserId, email);
    return tier === 'experienced';
  },

  async assertOwnRecommendation(recommendationId: string, editorEmail: string): Promise<void> {
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

function normalizeTier(raw: unknown): AgronomistTier {
  return raw === 'experienced' ? 'experienced' : 'new';
}
