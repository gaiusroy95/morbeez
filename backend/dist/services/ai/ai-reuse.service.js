import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { aiLogService } from './ai-log.service.js';
import { recommendationService } from './recommendation.service.js';
import { normalizeStructuredAdvisory } from './advisory-normalize.js';
import { blockService } from '../core/block.service.js';
import { buildCrossLanguageIntentSlug, pickLocalizedFarmerSummary, } from '../whatsapp/pipeline/crop-message-intent.service.js';
import { buildQuestionReuseKeys, buildSymptomKey } from './question-reuse-keys.util.js';
export { buildSymptomKey, buildLooseSymptomKey } from './question-reuse-keys.util.js';
const MIN_CONFIDENCE = 0.65;
/** Staff-verified rows from agronomist case review / feedback. */
const VERIFIED_STAFF_CONFIDENCE = 0.85;
export function buildDapBucket(dap) {
    return Math.floor(Math.max(0, dap) / 15) * 15;
}
async function getFarmerDistrict(farmerId) {
    const { data } = await supabase.from('farmers').select('district').eq('id', farmerId).maybeSingle();
    return data?.district ? String(data.district).trim().toLowerCase() : null;
}
async function getFarmerDap(farmerId, activeBlockId) {
    if (activeBlockId) {
        const block = await blockService.getById(activeBlockId, farmerId);
        if (block)
            return block.dap;
    }
    const primary = await blockService.getPrimaryBlock(farmerId);
    return primary?.dap ?? 0;
}
export const aiReuseService = {
    async peekMatch(input) {
        if (!env.ENABLE_AI_REUSE_CACHE)
            return false;
        const district = await getFarmerDistrict(input.farmerId);
        const dap = await getFarmerDap(input.farmerId, input.activePlotId);
        const symptomKey = buildSymptomKey(input.symptomsText, input.voiceTranscript, input.compactHistory);
        const match = await this.findReusableCase({
            cropType: input.cropType,
            district,
            dapBucket: buildDapBucket(dap),
            symptomKey,
        });
        return match != null;
    },
    async findReusableCase(params) {
        if (!env.ENABLE_AI_REUSE_CACHE)
            return null;
        const crop = params.cropType.toLowerCase();
        const district = params.district?.toLowerCase() ?? null;
        const buckets = [params.dapBucket, params.dapBucket - 15, params.dapBucket + 15].filter((b) => b >= 0);
        for (const dapBucket of buckets) {
            const { data: rows } = await supabase
                .from('advisory_reuse_cases')
                .select('*')
                .eq('crop_type', crop)
                .eq('dap_bucket', dapBucket)
                .eq('symptom_key', params.symptomKey)
                .eq('outcome_ok', true)
                .gte('confidence_score', MIN_CONFIDENCE)
                .in('district', [district ?? '', ''])
                .order('hit_count', { ascending: false })
                .order('confidence_score', { ascending: false })
                .limit(5);
            const hit = (rows ?? []).sort((a, b) => {
                const aDist = a.district === (district ?? '') ? 2 : a.district === '' ? 1 : 0;
                const bDist = b.district === (district ?? '') ? 2 : b.district === '' ? 1 : 0;
                return bDist - aDist;
            })[0];
            if (!hit)
                continue;
            const advisory = normalizeStructuredAdvisory(hit.advisory_snapshot);
            const products = (hit.product_snapshot ?? []);
            await supabase
                .from('advisory_reuse_cases')
                .update({
                hit_count: (hit.hit_count ?? 0) + 1,
                last_reused_at: new Date().toISOString(),
            })
                .eq('id', hit.id);
            return {
                id: hit.id,
                sourceSessionId: hit.source_session_id,
                advisory,
                products,
                issueLabel: hit.issue_label,
            };
        }
        return null;
    },
    async indexSuccessfulCase(params) {
        if (!env.ENABLE_AI_REUSE_CACHE)
            return;
        if (params.escalated || params.advisory.confidence < MIN_CONFIDENCE)
            return;
        const districtKey = params.district ?? '';
        const { data: existing } = await supabase
            .from('advisory_reuse_cases')
            .select('confidence_score, advisory_snapshot')
            .eq('crop_type', params.cropType.toLowerCase())
            .eq('district', districtKey)
            .eq('dap_bucket', buildDapBucket(params.dap))
            .eq('symptom_key', params.symptomKey)
            .maybeSingle();
        const existingSnap = existing?.advisory_snapshot;
        if (existingSnap?.staffVerified) {
            return;
        }
        if (existing &&
            Number(existing.confidence_score) >= VERIFIED_STAFF_CONFIDENCE &&
            params.advisory.confidence < Number(existing.confidence_score)) {
            return;
        }
        const row = {
            crop_type: params.cropType.toLowerCase(),
            district: params.district ?? '',
            dap_bucket: buildDapBucket(params.dap),
            symptom_key: params.symptomKey,
            issue_label: params.advisory.probableIssue.slice(0, 200),
            source_session_id: params.sessionId ?? null,
            source_farmer_id: params.farmerId,
            source_type: params.sourceType ?? (params.sessionId ? 'ai_session' : 'field_visit'),
            source_field_finding_id: params.sourceFieldFindingId ?? null,
            source_recommendation_id: params.sourceRecommendationId ?? null,
            advisory_snapshot: params.advisory,
            product_snapshot: params.products,
            confidence_score: params.advisory.confidence,
            outcome_ok: true,
        };
        await supabase.from('advisory_reuse_cases').upsert(row, {
            onConflict: 'crop_type,district,dap_bucket,symptom_key',
            ignoreDuplicates: false,
        });
    },
    async markOutcomeForSession(sessionId, outcomeOk) {
        if (!sessionId)
            return;
        await supabase
            .from('advisory_reuse_cases')
            .update({ outcome_ok: outcomeOk, updated_at: new Date().toISOString() })
            .eq('source_session_id', sessionId);
    },
    async findReusableForFarmerMessage(params) {
        const slug = buildCrossLanguageIntentSlug(params.cropType, [params.text, params.voiceTranscript, params.compactHistory].filter(Boolean).join(' '), params.issueLabelHint);
        const keys = buildQuestionReuseKeys({
            text: params.text,
            voiceTranscript: params.voiceTranscript,
            compactHistory: params.compactHistory,
            issueLabelHint: params.issueLabelHint,
            intentSlug: slug,
        });
        for (const symptomKey of keys) {
            const match = await this.findReusableCase({
                cropType: params.cropType,
                district: params.district,
                dapBucket: params.dapBucket,
                symptomKey,
            });
            if (match)
                return match;
        }
        return null;
    },
    async tryReuse(input, sessionId) {
        if (!env.ENABLE_AI_REUSE_CACHE)
            return null;
        const district = await getFarmerDistrict(input.farmerId);
        const dap = await getFarmerDap(input.farmerId, input.activePlotId);
        const match = await this.findReusableForFarmerMessage({
            cropType: input.cropType,
            district,
            dapBucket: buildDapBucket(dap),
            text: input.symptomsText ?? '',
            voiceTranscript: input.voiceTranscript,
            compactHistory: input.compactHistory,
        });
        if (!match)
            return null;
        const started = Date.now();
        await aiLogService.logRequest({
            sessionId,
            provider: 'reuse_cache',
            endpoint: 'match',
            latencyMs: Date.now() - started,
            success: true,
        });
        await supabase
            .from('ai_advisory_sessions')
            .update({
            status: 'completed',
            confidence_score: match.advisory.confidence,
            metadata: {
                reusedFrom: match.sourceSessionId,
                reuseCaseId: match.id,
            },
            updated_at: new Date().toISOString(),
        })
            .eq('id', sessionId);
        await supabase.from('ai_advisory_outputs').insert({
            session_id: sessionId,
            provider: 'merged',
            language: input.language,
            probable_issue: match.advisory.probableIssue,
            nutrient_deficiency: match.advisory.nutrientDeficiency,
            stress_analysis: match.advisory.stressAnalysis,
            treatment_recommendations: match.advisory.treatments,
            dosage_guidance: match.advisory.dosageGuidance,
            precautions: match.advisory.precautions,
            farmer_summary_en: match.advisory.farmerSummaryEn,
            farmer_summary_ml: match.advisory.farmerSummaryMl,
            raw_response: { ...match.advisory, reused: true },
            model_version: 'reuse_cache',
        });
        const products = match.products.length > 0
            ? match.products
            : recommendationService.recommend(input.cropType, match.advisory);
        const lang = (input.language ?? 'en');
        const localized = {
            ...match.advisory,
            farmerSummaryEn: pickLocalizedFarmerSummary(match.advisory, lang),
        };
        return {
            sessionId,
            advisory: localized,
            productRecommendations: products,
            escalated: false,
        };
    },
};
//# sourceMappingURL=ai-reuse.service.js.map