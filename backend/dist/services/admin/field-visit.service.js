import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { blockService } from '../core/block.service.js';
import { fieldStorageService } from '../core/field-storage.service.js';
import { telecallerAdminService } from './telecaller-admin.service.js';
import { recommendationRecordsService } from '../core/recommendation-records.service.js';
import { outcomeReviewService } from '../core/outcome-review.service.js';
import { aiTrainingEventService } from '../core/ai-training-event.service.js';
import { recommendationCommunicationService } from '../core/recommendation-communication.service.js';
import { fieldFindingsMastersService } from './field-findings-masters.service.js';
import { visitAiOrchestratorService } from '../core/visit-ai-orchestrator.service.js';
import { recommendationGroupService, } from '../core/recommendation-group.service.js';
import { monitoringPlanService } from '../core/monitoring-plan.service.js';
function mapVisitFollowupToOutcome(outcome) {
    if (outcome === 'improved')
        return 'better';
    if (outcome === 'worsened')
        return 'no_improvement';
    if (outcome === 'no_change')
        return 'partial';
    return 'unknown';
}
export const fieldVisitService = {
    listIssueMaster: fieldFindingsMastersService.listIssueMaster.bind(fieldFindingsMastersService),
    listMeasurementTemplates: fieldFindingsMastersService.listMeasurementTemplates.bind(fieldFindingsMastersService),
    async getVisitDetail(findingId) {
        const { data: finding, error } = await supabase
            .from('crm_field_findings')
            .select('*')
            .eq('id', findingId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load visit');
        if (!finding)
            throw new NotFoundError('Visit not found');
        const [{ data: issues }, { data: measurements }, { data: recs }] = await Promise.all([
            supabase
                .from('visit_issues')
                .select('*, issue_photos(*)')
                .eq('field_finding_id', findingId)
                .order('sort_order', { ascending: true }),
            supabase.from('visit_measurements').select('*').eq('field_finding_id', findingId),
            supabase
                .from('recommendation_records')
                .select('*')
                .eq('field_finding_id', findingId)
                .order('created_at', { ascending: false }),
        ]);
        return {
            finding,
            issues: issues ?? [],
            measurements: measurements ?? [],
            recommendations: recs ?? [],
        };
    },
    async listFarmerFieldFindings(farmerId, options = {}) {
        const { agronomistMobileService } = await import('../agronomist/agronomist-mobile.service.js');
        return agronomistMobileService.listFarmerVisits(farmerId, options);
    },
    async submitStructuredVisit(input, agronomistEmail) {
        return this.submitStructuredVisitForPartner(input, agronomistEmail, null, agronomistEmail);
    },
    async submitStructuredVisitForPartner(input, agentEmail, partnerId, agentDisplayName) {
        if (!env.ENABLE_STRUCTURED_FIELD_VISITS) {
            throw new ValidationError('Structured field visits are not enabled on this server');
        }
        const block = await blockService.getById(input.blockId, input.farmerId);
        if (!block)
            throw new NotFoundError('Block not found');
        let leadId = input.leadId ?? null;
        if (!leadId) {
            const { data: lead } = await supabase
                .from('leads')
                .select('id')
                .eq('farmer_id', input.farmerId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            leadId = lead?.id ? String(lead.id) : null;
        }
        const visitedAt = input.visitedAt ?? new Date().toISOString();
        const dap = block.dap;
        const issueSummary = input.issues.map((i) => i.issueName).join(', ');
        const primaryIssue = input.issues[0];
        const allObservations = input.issues
            .map((i) => (i.observation?.trim() ? `${i.issueName}: ${i.observation.trim()}` : null))
            .filter(Boolean)
            .join('\n');
        const measurementParams = (input.measurements ?? []).map((m) => ({
            key: m.key,
            label: m.key,
            value: m.unit ? `${m.value} ${m.unit}` : m.value,
        }));
        const findingRow = await telecallerAdminService.createFieldFinding(input.farmerId, leadId, {
            blockId: input.blockId,
            blockName: block.name,
            cropType: block.crop_type,
            observations: allObservations || undefined,
            diseasePest: issueSummary,
            diseaseTone: primaryIssue.severity === 'high' ? 'danger' : primaryIssue.severity === 'medium' ? 'warning' : 'healthy',
            findingType: primaryIssue.category === 'nutrient_deficiency' ? 'nutrient_deficiency' : primaryIssue.category === 'water_stress' ? 'irrigation' : primaryIssue.category === 'weed' ? 'other' : primaryIssue.category,
            severity: mapReviewSeverity(primaryIssue.severity),
            finalConfirmedIssue: primaryIssue.issueName,
            parameters: measurementParams.length ? measurementParams : undefined,
            agronomistName: agentDisplayName,
            agronomistRole: partnerId ? 'Partner' : 'Field Agronomist',
            agentEmail,
        });
        const findingId = String(findingRow.id);
        await supabase
            .from('crm_field_findings')
            .update({
            block_health: input.blockAssessment?.blockHealth ?? null,
            crop_performance: input.blockAssessment?.cropPerformance ?? null,
            soil_moisture: input.blockAssessment?.soilMoisture ?? null,
            visit_session_id: input.sessionId ?? null,
            dap_at_visit: dap,
            stage_at_visit: block.stage ?? null,
            visited_at: visitedAt,
            submitted_by_role: partnerId ? 'partner' : 'agronomist',
            partner_id: partnerId,
        })
            .eq('id', findingId);
        if (input.latitude != null && input.longitude != null) {
            await blockService.updatePlotLocation(input.blockId, {
                latitude: input.latitude,
                longitude: input.longitude,
                source: 'field_pwa',
                farmerId: input.farmerId,
            });
        }
        if (input.sessionId) {
            await supabase
                .from('agronomist_visit_sessions')
                .update({ field_finding_id: findingId, updated_at: new Date().toISOString() })
                .eq('id', input.sessionId);
        }
        if (input.visitPhotos?.length) {
            const urls = await fieldStorageService.uploadPhotos(input.farmerId, input.visitPhotos);
            for (let pi = 0; pi < urls.length; pi++) {
                await supabase.from('visit_photos').insert({
                    field_finding_id: findingId,
                    session_id: input.sessionId ?? null,
                    storage_path: urls[pi],
                    public_url: urls[pi],
                    photo_type: input.visitPhotos[pi]?.photoType ?? null,
                    sort_order: pi,
                });
            }
        }
        for (const m of input.measurements ?? []) {
            const templates = await fieldFindingsMastersService.listMeasurementTemplates(block.crop_type);
            const tpl = templates.find((t) => t.measurementKey === m.key);
            await supabase.from('visit_measurements').insert({
                field_finding_id: findingId,
                measurement_key: m.key,
                label_en: tpl?.labelEn ?? m.key,
                value: m.value,
                unit: m.unit ?? tpl?.unit ?? null,
            });
        }
        const createdIssues = [];
        const createdRecs = [];
        let savedRecommendationGroups = [];
        const { data: farmerLangRow } = await supabase
            .from('farmers')
            .select('preferred_language')
            .eq('id', input.farmerId)
            .maybeSingle();
        const farmerPreferredLanguage = farmerLangRow?.preferred_language ?? 'en';
        for (let i = 0; i < input.issues.length; i++) {
            const issue = input.issues[i];
            const { data: issueRow, error: issueErr } = await supabase
                .from('visit_issues')
                .insert({
                field_finding_id: findingId,
                issue_category: issue.category,
                issue_master_id: issue.issueMasterId ?? null,
                issue_name: issue.issueName,
                severity: issue.severity,
                observation: issue.observation ?? null,
                status: issue.status ?? 'open',
                sort_order: i,
            })
                .select('id')
                .single();
            throwIfSupabaseError(issueErr, 'Could not save visit issue');
            if (!issueRow)
                throw new ValidationError('Could not save visit issue');
            const visitIssueId = String(issueRow.id);
            createdIssues.push({ id: visitIssueId, issueName: issue.issueName, index: i });
            if (issue.photos?.length) {
                const urls = await fieldStorageService.uploadPhotos(input.farmerId, issue.photos);
                for (let pi = 0; pi < urls.length; pi++) {
                    await supabase.from('issue_photos').insert({
                        visit_issue_id: visitIssueId,
                        storage_path: urls[pi],
                        public_url: urls[pi],
                        photo_type: issue.photos[pi]?.photoType ?? null,
                        sort_order: pi,
                    });
                    const { cropImageReviewService } = await import('../core/crop-image-review.service.js');
                    void cropImageReviewService.enqueue({
                        farmerId: input.farmerId,
                        blockId: input.blockId,
                        fieldFindingId: findingId,
                        externalUrl: urls[pi],
                        source: 'field_visit',
                        crop: block.crop_type,
                        symptoms: [issue.issueName, issue.observation ?? ''].filter(Boolean),
                        aiPrediction: issue.issueName,
                    });
                }
            }
            const humanAction = await resolveFieldTrainingAction(input.farmerId, issue.issueName, issue.observation);
            const reviewAction = issue.agronomistReview?.action ?? null;
            const aiPrediction = issue.finalDiagnosis?.trim() || issue.issueName;
            const humanFinalLabel = issue.agronomistReview?.finalDiagnosis?.trim() ||
                issue.finalDiagnosis?.trim() ||
                issue.issueName;
            let aiCaseRow = null;
            if (issue.aiCaseId) {
                const { data: loadedCase } = await supabase
                    .from('visit_ai_cases')
                    .select('metadata, ai_advisory_session_id, confidence_action')
                    .eq('id', issue.aiCaseId)
                    .maybeSingle();
                aiCaseRow = loadedCase;
                const priorMeta = aiCaseRow?.metadata ?? {};
                await supabase
                    .from('visit_ai_cases')
                    .update({
                    metadata: {
                        ...priorMeta,
                        agronomistConfidence: issue.agronomistReview?.agronomistConfidence ?? null,
                        yieldRisk: issue.agronomistReview?.yieldRisk ?? null,
                    },
                })
                    .eq('id', issue.aiCaseId);
                await visitAiOrchestratorService.linkCaseToVisitIssue(issue.aiCaseId, findingId, visitIssueId);
                if (issue.agronomistReview) {
                    await supabase
                        .from('visit_ai_recommendations')
                        .update({
                        review_action: issue.agronomistReview.action,
                        human_text: issue.finalRecommendation ?? null,
                        modification_reason: issue.agronomistReview.modificationReason ?? null,
                        agronomist_confidence: issue.agronomistReview.agronomistConfidence ?? null,
                        yield_risk: issue.agronomistReview.yieldRisk ?? null,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('visit_ai_case_id', issue.aiCaseId);
                }
            }
            if (!partnerId) {
                void aiTrainingEventService
                    .record({
                    farmerId: input.farmerId,
                    blockId: input.blockId,
                    fieldFindingId: findingId,
                    source: 'field_visit',
                    reviewSurface: 'field_finding',
                    aiPrediction,
                    humanAction: reviewAction ?? humanAction,
                    humanFinalLabel,
                    reviewedBy: agentEmail,
                    metadata: {
                        visitIssueId,
                        category: issue.category,
                        severity: issue.severity,
                        aiCaseId: issue.aiCaseId ?? null,
                        modificationReason: issue.agronomistReview?.modificationReason ?? null,
                        visitOrigin: true,
                    },
                })
                    .catch(() => { });
            }
            if (issue.aiCaseId &&
                !partnerId &&
                issue.severity === 'high' &&
                (aiCaseRow?.confidence_action === 'escalate' || reviewAction === 'escalate_urgent')) {
                const sessionId = aiCaseRow?.ai_advisory_session_id
                    ? String(aiCaseRow.ai_advisory_session_id)
                    : null;
                if (sessionId) {
                    const { escalationService } = await import('../ai/escalation.service.js');
                    void escalationService
                        .createCaseForReview({
                        sessionId,
                        farmerId: input.farmerId,
                        reason: `Visit AI low confidence + high severity: ${humanFinalLabel} (visitAiCaseId=${issue.aiCaseId})`,
                        confidence_at_escalation: 0.5,
                        priority: 'high',
                    })
                        .catch(() => { });
                }
            }
        }
        if (input.recommendationGroups?.length) {
            savedRecommendationGroups = await recommendationGroupService.replaceForFieldFinding(findingId, resolveRecommendationGroups(input, createdIssues));
        }
        for (let i = 0; i < input.issues.length; i++) {
            const issue = input.issues[i];
            const visitIssueId = createdIssues.find((row) => row.index === i)?.id;
            if (!visitIssueId)
                continue;
            const reviewAction = issue.agronomistReview?.action ?? null;
            const humanFinalLabel = issue.agronomistReview?.finalDiagnosis?.trim() ||
                issue.finalDiagnosis?.trim() ||
                issue.issueName;
            let aiCaseRow = null;
            if (issue.aiCaseId) {
                const { data: loadedCase } = await supabase
                    .from('visit_ai_cases')
                    .select('ai_advisory_session_id')
                    .eq('id', issue.aiCaseId)
                    .maybeSingle();
                aiCaseRow = loadedCase;
            }
            const recSources = issue.recommendations?.length
                ? issue.recommendations
                : issue.finalRecommendation?.trim()
                    ? [
                        {
                            text: issue.finalRecommendation.trim(),
                            reviewAfterDays: issue.reviewAfterDays ?? 7,
                            priority: 'normal',
                        },
                    ]
                    : [];
            for (const rec of recSources) {
                if (!rec.text.trim())
                    continue;
                const reviewDate = rec.reviewDate
                    ? new Date(rec.reviewDate)
                    : new Date(Date.now() + (rec.reviewAfterDays ?? issue.reviewAfterDays ?? 7) * 86400000);
                const shouldApprove = !partnerId &&
                    (reviewAction === 'approve_ai' ||
                        reviewAction === 'correct_ai' ||
                        reviewAction === 'partial_match' ||
                        (reviewAction === 'reject_recommendation' &&
                            issue.agronomistReview?.rejectFlowComplete &&
                            issue.agronomistReview.rejectReason !== 'need_more_evidence'));
                const recStatus = partnerId ? 'draft' : shouldApprove ? 'approved' : 'draft';
                const groupProducts = recommendationGroupService.productsJsonForIssue(savedRecommendationGroups, visitIssueId);
                const groupApplicationType = recommendationGroupService.primaryApplicationTypeForIssue(savedRecommendationGroups, visitIssueId);
                const row = await recommendationRecordsService.create({
                    farmerId: input.farmerId,
                    blockId: input.blockId,
                    leadId: leadId ?? undefined,
                    fieldFindingId: findingId,
                    visitIssueId: visitIssueId,
                    source: 'field_finding',
                    issueDetected: humanFinalLabel,
                    recommendationText: rec.text.trim(),
                    products: groupProducts.length ? groupProducts : undefined,
                    applicationType: groupApplicationType ?? undefined,
                    severity: issue.severity,
                    createdBy: agentEmail,
                    status: recStatus,
                });
                createdRecs.push(String(row.id));
                await supabase
                    .from('recommendation_records')
                    .update({
                    dosage: groupProducts
                        .map((p) => {
                        const name = typeof p.technicalName === 'string' ? p.technicalName : 'Product';
                        const dose = typeof p.dose === 'string' ? p.dose : '';
                        return dose ? `${name}: ${dose}` : name;
                    })
                        .filter(Boolean)
                        .join('; ') || null,
                    application_type: (groupApplicationType ??
                        groupProducts
                            .map((p) => (typeof p.method === 'string' ? p.method : null))
                            .filter(Boolean)
                            .join('; ')) || null,
                    language: farmerPreferredLanguage,
                    metadata: {
                        recommendationType: rec.recommendationType ?? 'other',
                        priority: rec.priority ?? 'normal',
                        reviewDate: reviewDate.toISOString(),
                        fieldRecStatus: partnerId
                            ? 'pending_expert_review'
                            : shouldApprove
                                ? rec.status ?? 'open'
                                : 'pending_expert_review',
                        partnerSubmitted: Boolean(partnerId),
                        visitOrigin: true,
                        visitAiCaseId: issue.aiCaseId ?? null,
                        agronomistReviewAction: reviewAction,
                        recommendationGroupIds: savedRecommendationGroups.map((group) => group.id),
                    },
                })
                    .eq('id', row.id);
                if (savedRecommendationGroups.length) {
                    const monItem = await monitoringPlanService.createForRecommendation(String(row.id), {
                        severity: issue.severity,
                        materials: groupProducts.map((product) => ({
                            category: typeof product.category === 'string' ? product.category : null,
                            technicalName: typeof product.technicalName === 'string' ? product.technicalName : null,
                        })),
                    });
                    if (!partnerId && visitIssueId) {
                        void monitoringPlanService
                            .scheduleProgressionJob({
                            farmerId: input.farmerId,
                            fieldFindingId: findingId,
                            visitIssueId,
                            severity: issue.severity,
                            sessionId: input.sessionId ?? null,
                            intervalDays: monItem.intervalDays,
                        })
                            .catch(() => { });
                    }
                }
                if (issue.aiCaseId) {
                    await supabase
                        .from('visit_ai_recommendations')
                        .update({ recommendation_record_id: row.id })
                        .eq('visit_ai_case_id', issue.aiCaseId);
                }
                if (shouldApprove) {
                    void recommendationCommunicationService
                        .sendApprovedRecommendation(String(row.id))
                        .catch(() => ({ sent: false }));
                    if (issue.aiCaseId && !partnerId) {
                        const { data: qaRows } = await supabase
                            .from('visit_ai_questions')
                            .select('question_text, answer, metadata')
                            .eq('visit_ai_case_id', issue.aiCaseId);
                        const intakeQa = (qaRows ?? [])
                            .filter((q) => q.answer)
                            .map((q) => ({
                            question: String(q.question_text),
                            answer: String(q.answer),
                            kind: q.metadata?.kind,
                        }));
                        const { data: farmerRow } = await supabase
                            .from('farmers')
                            .select('district')
                            .eq('id', input.farmerId)
                            .maybeSingle();
                        const { expertFollowUpLearningService } = await import('../core/expert-follow-up-learning.service.js');
                        const sessionId = aiCaseRow?.ai_advisory_session_id
                            ? String(aiCaseRow.ai_advisory_session_id)
                            : issue.aiCaseId;
                        void expertFollowUpLearningService
                            .onCaseReviewApproved({
                            sessionId,
                            recommendationId: String(row.id),
                            farmerId: input.farmerId,
                            cropType: block.crop_type,
                            district: farmerRow?.district ? String(farmerRow.district).trim().toLowerCase() : null,
                            symptomsText: [issue.issueName, issue.observation].filter(Boolean).join(' '),
                            issueLabel: humanFinalLabel,
                            expertNotes: issue.agronomistReview?.modificationReason ?? null,
                            verifiedBy: agentEmail,
                            intakeQa,
                        })
                            .catch(() => { });
                    }
                }
                else if (reviewAction === 'escalate_urgent') {
                    const { createTelecallerTask } = await import('../whatsapp/pipeline/telecaller-tasks.service.js');
                    void createTelecallerTask({
                        farmerId: input.farmerId,
                        title: `Visit escalation: ${humanFinalLabel}`,
                        notes: issue.agronomistReview?.modificationReason ??
                            'Agronomist flagged urgent review on field visit',
                        priority: 'high',
                    }).catch(() => { });
                }
            }
        }
        if (!partnerId && input.sendVisitSummary !== false) {
            const approvedIssues = input.issues.filter((i) => {
                if (i.agronomistReview?.rejectReason === 'need_more_evidence')
                    return false;
                if (i.agronomistReview?.action === 'reject_recommendation' && !i.agronomistReview.rejectFlowComplete) {
                    return false;
                }
                return (i.agronomistReview?.action === 'approve_ai' ||
                    i.agronomistReview?.action === 'correct_ai' ||
                    i.agronomistReview?.action === 'partial_match' ||
                    (i.agronomistReview?.action === 'reject_recommendation' &&
                        i.agronomistReview.rejectFlowComplete));
            });
            if (approvedIssues.length) {
                const earliestReview = approvedIssues
                    .map((i) => i.reviewAfterDays ?? 7)
                    .sort((a, b) => a - b)[0];
                const reviewLabel = earliestReview
                    ? new Date(Date.now() + earliestReview * 86400000).toLocaleDateString('en-IN')
                    : undefined;
                void recommendationCommunicationService
                    .sendVisitSummary({
                    farmerId: input.farmerId,
                    blockName: block.name,
                    issueSummary,
                    approvedRecCount: approvedIssues.length,
                    reviewDateLabel: reviewLabel,
                })
                    .catch(() => ({ sent: false }));
            }
        }
        for (const fu of input.followUps ?? []) {
            const outcome = mapVisitFollowupToOutcome(fu.outcome);
            await outcomeReviewService.recordOutcome(fu.recommendationId, {
                outcome,
                notes: `[${fu.followed}] ${fu.notes ?? ''}`.trim(),
                issueResolved: fu.outcome === 'improved',
            }, agentEmail);
        }
        if (!partnerId) {
            const { visitCaseClosureService } = await import('../core/visit-case-closure.service.js');
            void visitCaseClosureService
                .closeCase({
                fieldFindingId: findingId,
                closedBy: agentEmail,
                learningConsent: true,
            })
                .catch(() => { });
        }
        return {
            findingId,
            finding: findingRow,
            issues: createdIssues,
            recommendationIds: createdRecs,
        };
    },
};
function mapReviewSeverity(severity) {
    if (severity === 'high')
        return 'severe';
    if (severity === 'medium')
        return 'moderate';
    return 'mild';
}
function resolveRecommendationGroups(input, createdIssues) {
    const issueIdByIndex = new Map(createdIssues.map((issue) => [issue.index, issue.id]));
    return (input.recommendationGroups ?? []).map((group, groupIndex) => ({
        applicationType: group.applicationType,
        applicationDay: group.applicationDay,
        sortOrder: group.sortOrder ?? groupIndex,
        materials: group.materials.map((material, materialIndex) => ({
            issueId: material.issueId ??
                (material.issueIndex != null ? issueIdByIndex.get(material.issueIndex) ?? null : null),
            category: material.category,
            technicalName: material.technicalName,
            dose: material.dose ?? null,
            method: material.method ?? null,
            relatedIssueId: material.relatedIssueId ??
                (material.relatedIssueIndex != null
                    ? issueIdByIndex.get(material.relatedIssueIndex) ?? null
                    : null),
            sortOrder: material.sortOrder ?? materialIndex,
        })),
    }));
}
async function resolveFieldTrainingAction(farmerId, issueName, observation) {
    const { data: sessions } = await supabase
        .from('ai_advisory_sessions')
        .select('id')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(5);
    const sessionIds = (sessions ?? []).map((s) => String(s.id));
    if (!sessionIds.length)
        return 'approve_ai';
    const { data: outputs } = await supabase
        .from('ai_advisory_outputs')
        .select('probable_issue')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(5);
    const aiLabel = outputs?.[0]?.probable_issue ? String(outputs[0].probable_issue).trim().toLowerCase() : '';
    const human = [issueName, observation?.trim()].filter(Boolean).join(' ').trim().toLowerCase();
    if (!aiLabel)
        return 'approve_ai';
    if (aiLabel === human || aiLabel === issueName.trim().toLowerCase())
        return 'approve_ai';
    if (aiLabel.includes(human) || human.includes(aiLabel))
        return 'partial_match';
    return 'correct_ai';
}
//# sourceMappingURL=field-visit.service.js.map