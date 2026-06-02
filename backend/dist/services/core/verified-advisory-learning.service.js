import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { aiReuseService, buildDapBucket } from '../ai/ai-reuse.service.js';
import { buildLooseSymptomKey, buildSymptomKey, } from '../ai/question-reuse-keys.util.js';
import { blockService } from './block.service.js';
import { buildCrossLanguageIntentSlug, pickLocalizedFarmerSummary, } from '../whatsapp/pipeline/crop-message-intent.service.js';
import { pickLatestOutput, textsLikelySame } from '../admin/case-review-inquiry.util.js';
import { isAgricultureMessage } from '../whatsapp/pipeline/crop-message-intent.service.js';
const VERIFIED_CONFIDENCE = 0.88;
function uniqueSymptomKeys(sources) {
    const keys = new Set();
    for (const raw of sources) {
        const t = raw?.trim();
        if (!t || t.length < 4)
            continue;
        keys.add(buildSymptomKey(t));
        keys.add(buildLooseSymptomKey(t));
    }
    if (!keys.size)
        keys.add(buildSymptomKey('_verified_field_issue_'));
    return [...keys];
}
function buildVerifiedAdvisory(params) {
    const en = params.farmerSummaryEn.trim();
    const ml = (params.farmerSummaryMl ?? en).trim();
    return {
        probableIssue: params.issueLabel.trim().slice(0, 200) || 'Verified field guidance',
        confidence: params.confidence ?? VERIFIED_CONFIDENCE,
        uncertain: false,
        nutrientDeficiency: [],
        stressAnalysis: [],
        treatments: [],
        dosageGuidance: [],
        precautions: ['Verified by Morbeez agronomy team.'],
        escalationRecommended: false,
        farmerSummaryEn: en,
        farmerSummaryMl: ml,
        recommendedProductTags: [],
        staffVerified: true,
    };
}
/**
 * Permanent verified answers for WhatsApp / Crop Doctor reuse.
 * When staff corrects an AI reply, we index it by the farmer's original question text
 * so the same (or similar) question returns the edited answer — for any farmer in region + globally.
 */
export const verifiedAdvisoryLearningService = {
    uniqueSymptomKeys,
    async loadSessionQuestionSources(sessionId) {
        const { data } = await supabase
            .from('ai_advisory_sessions')
            .select('crop_type, symptoms_text, voice_transcript')
            .eq('id', sessionId)
            .maybeSingle();
        if (!data)
            return null;
        return {
            cropType: String(data.crop_type ?? 'ginger').toLowerCase(),
            symptomsText: data.symptoms_text ? String(data.symptoms_text) : null,
            voiceTranscript: data.voice_transcript ? String(data.voice_transcript) : null,
        };
    },
    /**
     * Index agronomist-verified answer for reuse (regional + optional global district '').
     */
    async promoteVerifiedAnswer(input) {
        const session = await this.loadSessionQuestionSources(input.sessionId);
        const cropType = session?.cropType ?? 'ginger';
        const { data: farmer } = await supabase
            .from('farmers')
            .select('district')
            .eq('id', input.farmerId)
            .maybeSingle();
        const primary = await blockService.getPrimaryBlock(input.farmerId);
        const dap = primary?.dap ?? 0;
        const district = farmer?.district != null ? String(farmer.district).trim().toLowerCase() : null;
        const intentSlug = buildCrossLanguageIntentSlug(cropType, [session?.symptomsText, session?.voiceTranscript].filter(Boolean).join(' '), input.issueLabel);
        const symptomKeys = uniqueSymptomKeys([
            session?.symptomsText,
            session?.voiceTranscript,
            input.issueLabel,
            intentSlug,
            ...(input.extraSymptomSources ?? []),
        ]);
        const districts = [];
        if (district)
            districts.push(district);
        if (input.global !== false)
            districts.push('');
        if (!districts.length)
            districts.push('');
        const advisory = buildVerifiedAdvisory({
            issueLabel: input.issueLabel,
            farmerSummaryEn: input.farmerSummaryEn,
            farmerSummaryMl: input.farmerSummaryMl,
            confidence: input.confidence,
            products: input.products,
        });
        for (const symptomKey of symptomKeys) {
            for (const d of districts) {
                await aiReuseService.indexSuccessfulCase({
                    sessionId: input.sessionId,
                    farmerId: input.farmerId,
                    cropType,
                    district: d || null,
                    dap,
                    symptomKey,
                    advisory,
                    products: input.products ?? [],
                    escalated: false,
                });
            }
        }
        await this.patchSessionOutput(input.sessionId, advisory);
        logger.info({
            sessionId: input.sessionId,
            verifiedBy: input.verifiedBy,
            symptomKeys,
            districts,
            issue: input.issueLabel.slice(0, 80),
        }, 'Promoted verified advisory for permanent reuse');
        return { symptomKeys, districts };
    },
    async patchSessionOutput(sessionId, advisory) {
        const { data: latest } = await supabase
            .from('ai_advisory_outputs')
            .select('id')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const patch = {
            probable_issue: advisory.probableIssue,
            farmer_summary_en: advisory.farmerSummaryEn,
            farmer_summary_ml: advisory.farmerSummaryMl,
            precautions: advisory.precautions,
            raw_response: { ...advisory, staffVerified: true },
            model_version: 'staff_verified',
            updated_at: new Date().toISOString(),
        };
        if (latest?.id) {
            await supabase.from('ai_advisory_outputs').update(patch).eq('id', latest.id);
        }
        else {
            const { data: sess } = await supabase
                .from('ai_advisory_sessions')
                .select('language')
                .eq('id', sessionId)
                .maybeSingle();
            await supabase.from('ai_advisory_outputs').insert({
                session_id: sessionId,
                provider: 'staff_verified',
                language: sess?.language ?? 'en',
                ...patch,
            });
        }
    },
    /**
     * Match farmer free-text to a verified reuse case (before OpenAI).
     */
    async matchFarmerQuestion(params) {
        const { data: farmer } = await supabase
            .from('farmers')
            .select('district')
            .eq('id', params.farmerId)
            .maybeSingle();
        const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;
        let dap = 0;
        if (params.activePlotId) {
            const block = await blockService.getById(params.activePlotId, params.farmerId);
            if (block)
                dap = block.dap;
        }
        else {
            const primary = await blockService.getPrimaryBlock(params.farmerId);
            dap = primary?.dap ?? 0;
        }
        const match = await aiReuseService.findReusableForFarmerMessage({
            cropType: params.cropType.toLowerCase(),
            district,
            dapBucket: buildDapBucket(dap),
            text: params.text.trim(),
        });
        const lang = params.language ?? 'en';
        if (match) {
            return {
                advisory: {
                    ...match.advisory,
                    farmerSummaryEn: pickLocalizedFarmerSummary(match.advisory, lang),
                },
                issueLabel: match.issueLabel,
                reuseCaseId: match.id,
            };
        }
        const peer = await this.matchPeerRecentSession({
            farmerId: params.farmerId,
            cropType: params.cropType,
            text: params.text.trim(),
            language: lang,
        });
        return peer;
    },
    /**
     * Same farmer asked again in another language — reuse recent diagnosis content.
     */
    async matchPeerRecentSession(params) {
        if (!isAgricultureMessage(params.text))
            return null;
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: sessions } = await supabase
            .from('ai_advisory_sessions')
            .select('id, symptoms_text, ai_advisory_outputs(*)')
            .eq('farmer_id', params.farmerId)
            .eq('crop_type', params.cropType.toLowerCase())
            .gte('created_at', since)
            .in('status', ['completed', 'escalated'])
            .order('created_at', { ascending: false })
            .limit(5);
        for (const row of sessions ?? []) {
            const prevQ = String(row.symptoms_text ?? '').trim();
            if (!prevQ || textsLikelySame(prevQ, params.text))
                continue;
            const latest = pickLatestOutput(row.ai_advisory_outputs);
            if (!latest)
                continue;
            const advisory = {
                probableIssue: String(latest.probable_issue ?? 'Crop issue'),
                confidence: 0.85,
                uncertain: false,
                nutrientDeficiency: [],
                stressAnalysis: [],
                treatments: [],
                dosageGuidance: [],
                precautions: Array.isArray(latest.precautions) ? latest.precautions : [],
                escalationRecommended: false,
                farmerSummaryEn: String(latest.farmer_summary_en ?? ''),
                farmerSummaryMl: String(latest.farmer_summary_ml ?? latest.farmer_summary_en ?? ''),
                recommendedProductTags: [],
            };
            const body = pickLocalizedFarmerSummary(advisory, params.language);
            if (!body || body.length < 20)
                continue;
            return {
                advisory: { ...advisory, farmerSummaryEn: body },
                issueLabel: advisory.probableIssue,
                reuseCaseId: `peer:${row.id}`,
            };
        }
        return null;
    },
    formatFarmerMessage(advisory, language) {
        const body = pickLocalizedFarmerSummary(advisory, language);
        return body || advisory.probableIssue || '';
    },
    async promoteFromRecommendationRecord(recommendationRecordId, verifiedBy) {
        const { data: rec } = await supabase
            .from('recommendation_records')
            .select('id, farmer_id, ai_session_id, issue_detected, recommendation_text, products, metadata, farm_blocks(crop_type)')
            .eq('id', recommendationRecordId)
            .maybeSingle();
        if (!rec?.ai_session_id || !rec.farmer_id || !rec.recommendation_text?.trim())
            return;
        const meta = rec.metadata;
        const farmerQuestion = meta?.farmerQuestion && String(meta.farmerQuestion).trim().length >= 4
            ? String(meta.farmerQuestion).trim()
            : undefined;
        await this.promoteVerifiedAnswer({
            sessionId: String(rec.ai_session_id),
            farmerId: String(rec.farmer_id),
            issueLabel: String(rec.issue_detected ?? 'crop issue'),
            farmerSummaryEn: String(rec.recommendation_text).trim(),
            verifiedBy,
            products: rec.products ?? [],
            extraSymptomSources: [
                farmerQuestion,
                rec.issue_detected ? String(rec.issue_detected) : undefined,
            ],
            global: true,
        });
    },
};
//# sourceMappingURL=verified-advisory-learning.service.js.map