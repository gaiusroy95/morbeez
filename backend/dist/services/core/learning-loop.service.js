import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { buildDapBucket } from '../ai/ai-reuse.service.js';
import { terminologyDictionaryService } from '../regional-terminology/terminology-dictionary.service.js';
import { terminologyEscalationService } from '../regional-terminology/terminology-escalation.service.js';
import { verifiedAdvisoryLearningService } from './verified-advisory-learning.service.js';
/**
 * Phase 5 — close the loop: staff-verified knowledge → reuse cache + terminology library.
 */
export const learningLoopService = {
    async onTerminologyResolved(params) {
        const term = params.term.trim().toLowerCase();
        if (!term || !params.meaning.trim())
            return;
        await terminologyDictionaryService.upsertApproved({
            term,
            language: params.language || 'en',
            meaning: params.meaning,
            standardTerm: params.standardTerm ?? params.meaning,
            cropType: params.cropType,
            district: params.district,
            approvedBy: params.resolvedBy,
        });
        await terminologyEscalationService.recordLearningHistory({
            term,
            language: params.language || 'en',
            meaning: params.meaning.trim(),
            standardTerm: params.standardTerm ?? null,
            cropType: params.cropType,
            district: params.district,
            action: 'approved',
            taskId: params.taskId,
            farmerId: params.farmerId,
            approvedBy: params.resolvedBy ?? null,
        });
        if (params.farmerId) {
            const { data: farmer } = await supabase
                .from('farmers')
                .select('phone, preferred_language')
                .eq('id', params.farmerId)
                .maybeSingle();
            if (farmer?.phone) {
                const lang = farmer.preferred_language ?? params.language;
                const msg = lang === 'ml'
                    ? `"${term}" എന്നത് ഇപ്പോൾ മനസ്സിലാക്കാം: ${params.meaning}`
                    : `We learned your term "${term}": ${params.meaning}`;
                await supabase.from('interaction_logs').insert({
                    farmer_id: params.farmerId,
                    channel: 'whatsapp',
                    direction: 'outbound',
                    content: msg.slice(0, 500),
                });
            }
        }
        logger.info({ taskId: params.taskId, term }, 'Terminology promoted to agronomy_terms');
    },
    async promoteRecommendationToReuse(recommendationRecordId) {
        const { data: rec } = await supabase
            .from('recommendation_records')
            .select('id, farmer_id, block_id, ai_session_id, field_finding_id, issue_detected, recommendation_text, products, outcome, status, dap_at_recommendation, source, farm_blocks(crop_type)')
            .eq('id', recommendationRecordId)
            .maybeSingle();
        if (!rec?.farmer_id)
            return;
        if (rec.outcome && !['better', 'partial', 'improved'].includes(String(rec.outcome)))
            return;
        const issueLabel = String(rec.issue_detected ?? 'crop issue');
        const summary = String(rec.recommendation_text ?? issueLabel).trim();
        if (rec.ai_session_id) {
            const { data: session } = await supabase
                .from('ai_advisory_sessions')
                .select('id, metadata')
                .eq('id', rec.ai_session_id)
                .maybeSingle();
            const { data: output } = await supabase
                .from('ai_advisory_outputs')
                .select('*')
                .eq('session_id', rec.ai_session_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (output) {
                const advisory = {
                    probableIssue: String(output.probable_issue ?? issueLabel),
                    confidence: Number(session?.metadata?.confidence ?? 0.75),
                    uncertain: false,
                    nutrientDeficiency: output.nutrient_deficiency ?? [],
                    stressAnalysis: output.stress_analysis ?? [],
                    treatments: output.treatment_recommendations ?? [],
                    dosageGuidance: output.dosage_guidance ?? [],
                    precautions: output.precautions ?? [],
                    escalationRecommended: false,
                    farmerSummaryEn: String(output.farmer_summary_en ?? summary),
                    farmerSummaryMl: String(output.farmer_summary_ml ?? output.farmer_summary_en ?? summary),
                    recommendedProductTags: [],
                };
                await verifiedAdvisoryLearningService.promoteVerifiedAnswer({
                    sessionId: String(rec.ai_session_id),
                    farmerId: String(rec.farmer_id),
                    issueLabel,
                    farmerSummaryEn: summary || advisory.farmerSummaryEn,
                    farmerSummaryMl: advisory.farmerSummaryMl,
                    verifiedBy: 'learning_loop',
                    products: rec.products ?? [],
                    confidence: advisory.confidence,
                    extraSymptomSources: [rec.issue_detected, rec.recommendation_text].filter(Boolean),
                    global: true,
                });
                logger.info({ recommendationRecordId, dapBucket: buildDapBucket(rec.dap_at_recommendation ?? 0) }, 'Promoted AI session to advisory_reuse_cases');
                return;
            }
        }
        const issueSources = [rec.issue_detected, rec.recommendation_text].filter(Boolean);
        if (rec.field_finding_id) {
            const { data: visitIssues } = await supabase
                .from('visit_issues')
                .select('issue_name, observation')
                .eq('field_finding_id', rec.field_finding_id);
            for (const vi of visitIssues ?? []) {
                if (vi.issue_name)
                    issueSources.push(String(vi.issue_name));
                if (vi.observation)
                    issueSources.push(String(vi.observation));
            }
        }
        await verifiedAdvisoryLearningService.promoteVerifiedAnswer({
            sessionId: rec.ai_session_id ? String(rec.ai_session_id) : null,
            farmerId: String(rec.farmer_id),
            issueLabel,
            farmerSummaryEn: summary,
            verifiedBy: 'learning_loop_field_visit',
            products: rec.products ?? [],
            confidence: 0.88,
            extraSymptomSources: issueSources,
            global: true,
            sourceType: 'field_visit',
            sourceFieldFindingId: rec.field_finding_id ? String(rec.field_finding_id) : null,
            sourceRecommendationId: String(rec.id),
        });
        logger.info({ recommendationRecordId, dapBucket: buildDapBucket(rec.dap_at_recommendation ?? 0) }, 'Promoted field visit to advisory_reuse_cases');
    },
    async onVisitCaseClosed(fieldFindingId) {
        const { data: recs } = await supabase
            .from('recommendation_records')
            .select('id, outcome')
            .eq('field_finding_id', fieldFindingId)
            .not('outcome', 'is', null);
        for (const rec of recs ?? []) {
            const out = String(rec.outcome ?? '');
            if (['better', 'partial', 'improved'].includes(out)) {
                await this.onLearningSampleReady(String(rec.id)).catch(() => { });
            }
        }
    },
    async onLearningSampleReady(recommendationRecordId) {
        const { data: sample } = await supabase
            .from('ai_learning_samples')
            .select('application_confirmed, outcome, escalated')
            .eq('recommendation_record_id', recommendationRecordId)
            .maybeSingle();
        if (!sample?.application_confirmed)
            return;
        if (sample.escalated)
            return;
        if (!sample.outcome || ['worsened', 'no_improvement'].includes(String(sample.outcome)))
            return;
        const { data: rec } = await supabase
            .from('recommendation_records')
            .select('outcome, outcome_kpi')
            .eq('id', recommendationRecordId)
            .maybeSingle();
        const outcomeConfirmed = Boolean(rec?.outcome_kpi) ||
            ['better', 'partial', 'improved'].includes(String(rec?.outcome ?? ''));
        if (!outcomeConfirmed)
            return;
        await this.promoteRecommendationToReuse(recommendationRecordId);
    },
};
//# sourceMappingURL=learning-loop.service.js.map