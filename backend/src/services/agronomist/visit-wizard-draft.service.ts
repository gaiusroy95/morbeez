import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';

export type VisitWizardDraftPhotoRef = {
  storagePath: string;
  photoType: string;
  mimeType: string;
  filename?: string;
};

export type UpsertVisitWizardDraftInput = {
  sessionId: string;
  farmerId: string;
  blockId?: string | null;
  agronomistEmail: string;
  currentStep: string;
  wizardVersion?: string;
  payload: Record<string, unknown>;
  photoRefs?: VisitWizardDraftPhotoRef[];
};

export const visitWizardDraftService = {
  async upsert(input: UpsertVisitWizardDraftInput) {
    const email = input.agronomistEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('visit_wizard_drafts')
      .upsert(
        {
          session_id: input.sessionId,
          farmer_id: input.farmerId,
          block_id: input.blockId ?? null,
          agronomist_email: email,
          current_step: input.currentStep,
          wizard_version: input.wizardVersion ?? 'v12',
          payload: input.payload,
          photo_refs: input.photoRefs ?? [],
          status: 'draft',
          saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not save visit draft');
    return data;
  },

  async getBySessionId(sessionId: string) {
    const { data, error } = await supabase
      .from('visit_wizard_drafts')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'draft')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load visit draft');
    return data;
  },

  async listByAgent(agronomistEmail: string, limit = 20) {
    const email = agronomistEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('visit_wizard_drafts')
      .select(
        `id, session_id, farmer_id, block_id, current_step, wizard_version, updated_at, saved_at,
         farmers(id, name, phone),
         farm_blocks(id, name, crop_type)`
      )
      .eq('agronomist_email', email)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not list visit drafts');
    return data ?? [];
  },

  async markSubmitted(sessionId: string) {
    const { error } = await supabase
      .from('visit_wizard_drafts')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('session_id', sessionId);
    throwIfSupabaseError(error, 'Could not finalize visit draft');
  },

  async deleteBySessionId(sessionId: string) {
    const { error } = await supabase.from('visit_wizard_drafts').delete().eq('session_id', sessionId);
    throwIfSupabaseError(error, 'Could not delete visit draft');
  },

  async assertSessionOwner(sessionId: string, agronomistEmail: string) {
    const { data, error } = await supabase
      .from('agronomist_visit_sessions')
      .select('id, agronomist_email')
      .eq('id', sessionId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load session');
    if (!data) throw new NotFoundError('Visit session not found');
    if (String(data.agronomist_email).toLowerCase() !== agronomistEmail.trim().toLowerCase()) {
      throw new NotFoundError('Visit session not found');
    }
    return data;
  },
};
