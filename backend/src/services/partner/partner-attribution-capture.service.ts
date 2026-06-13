import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import type { PartnerAttributionType } from './partner.types.js';

export const partnerAttributionCaptureService = {
  async upsertTouch(input: {
    farmerId: string;
    partnerId: string;
    attributionType: PartnerAttributionType;
    weight?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('partner_farmer_attribution')
      .select('id, touch_count')
      .eq('farmer_id', input.farmerId)
      .eq('partner_id', input.partnerId)
      .eq('attribution_type', input.attributionType)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('partner_farmer_attribution')
        .update({
          last_touch_at: now,
          touch_count: (existing.touch_count ?? 0) + 1,
          metadata: input.metadata ?? {},
          active: true,
          updated_at: now,
        })
        .eq('id', existing.id);
      throwIfSupabaseError(error, 'Could not update partner attribution');
      return;
    }

    const { error } = await supabase.from('partner_farmer_attribution').insert({
      farmer_id: input.farmerId,
      partner_id: input.partnerId,
      attribution_type: input.attributionType,
      weight: input.weight ?? 1,
      metadata: input.metadata ?? {},
    });
    throwIfSupabaseError(error, 'Could not create partner attribution');
  },

  async trackEnrollment(farmerId: string, partnerId: string, source: string): Promise<void> {
    await this.upsertTouch({
      farmerId,
      partnerId,
      attributionType: 'enrollment',
      metadata: { source },
    });
  },

  async trackVisit(farmerId: string, partnerId: string, findingId?: string): Promise<void> {
    await this.upsertTouch({
      farmerId,
      partnerId,
      attributionType: 'visit',
      metadata: findingId ? { fieldFindingId: findingId } : {},
    });
  },

  async listForFarmer(farmerId: string) {
    const { data, error } = await supabase
      .from('partner_farmer_attribution')
      .select('*, partners(partner_code, full_name)')
      .eq('farmer_id', farmerId)
      .eq('active', true)
      .order('last_touch_at', { ascending: false });
    throwIfSupabaseError(error, 'Could not list partner attributions');
    return data ?? [];
  },
};
