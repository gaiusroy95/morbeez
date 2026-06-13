import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';

export const partnerEventsService = {
  async list(partnerId?: string) {
    let q = supabase.from('partner_events').select('*').order('starts_at', { ascending: false });
    if (partnerId) q = q.eq('partner_id', partnerId);
    const { data, error } = await q.limit(100);
    throwIfSupabaseError(error, 'Could not list partner events');
    return data ?? [];
  },

  async create(input: {
    partnerId: string;
    eventCode: string;
    name: string;
    crop?: string;
    district?: string;
    startsAt: string;
    endsAt?: string;
  }) {
    const { data, error } = await supabase
      .from('partner_events')
      .insert({
        partner_id: input.partnerId,
        event_code: input.eventCode.trim(),
        name: input.name.trim(),
        crop: input.crop ?? null,
        district: input.district ?? null,
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        status: 'pending',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create partner event');
    return data;
  },

  async approve(id: string, adminEmail: string) {
    const { data, error } = await supabase
      .from('partner_events')
      .update({ status: 'approved', approved_by: adminEmail, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not approve event');
    if (!data) throw new NotFoundError('Event not found');
    return data;
  },
};

export const partnerTerritoryService = {
  async listForPartner(partnerId: string) {
    const { data, error } = await supabase
      .from('partner_territory_pincodes')
      .select('*')
      .eq('partner_id', partnerId)
      .order('is_primary', { ascending: false });
    throwIfSupabaseError(error, 'Could not list territory pincodes');
    return data ?? [];
  },

  async upsertPincode(partnerId: string, pincode: string, isPrimary = false) {
    const { data, error } = await supabase
      .from('partner_territory_pincodes')
      .upsert(
        {
          partner_id: partnerId,
          pincode: pincode.trim(),
          is_primary: isPrimary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'partner_id,pincode' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not save territory pincode');
    return data;
  },

  async partnerIdsForPincode(pincode: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('partner_territory_pincodes')
      .select('partner_id')
      .eq('pincode', pincode.trim());
    throwIfSupabaseError(error, 'Could not load territory partners');
    return (data ?? []).map((r) => String(r.partner_id));
  },
};
