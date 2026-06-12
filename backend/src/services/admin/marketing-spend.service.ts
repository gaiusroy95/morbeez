import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export const marketingSpendService = {
  async getMonthTotal(monthYear: string): Promise<number> {
    const { data, error } = await supabase
      .from('marketing_spend_entries')
      .select('amount_inr')
      .eq('month_year', monthYear);
    throwIfSupabaseError(error, 'Load marketing spend');
    return (data ?? []).reduce((s, r) => s + Number(r.amount_inr), 0);
  },

  async listByMonth(monthYear: string) {
    const { data, error } = await supabase
      .from('marketing_spend_entries')
      .select('*')
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false });
    throwIfSupabaseError(error, 'List marketing spend');
    return data ?? [];
  },

  async addEntry(input: {
    monthYear: string;
    channel: string;
    amountInr: number;
    notes?: string;
    recordedBy?: string;
    campaignName?: string;
    marketingOwnerId?: string | null;
    spendDate?: string;
  }) {
    const { data, error } = await supabase
      .from('marketing_spend_entries')
      .insert({
        month_year: input.monthYear,
        channel: input.channel,
        amount_inr: input.amountInr,
        notes: input.notes ?? null,
        recorded_by: input.recordedBy ?? null,
        campaign_name: input.campaignName ?? null,
        marketing_owner_id: input.marketingOwnerId ?? null,
        spend_date: input.spendDate ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Add marketing spend');
    return data;
  },

  async listByDateRange(from: string, to: string) {
    const { data, error } = await supabase
      .from('marketing_spend_entries')
      .select('*')
      .gte('spend_date', from)
      .lte('spend_date', to)
      .order('spend_date', { ascending: false });
    throwIfSupabaseError(error, 'List marketing spend by date');
    return data ?? [];
  },

  async listIncentiveRules() {
    const { data, error } = await supabase
      .from('marketing_incentive_rules')
      .select('*')
      .order('updated_at', { ascending: false });
    throwIfSupabaseError(error, 'List incentive rules');
    return data ?? [];
  },

  async updateIncentiveRule(
    id: string,
    patch: {
      flatConnectedInr?: number;
      flatBookedInr?: number;
      flatPaidInr?: number;
      monthlyCapInr?: number | null;
      isActive?: boolean;
    }
  ) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.flatConnectedInr !== undefined) updates.flat_connected_inr = patch.flatConnectedInr;
    if (patch.flatBookedInr !== undefined) updates.flat_booked_inr = patch.flatBookedInr;
    if (patch.flatPaidInr !== undefined) updates.flat_paid_inr = patch.flatPaidInr;
    if (patch.monthlyCapInr !== undefined) updates.monthly_cap_inr = patch.monthlyCapInr;
    if (patch.isActive !== undefined) updates.is_active = patch.isActive;

    const { data, error } = await supabase
      .from('marketing_incentive_rules')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Update incentive rule');
    return data;
  },
};
