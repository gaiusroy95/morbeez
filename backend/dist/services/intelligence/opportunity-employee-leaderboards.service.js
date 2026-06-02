import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD } from './employee-performance-scoring.util.js';
export const opportunityEmployeeLeaderboardsService = {
    async listTopRelationshipBuilders(limit = 25) {
        const { data, error } = await supabase
            .from('employee_scores')
            .select('employee_profile_id, performance_score, relationship_quality_score, attributed_farmer_count, calculated_at, employee_profiles(full_name, email, role)')
            .gte('attributed_farmer_count', MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD)
            .order('relationship_quality_score', { ascending: false })
            .order('performance_score', { ascending: false })
            .limit(Math.min(limit, 100));
        throwIfSupabaseError(error, 'Could not load relationship builders');
        return mapRows(data ?? [], 'relationship_quality_score');
    },
    async listHighRetentionEmployees(limit = 25) {
        const { data, error } = await supabase
            .from('employee_scores')
            .select('employee_profile_id, performance_score, retention_quality_score, attributed_farmer_count, calculated_at, employee_profiles(full_name, email, role)')
            .gte('attributed_farmer_count', MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD)
            .order('retention_quality_score', { ascending: false })
            .order('performance_score', { ascending: false })
            .limit(Math.min(limit, 100));
        throwIfSupabaseError(error, 'Could not load high-retention employees');
        return mapRows(data ?? [], 'retention_quality_score');
    },
};
function mapRows(data, specialtyField) {
    return data.map((row) => {
        const prof = row.employee_profiles;
        return {
            employeeProfileId: String(row.employee_profile_id),
            performanceScore: Number(row.performance_score),
            specialtyScore: Number(row[specialtyField]),
            attributedFarmerCount: Number(row.attributed_farmer_count ?? 0),
            fullName: prof?.full_name ? String(prof.full_name) : null,
            email: prof?.email ? String(prof.email) : null,
            role: prof?.role ? String(prof.role) : null,
            calculatedAt: String(row.calculated_at),
        };
    });
}
//# sourceMappingURL=opportunity-employee-leaderboards.service.js.map