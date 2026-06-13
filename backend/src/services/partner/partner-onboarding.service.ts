import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { partnerService } from './partner.service.js';

export const partnerOnboardingService = {
  async submitApplication(input: {
    fullName: string;
    phone: string;
    email?: string;
    state?: string;
    district?: string;
    village?: string;
    languages?: string[];
    experienceNotes?: string;
  }) {
    const { data, error } = await supabase
      .from('partner_applications')
      .insert({
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        state: input.state ?? null,
        district: input.district ?? null,
        village: input.village ?? null,
        languages: input.languages ?? [],
        experience_notes: input.experienceNotes ?? null,
        status: 'pending',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not submit application');
    return data;
  },

  async listApplications(status?: string) {
    let q = supabase
      .from('partner_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q.limit(200);
    throwIfSupabaseError(error, 'Could not list applications');
    return data ?? [];
  },

  async approveApplication(applicationId: string, adminEmail: string) {
    const { data: app, error } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    throwIfSupabaseError(error, 'Could not load application');
    if (!app) throw new NotFoundError('Application not found');

    const partner = await partnerService.createFromApplication({
      fullName: String(app.full_name),
      phone: String(app.phone),
      email: app.email ? String(app.email) : null,
      state: app.state ? String(app.state) : null,
      district: app.district ? String(app.district) : null,
      village: app.village ? String(app.village) : null,
      languages: (app.languages as string[]) ?? [],
      changedBy: adminEmail,
    });

    await supabase
      .from('partner_applications')
      .update({
        status: 'approved',
        partner_id: partner.id,
        reviewed_by: adminEmail,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    return partner;
  },

  async rejectApplication(applicationId: string, adminEmail: string, notes?: string) {
    const { data, error } = await supabase
      .from('partner_applications')
      .update({
        status: 'rejected',
        reviewed_by: adminEmail,
        reviewed_at: new Date().toISOString(),
        review_notes: notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not reject application');
    return data;
  },

  async advanceStage(applicationId: string, stage: string, adminEmail: string, notes?: string) {
    const { data, error } = await supabase
      .from('partner_applications')
      .update({
        onboarding_stage: stage,
        review_notes: notes ?? null,
        reviewed_by: adminEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not advance onboarding stage');
    if (!data) throw new NotFoundError('Application not found');
    return data;
  },
};
