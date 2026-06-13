import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

const ONBOARDING_STAGES = [
  'application',
  'screening',
  'interview',
  'training',
  'certification',
  'trial',
  'active',
] as const;

export const partnerTrainingService = {
  onboardingStages: ONBOARDING_STAGES,

  async listModules() {
    const { data, error } = await supabase
      .from('partner_training_modules')
      .select('*')
      .order('sort_order', { ascending: true });
    throwIfSupabaseError(error, 'Could not list training modules');
    return data ?? [];
  },

  async getProgress(partnerId: string) {
    const { data, error } = await supabase
      .from('partner_training_progress')
      .select('*, partner_training_modules(title, sort_order)')
      .eq('partner_id', partnerId);
    throwIfSupabaseError(error, 'Could not load training progress');
    return data ?? [];
  },

  async recordModuleComplete(partnerId: string, moduleId: string) {
    const { data, error } = await supabase
      .from('partner_training_progress')
      .upsert(
        {
          partner_id: partnerId,
          module_id: moduleId,
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'partner_id,module_id' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record module progress');
    return data;
  },

  async listCertificationAttempts(partnerId: string) {
    const { data, error } = await supabase
      .from('partner_certification_attempts')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(20);
    throwIfSupabaseError(error, 'Could not list certification attempts');
    return data ?? [];
  },

  async recordCertificationAttempt(
    partnerId: string,
    score: number,
    passed: boolean,
    attemptType: 'online' | 'field' = 'online'
  ) {
    const { data, error } = await supabase
      .from('partner_certification_attempts')
      .insert({
        partner_id: partnerId,
        attempt_type: attemptType,
        score,
        passed,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record certification attempt');
    return data;
  },
};
