import { supabase } from '../../lib/supabase.js';
import { NotFoundError } from '../../lib/errors.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { recommendationRecordsService } from './recommendation-records.service.js';
import { recommendationFollowUpService } from './recommendation-follow-up.service.js';
import { learningLoopService } from './learning-loop.service.js';
function mapOutcomeToLearning(outcome) {
    if (outcome === 'better')
        return 'improved';
    if (outcome === 'partial')
        return 'partial';
    if (outcome === 'no_improvement')
        return 'no_improvement';
    return 'unknown';
}
function mapRow(r) {
    const farmer = r.farmers;
    const block = r.farm_blocks;
    return {
        id: String(r.id),
        farmerId: String(r.farmer_id),
        blockId: r.block_id ? String(r.block_id) : null,
        aiSessionId: r.ai_session_id ? String(r.ai_session_id) : null,
        issueDetected: r.issue_detected ? String(r.issue_detected) : null,
        recommendationText: String(r.recommendation_text ?? ''),
        dosage: r.dosage ? String(r.dosage) : null,
        status: String(r.status),
        applicationStatus: r.application_status ? String(r.application_status) : null,
        outcome: r.outcome ? String(r.outcome) : null,
        outcomeNotes: r.outcome_notes ? String(r.outcome_notes) : null,
        recoveryDays: r.recovery_days != null ? Number(r.recovery_days) : null,
        issueResolved: r.issue_resolved != null ? Boolean(r.issue_resolved) : null,
        communicatedAt: r.communicated_at ? String(r.communicated_at) : null,
        appliedAt: r.applied_at ? String(r.applied_at) : null,
        outcomeAt: r.outcome_at ? String(r.outcome_at) : null,
        dapAtRecommendation: r.dap_at_recommendation != null ? Number(r.dap_at_recommendation) : null,
        source: r.source ? String(r.source) : null,
        createdAt: String(r.created_at),
        outcomeKpi: r.outcome_kpi ?? null,
        needsHumanOutcomeReview: Boolean(r.needs_human_outcome_review),
        humanOutcomeReviewReason: r.human_outcome_review_reason
            ? String(r.human_outcome_review_reason)
            : null,
        farmer: farmer
            ? {
                name: farmer.name ? String(farmer.name) : null,
                phone: farmer.phone ? String(farmer.phone) : null,
                district: farmer.district ? String(farmer.district) : null,
            }
            : null,
        block: block
            ? {
                name: String(block.name ?? 'Block'),
                cropType: String(block.crop_type ?? '—'),
                plotLabel: block.plot_label ? String(block.plot_label) : null,
            }
            : null,
        pendingFollowUp: null,
    };
}
export const outcomeReviewService = {
    async listQueue(params) {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(50, Math.max(1, params.limit ?? 24));
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const filter = params.filter ?? 'pending';
        let query = supabase
            .from('recommendation_records')
            .select(`id, farmer_id, block_id, ai_session_id, issue_detected, recommendation_text, dosage,
         status, application_status, outcome, outcome_notes, recovery_days, issue_resolved,
         communicated_at, applied_at, outcome_at, dap_at_recommendation, source, created_at,
         outcome_kpi, needs_human_outcome_review, human_outcome_review_reason,
         farmers(name, phone, district), farm_blocks(name, crop_type, plot_label)`, { count: 'exact' })
            .order('communicated_at', { ascending: false, nullsFirst: false })
            .range(from, to);
        if (filter === 'pending') {
            query = query.in('status', ['communicated', 'applied']).is('outcome', null);
        }
        else if (filter === 'overdue') {
            const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
            query = query
                .in('status', ['communicated', 'applied'])
                .is('outcome', null)
                .lte('applied_at', cutoff);
        }
        else if (filter === 'needs_review') {
            query = query.eq('needs_human_outcome_review', true).is('outcome', null);
        }
        else {
            query = query.eq('status', 'outcome_recorded');
        }
        const { data, error, count } = await query;
        throwIfSupabaseError(error, 'Could not load outcome review queue');
        const recIds = (data ?? []).map((r) => String(r.id));
        let followUpByRec = new Map();
        if (recIds.length) {
            const { data: followUps } = await supabase
                .from('recommendation_follow_ups')
                .select('id, recommendation_record_id, phase, status, scheduled_at, farmer_response')
                .in('recommendation_record_id', recIds)
                .eq('phase', 'outcome_check')
                .order('created_at', { ascending: false });
            for (const fu of followUps ?? []) {
                const rid = String(fu.recommendation_record_id);
                if (!followUpByRec.has(rid))
                    followUpByRec.set(rid, fu);
            }
        }
        const items = (data ?? []).map((row) => {
            const mapped = mapRow(row);
            const fu = followUpByRec.get(mapped.id);
            if (fu) {
                mapped.pendingFollowUp = {
                    id: String(fu.id),
                    phase: String(fu.phase),
                    status: String(fu.status),
                    scheduledAt: String(fu.scheduled_at),
                    farmerResponse: fu.farmer_response ? String(fu.farmer_response) : null,
                };
            }
            return mapped;
        });
        const { count: pendingCount } = await supabase
            .from('recommendation_records')
            .select('id', { count: 'exact', head: true })
            .in('status', ['communicated', 'applied'])
            .is('outcome', null);
        return {
            items,
            pagination: {
                page,
                limit,
                total: count ?? 0,
                pages: Math.max(1, Math.ceil((count ?? 0) / limit)),
            },
            pendingCount: pendingCount ?? 0,
        };
    },
    async getDetail(recommendationId) {
        const rec = await recommendationFollowUpService.loadRecord(recommendationId);
        if (!rec)
            throw new NotFoundError('Recommendation not found');
        const detail = await recommendationFollowUpService.getTelecallerFollowUpDetail(recommendationId);
        const { data: row } = await supabase
            .from('recommendation_records')
            .select(`*, farmers(name, phone, district, preferred_language), farm_blocks(name, crop_type, plot_label)`)
            .eq('id', recommendationId)
            .maybeSingle();
        if (!row)
            throw new NotFoundError('Recommendation not found');
        const mapped = mapRow(row);
        const fu = (detail?.followUps ?? []).find((f) => f.phase === 'outcome_check');
        if (fu) {
            mapped.pendingFollowUp = {
                id: String(fu.id),
                phase: String(fu.phase),
                status: String(fu.status),
                scheduledAt: String(fu.scheduled_at),
                farmerResponse: fu.farmer_response ? String(fu.farmer_response) : null,
            };
        }
        return {
            recommendation: mapped,
            application: detail?.application ?? null,
            followUps: detail?.followUps ?? [],
            session: detail?.session ?? null,
        };
    },
    async recordOutcome(recommendationId, input, agentEmail) {
        const rec = await recommendationFollowUpService.loadRecord(recommendationId);
        if (!rec)
            throw new NotFoundError('Recommendation not found');
        const issueResolved = input.issueResolved ?? (input.outcome === 'better' || input.outcome === 'partial');
        const row = await recommendationRecordsService.recordOutcome(recommendationId, input.outcome, {
            notes: input.notes,
            recoveryDays: input.recoveryDays,
            farmerFeedback: input.farmerFeedback,
            agronomistFeedback: input.agronomistFeedback,
            issueResolved,
            recordedBy: agentEmail,
        });
        await supabase
            .from('recommendation_records')
            .update({
            needs_human_outcome_review: false,
            human_outcome_review_reason: null,
            outcome_source: 'agronomist',
            updated_at: new Date().toISOString(),
        })
            .eq('id', recommendationId);
        const now = new Date().toISOString();
        await supabase
            .from('recommendation_follow_ups')
            .update({
            status: 'completed',
            farmer_response: input.outcome === 'better'
                ? 'improved'
                : input.outcome === 'partial'
                    ? 'partial'
                    : input.outcome === 'no_improvement'
                        ? 'no_improvement'
                        : null,
            responded_at: now,
            updated_at: now,
        })
            .eq('recommendation_record_id', recommendationId)
            .eq('phase', 'outcome_check')
            .in('status', ['scheduled', 'sent', 'responded']);
        const learningOutcome = mapOutcomeToLearning(input.outcome);
        await recommendationFollowUpService.upsertLearningSample(rec, {
            applicationConfirmed: rec.status === 'applied' ||
                rec.status === 'outcome_recorded' ||
                input.outcome !== 'unknown',
            outcome: learningOutcome,
            escalated: input.outcome === 'no_improvement',
        });
        if (input.outcome === 'better' || input.outcome === 'partial') {
            await learningLoopService.onLearningSampleReady(recommendationId).catch(() => { });
        }
        const recFieldFindingId = rec.field_finding_id;
        if (recFieldFindingId) {
            const { visitCaseClosureService } = await import('./visit-case-closure.service.js');
            void visitCaseClosureService
                .emitTrainingEventForRecommendation(recommendationId, agentEmail)
                .catch(() => { });
        }
        return row;
    },
};
//# sourceMappingURL=outcome-review.service.js.map