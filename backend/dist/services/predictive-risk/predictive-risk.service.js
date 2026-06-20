import { supabase } from '../../lib/supabase.js';
import { regionalLearningService } from '../regional-learning/regional-learning.service.js';
export const predictiveRiskService = {
    async scoreBlock(params) {
        const w = params.contextPack?.weatherRiskScore ?? 30;
        let regionalBoost = 0;
        if (params.regionalClusterKey && params.cropType) {
            const district = params.regionalClusterKey.split(':')[1] ?? '';
            const priors = await regionalLearningService.topIssuePriors(params.cropType, district);
            regionalBoost = Math.min(20, priors.reduce((s, p) => s + p.caseCount, 0));
        }
        let stressBoost = 0;
        if (params.blockId) {
            const { count } = await supabase
                .from('block_stress_flags')
                .select('id', { count: 'exact', head: true })
                .eq('block_id', params.blockId)
                .gte('score', 60);
            stressBoost = Math.min(15, (count ?? 0) * 5);
        }
        const base = Math.min(100, Math.max(0, w));
        const disease = Math.min(100, base + (params.contextPack?.highHumidityLikely ? 20 : 0) + (params.riskTagCount ?? 0) * 5 + regionalBoost);
        const pest = Math.min(100, base * 0.7 + (params.contextPack?.highHeatLikely ? 15 : 0) + stressBoost);
        const nutrient = Math.min(100, 35 + (params.riskTagCount ?? 0) * 8);
        const irrigation = Math.min(100, (params.contextPack?.heavyRainLikely ? 70 : 25) +
            (params.contextPack?.drainageRisk === 'high' ? 25 : 0));
        const weather = Math.min(100, base + stressBoost);
        return { disease, pest, nutrient, irrigation, weather };
    },
};
//# sourceMappingURL=predictive-risk.service.js.map