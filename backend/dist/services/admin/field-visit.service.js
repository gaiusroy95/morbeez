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
            createdIssues.push({ id: visitIssueId, issueName: issue.issueName });
            if (issue.photos?.length) {
                const urls = await fieldStorageService.uploadPhotos(input.farmerId, issue.photos);
                for (let pi = 0; pi < urls.length; pi++) {
                    await supabase.from('issue_photos').insert({
                        visit_issue_id: visitIssueId,
                        storage_path: urls[pi],
                        public_url: urls[pi],
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
            if (!partnerId) {
                void aiTrainingEventService
                    .record({
                    farmerId: input.farmerId,
                    blockId: input.blockId,
                    fieldFindingId: findingId,
                    source: 'field_visit',
                    reviewSurface: 'field_finding',
                    aiPrediction: issue.issueName,
                    humanAction,
                    humanFinalLabel: issue.issueName,
                    reviewedBy: agentEmail,
                    metadata: { visitIssueId, category: issue.category, severity: issue.severity },
                })
                    .catch(() => { });
            }
            for (const rec of issue.recommendations ?? []) {
                if (!rec.text.trim())
                    continue;
                const reviewDate = rec.reviewDate
                    ? new Date(rec.reviewDate)
                    : new Date(Date.now() + (rec.reviewAfterDays ?? 7) * 86400000);
                const row = await recommendationRecordsService.create({
                    farmerId: input.farmerId,
                    blockId: input.blockId,
                    leadId: leadId ?? undefined,
                    fieldFindingId: findingId,
                    visitIssueId: visitIssueId,
                    source: 'field_finding',
                    issueDetected: issue.issueName,
                    recommendationText: rec.text.trim(),
                    severity: issue.severity,
                    createdBy: agentEmail,
                    status: partnerId ? 'draft' : 'approved',
                });
                createdRecs.push(String(row.id));
                await supabase
                    .from('recommendation_records')
                    .update({
                    metadata: {
                        recommendationType: rec.recommendationType ?? 'other',
                        priority: rec.priority ?? 'normal',
                        reviewDate: reviewDate.toISOString(),
                        fieldRecStatus: partnerId ? 'pending_expert_review' : rec.status ?? 'open',
                        partnerSubmitted: Boolean(partnerId),
                    },
                })
                    .eq('id', row.id);
                if (!partnerId) {
                    void recommendationCommunicationService
                        .sendApprovedRecommendation(String(row.id))
                        .catch(() => ({ sent: false }));
                }
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