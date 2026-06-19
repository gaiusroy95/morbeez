import { supabase } from '../../lib/supabase.js';
export const executionVerificationService = {
    async verify(params) {
        const checks = [];
        let score = 0;
        if (params.recommendationRecordId) {
            const { data: rec } = await supabase
                .from('recommendation_records')
                .select('dosage, recommendation_text, status')
                .eq('id', params.recommendationRecordId)
                .maybeSingle();
            if (rec?.dosage) {
                checks.push('dosage_documented');
                score += 25;
            }
            if (rec?.recommendation_text) {
                checks.push('recommendation_text_present');
                score += 15;
            }
        }
        const { data: apps } = await supabase
            .from('recommendation_applications')
            .select('id, applied_at, dosage')
            .eq('farmer_id', params.farmerId)
            .order('applied_at', { ascending: false })
            .limit(3);
        if (apps?.length) {
            checks.push('application_logged');
            score += 35;
            if (apps.some((a) => a.dosage)) {
                checks.push('application_dosage_recorded');
                score += 25;
            }
        }
        return { score: Math.min(100, score), checks };
    },
};
//# sourceMappingURL=execution-verification.service.js.map