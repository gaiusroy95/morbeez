import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
/** Batch load retention rows (PostgREST cannot embed farmer_scores ↔ farmer_retention_tracking). */
export async function fetchRetentionByFarmerIds(farmerIds) {
    const map = new Map();
    const ids = [...new Set(farmerIds.filter(Boolean))];
    if (!ids.length)
        return map;
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from('farmer_retention_tracking')
            .select('farmer_id, risk_band, days_since_last_inbound, retention_score')
            .in('farmer_id', chunk);
        throwIfSupabaseError(error, 'Could not load farmer retention');
        for (const row of data ?? []) {
            map.set(String(row.farmer_id), {
                riskBand: String(row.risk_band),
                daysSinceLastInbound: row.days_since_last_inbound != null ? Number(row.days_since_last_inbound) : null,
                retentionScore: row.retention_score != null ? Number(row.retention_score) : null,
            });
        }
    }
    return map;
}
/** Batch load opportunity scores by farmer id. */
export async function fetchOpportunityScoresByFarmerIds(farmerIds) {
    const map = new Map();
    const ids = [...new Set(farmerIds.filter(Boolean))];
    if (!ids.length)
        return map;
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from('farmer_scores')
            .select('farmer_id, opportunity_score')
            .in('farmer_id', chunk);
        throwIfSupabaseError(error, 'Could not load farmer scores');
        for (const row of data ?? []) {
            map.set(String(row.farmer_id), Number(row.opportunity_score));
        }
    }
    return map;
}
//# sourceMappingURL=intelligence-farmer-score-queries.util.js.map