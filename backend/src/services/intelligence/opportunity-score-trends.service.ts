import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export type ScoreTrendPoint = {
  calculatedAt: string;
  totalScore: number;
  components: Record<string, number>;
};

export const opportunityScoreTrendsService = {
  async getFarmerTrend(farmerId: string, limit = 12): Promise<ScoreTrendPoint[]> {
    const { data, error } = await supabase
      .from('farmer_score_history')
      .select('calculated_at, opportunity_score, components')
      .eq('farmer_id', farmerId)
      .order('calculated_at', { ascending: false })
      .limit(Math.min(limit, 52));

    throwIfSupabaseError(error, 'Could not load farmer score trend');

    return (data ?? [])
      .map((row) => ({
        calculatedAt: String(row.calculated_at),
        totalScore: Number(row.opportunity_score),
        components: (row.components as Record<string, number>) ?? {},
      }))
      .reverse();
  },

  async getEmployeeTrend(employeeProfileId: string, limit = 12): Promise<ScoreTrendPoint[]> {
    const { data, error } = await supabase
      .from('employee_score_history')
      .select('calculated_at, performance_score, components')
      .eq('employee_profile_id', employeeProfileId)
      .order('calculated_at', { ascending: false })
      .limit(Math.min(limit, 52));

    throwIfSupabaseError(error, 'Could not load employee score trend');

    return (data ?? [])
      .map((row) => ({
        calculatedAt: String(row.calculated_at),
        totalScore: Number(row.performance_score),
        components: (row.components as Record<string, number>) ?? {},
      }))
      .reverse();
  },
};
