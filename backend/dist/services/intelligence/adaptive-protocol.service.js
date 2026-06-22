import { supabase } from '../../lib/supabase.js';
import { failureAnalysisService } from '../case/failure-analysis.service.js';
import { regionalLearningService } from '../regional-learning/regional-learning.service.js';
export const adaptiveProtocolService = {
    async suggestOnWorseOutcome(input) {
        const failureType = failureAnalysisService.classify({
            outcomeStatus: input.outcomeStatus,
            agronomistCorrected: input.agronomistCorrected,
            applicationLogged: input.applicationLogged,
            fusedConfidence: input.fusedConfidence,
        });
        if (!failureType)
            return null;
        const alternateTemplates = await regionalLearningService
            .rankTemplates(input.cropType, input.district, input.issueLabel)
            .catch(() => []);
        return {
            failureType,
            issueLabel: input.issueLabel,
            cropType: input.cropType,
            district: input.district,
            alternateTemplates: alternateTemplates.slice(0, 5).map((t) => ({
                templateKey: String(t.protocolKey),
                label: String(t.protocolKey),
                score: Number(t.successRate ?? 0),
            })),
        };
    },
    async listRecentSuggestions(limit = 20) {
        const { data } = await supabase
            .from('recommendation_records')
            .select('issue_detected, outcome, crop_type, farmers(district)')
            .eq('outcome', 'no_improvement')
            .order('outcome_at', { ascending: false })
            .limit(limit);
        const results = [];
        for (const row of data ?? []) {
            const farmerRaw = row.farmers;
            const farmer = (Array.isArray(farmerRaw) ? farmerRaw[0] : farmerRaw);
            const suggestion = await this.suggestOnWorseOutcome({
                issueLabel: String(row.issue_detected ?? 'issue'),
                cropType: String(row.crop_type ?? 'ginger'),
                district: String(farmer?.district ?? 'Unknown'),
                outcomeStatus: 'worse',
                applicationLogged: true,
            });
            if (suggestion)
                results.push(suggestion);
        }
        return results;
    },
};
//# sourceMappingURL=adaptive-protocol.service.js.map