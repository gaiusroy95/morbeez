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
  }) {
    const { data, error } = await supabase
      .from('marketing_spend_entries')
      .insert({
        month_year: input.monthYear,
        channel: input.channel,
        amount_inr: input.amountInr,
        notes: input.notes ?? null,
        recorded_by: input.recordedBy ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Add marketing spend');
    return data;
  },
};
