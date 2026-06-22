import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { aiTrainingEventService } from './ai-training-event.service.js';
import { recommendationFollowUpService } from './recommendation-follow-up.service.js';
import { learningLoopService } from './learning-loop.service.js';
function mapOutcomeToLearning(outcome) {
    if (!outcome || outcome === 'unknown')
        return null;
    if (outcome === 'better')
        return 'improved';
    if (outcome === 'partial')
        return 'partial';
    return 'no_improvement';
}
function mapReviewActionToHumanAction(action) {
    if (action === 'approve_ai' ||
        action === 'correct_ai' ||
        action === 'partial_match' ||
        action === 'escalate_urgent' ||
        action === 'reject_recommendation') {
        return action;
    }
    return 'approve_ai';
}
async function loadFindingBundle(fieldFindingId) {
    const { data: finding, error } = await supabase
        .from('crm_field_findings')
        .select('*')
        .eq('id', fieldFindingId)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not load field finding');
    if (!finding)
        throw new NotFoundError('Visit not found');
    const [{ data: issues }, { data: aiCases }, { data: recs }] = await Promise.all([
        supabase
            .from('visit_issues')
            .select('id, issue_name, severity, status, issue_category, observation')
            .eq('field_finding_id', fieldFindingId)
            .order('sort_order', { ascending: true }),
        supabase
            .from('visit_ai_cases')
            .select(`id, issue_name, selected_hypothesis_label, final_diagnosis, final_confidence,
         ai_advisory_session_id, visit_issue_id, metadata,
         visit_ai_hypotheses(label, confidence, selected, sort_order),
         visit_ai_recommendations(review_action, human_text, ai_text, recommendation_record_id)`)
            .eq('field_finding_id', fieldFindingId),
        supabase
            .from('recommendation_records')
            .select('id, farmer_id, block_id, ai_session_id, visit_issue_id, issue_detected, outcome, application_status, severity, recommendation_text')
            .eq('field_finding_id', fieldFindingId)
            .order('created_at', { ascending: false }),
    ]);
    return {
        finding,
        issues: issues ?? [],
        aiCases: aiCases ?? [],
        recommendations: recs ?? [],
    };
}
function resolveInitialAiLabel(aiCase, finding) {
    const hypotheses = aiCase.visit_ai_hypotheses ?? [];
    const sorted = [...hypotheses].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const top = sorted[0]?.label ? String(sorted[0].label) : null;
    if (top)
        return top;
    if (aiCase.selected_hypothesis_label)
        return String(aiCase.selected_hypothesis_label);
    if (finding.ai_prediction)
        return String(finding.ai_prediction);
    return aiCase.issue_name ? String(aiCase.issue_name) : null;
}
function resolveFinalLabel(aiCase) {
    if (aiCase.final_diagnosis)
        return String(aiCase.final_diagnosis);
    if (aiCase.selected_hypothesis_label)
        return String(aiCase.selected_hypothesis_label);
    return aiCase.issue_name ? String(aiCase.issue_name) : null;
}
export const visitCaseClosureService = {
    async emitTrainingEventForRecommendation(recommendationRecordId, agentEmail) {
        const rec = await recommendationFollowUpService.loadRecord(recommendationRecordId);
        if (!rec?.field_finding_id)
            return null;
        const { data: aiCase } = await supabase
            .from('visit_ai_cases')
            .select(`id, issue_name, selected_hypothesis_label, final_diagnosis, final_confidence, visit_issue_id,
         visit_ai_hypotheses(label, confidence, sort_order),
         visit_ai_recommendations(review_action)`)
            .eq('field_finding_id', rec.field_finding_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const { data: finding } = await supabase
            .from('crm_field_findings')
            .select('ai_prediction, block_id')
            .eq('id', rec.field_finding_id)
            .maybeSingle();
        const aiPrediction = aiCase
            ? resolveInitialAiLabel(aiCase, (finding ?? {}))
            : rec.issue_detected;
        const humanFinalLabel = aiCase
            ? resolveFinalLabel(aiCase) ?? rec.issue_detected
            : rec.issue_detected;
        const recs = aiCase?.visit_ai_recommendations ?? [];
        const reviewAction = recs[0]?.review_action;
        return aiTrainingEventService.record({
            farmerId: rec.farmer_id,
            blockId: rec.block_id,
            aiSessionId: rec.ai_session_id,
            recommendationRecordId,
            fieldFindingId: rec.field_finding_id,
            source: 'field_visit',
            reviewSurface: 'field_finding',
            aiPrediction,
            aiConfidence: aiCase?.final_confidence != null ? Number(aiCase.final_confidence) : null,
            humanAction: mapReviewActionToHumanAction(reviewAction),
            humanFinalLabel,
            reviewedBy: agentEmail,
            metadata: {
                closureTrigger: 'outcome_recorded',
                outcome: rec.outcome,
                visitAiCaseId: aiCase?.id ?? null,
            },
        });
    },
    async closeCase(input) {
        const bundle = await loadFindingBundle(input.fieldFindingId);
        const farmerId = String(bundle.finding.farmer_id);
        const blockId = bundle.finding.block_id ? String(bundle.finding.block_id) : null;
        const now = new Date().toISOString();
        const learningConsent = input.learningConsent !== false;
        await supabase
            .from('visit_issues')
            .update({ status: input.issueResolved === false ? 'monitoring' : 'resolved', updated_at: now })
            .eq('field_finding_id', input.fieldFindingId)
            .neq('status', 'resolved');
        const trainingEventIds = [];
        const learningSampleRecIds = [];
        if (learningConsent) {
            for (const aiCase of bundle.aiCases) {
                const aiPrediction = resolveInitialAiLabel(aiCase, bundle.finding);
                const humanFinalLabel = resolveFinalLabel(aiCase);
                const recs = aiCase.visit_ai_recommendations ?? [];
                const reviewAction = recs[0]?.review_action;
                const linkedRecId = recs[0]?.recommendation_record_id
                    ? String(recs[0].recommendation_record_id)
                    : null;
                const eventId = await aiTrainingEventService.record({
                    farmerId,
                    blockId,
                    aiSessionId: aiCase.ai_advisory_session_id ? String(aiCase.ai_advisory_session_id) : null,
                    recommendationRecordId: linkedRecId,
                    fieldFindingId: input.fieldFindingId,
                    source: 'field_visit',
                    reviewSurface: 'field_finding',
                    aiPrediction,
                    aiConfidence: aiCase.final_confidence != null ? Number(aiCase.final_confidence) : null,
                    humanAction: mapReviewActionToHumanAction(reviewAction),
                    humanFinalLabel,
                    correctionReason: input.notes ?? null,
                    reviewedBy: input.closedBy,
                    metadata: {
                        closureTrigger: 'agronomist_close_case',
                        visitAiCaseId: String(aiCase.id),
                        visitIssueId: aiCase.visit_issue_id ? String(aiCase.visit_issue_id) : null,
                        caseOutcome: input.outcome ?? null,
                    },
                });
                if (eventId)
                    trainingEventIds.push(eventId);
            }
            for (const rec of bundle.recommendations) {
                const recRow = await recommendationFollowUpService.loadRecord(String(rec.id));
                if (!recRow)
                    continue;
                let outcome = rec.outcome ? String(rec.outcome) : null;
                if (!outcome && input.outcome) {
                    await supabase
                        .from('recommendation_records')
                        .update({
                        outcome: input.outcome,
                        status: 'outcome_recorded',
                        outcome_at: now,
                        outcome_notes: input.notes ?? null,
                        issue_resolved: input.issueResolved ??
                            (input.outcome === 'better' || input.outcome === 'partial'),
                        updated_at: now,
                    })
                        .eq('id', rec.id);
                    outcome = input.outcome;
                    recRow.outcome = input.outcome;
                }
                const learningOutcome = mapOutcomeToLearning(outcome ?? input.outcome);
                await recommendationFollowUpService.upsertLearningSample(recRow, {
                    applicationConfirmed: recRow.application_status === 'applied' ||
                        recRow.status === 'applied' ||
                        recRow.status === 'outcome_recorded',
                    outcome: learningOutcome ?? undefined,
                    escalated: outcome === 'no_improvement',
                });
                learningSampleRecIds.push(String(rec.id));
                if (outcome === 'better' || outcome === 'partial') {
                    await learningLoopService.onLearningSampleReady(String(rec.id)).catch(() => { });
                }
            }
            await learningLoopService.onVisitCaseClosed(input.fieldFindingId).catch(() => { });
        }
        for (const aiCase of bundle.aiCases) {
            const meta = aiCase.metadata ?? {};
            await supabase
                .from('visit_ai_cases')
                .update({
                metadata: {
                    ...meta,
                    caseClosed: true,
                    closedAt: now,
                    closedBy: input.closedBy,
                    caseOutcome: input.outcome ?? null,
                    learningConsent,
                    closureNotes: input.notes ?? null,
                },
                updated_at: now,
            })
                .eq('id', aiCase.id);
        }
        await supabase
            .from('crm_field_findings')
            .update({
            action_taken: input.notes?.trim()
                ? `Case closed: ${input.notes.trim()}`
                : 'Case closed by agronomist',
            follow_up_at: now,
        })
            .eq('id', input.fieldFindingId);
        const { experimentDefinitionService } = await import('../intelligence/enterprise-ops.service.js');
        await experimentDefinitionService.assignOnVisitClose(input.fieldFindingId).catch(() => { });
        await this.recordApplicationHistory(input.fieldFindingId, farmerId, blockId).catch(() => { });
        return {
            fieldFindingId: input.fieldFindingId,
            closedAt: now,
            closedBy: input.closedBy,
            trainingEventIds,
            learningSampleRecommendationIds: learningSampleRecIds,
            issuesUpdated: bundle.issues.length,
            learningConsent,
        };
    },
    async recordApplicationHistory(fieldFindingId, farmerId, blockId) {
        const { recommendationGroupService } = await import('./recommendation-group.service.js');
        const { applicationHistoryService } = await import('../intelligence/enterprise-ops.service.js');
        const groups = await recommendationGroupService.listByFieldFinding(fieldFindingId);
        const methodMap = {
            foliar_spray: 'spray',
            soil_drench: 'drench',
            fertigation: 'fertigation',
            granular: 'soil',
            seed_treatment: 'soil',
            other: 'spray',
        };
        for (const group of groups) {
            for (const mat of group.materials) {
                if (!mat.technicalName.trim())
                    continue;
                await applicationHistoryService.record({
                    farmerId,
                    blockId: blockId ?? undefined,
                    productName: mat.technicalName,
                    dose: mat.dose ?? undefined,
                    method: methodMap[group.applicationType] ?? 'spray',
                    source: 'visit',
                    sourceId: fieldFindingId,
                });
            }
        }
    },
};
//# sourceMappingURL=visit-case-closure.service.js.map