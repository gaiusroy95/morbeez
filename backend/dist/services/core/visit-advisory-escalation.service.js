import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { leadService } from '../crm/lead.service.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
const REASON_TITLES = {
    outcome_worse: 'Urgent — crop condition worsened',
    outcome_no_whatsapp_response: 'Outcome follow-up — no WhatsApp response',
    recommendation_not_applied: 'Recommendation follow-up — not applied',
    disease_progression: 'Field monitoring — disease progression',
};
const REASON_PRIORITY = {
    outcome_worse: 'urgent',
    outcome_no_whatsapp_response: 'normal',
    recommendation_not_applied: 'high',
    disease_progression: 'urgent',
};
function reasonTag(reason) {
    return `[visit:${reason}]`;
}
export const visitAdvisoryEscalationService = {
    async escalate(params) {
        const tag = reasonTag(params.reason);
        const title = REASON_TITLES[params.reason];
        const priority = params.priority ?? REASON_PRIORITY[params.reason];
        const noteParts = [
            tag,
            params.issueLabel ? `Issue: ${params.issueLabel}` : null,
            params.fieldFindingId ? `Finding ${params.fieldFindingId.slice(0, 8)}` : null,
            params.recommendationRecordId ? `Rec ${params.recommendationRecordId.slice(0, 8)}` : null,
            params.notes?.trim() || null,
        ].filter(Boolean);
        const telecallerNotes = noteParts.join(' | ').slice(0, 500);
        const { count: existingCallbacks } = await supabase
            .from('callback_requests')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', params.farmerId)
            .eq('status', 'pending')
            .ilike('telecaller_notes', `${tag}%`);
        if ((existingCallbacks ?? 0) > 0) {
            logger.info({ farmerId: params.farmerId, reason: params.reason }, 'Visit escalation skipped — pending callback exists');
            return { callbackId: null, taskCreated: false };
        }
        const { data: callbackRow, error: callbackErr } = await supabase
            .from('callback_requests')
            .insert({
            farmer_id: params.farmerId,
            lead_id: params.leadId ?? null,
            preferred_time: 'any',
            status: 'pending',
            telecaller_notes: telecallerNotes,
        })
            .select('id')
            .single();
        if (callbackErr) {
            logger.warn({ err: callbackErr.message, reason: params.reason }, 'Visit callback insert failed');
        }
        await createTelecallerTask({
            farmerId: params.farmerId,
            leadId: params.leadId ?? undefined,
            title,
            notes: telecallerNotes,
            priority,
        });
        if (priority === 'high' || priority === 'urgent') {
            await leadService.ensureLeadForFarmer({
                farmerId: params.farmerId,
                intent: 'callback',
                source: 'field_visit_escalation',
                status: 'new',
                priority,
                stage: 'follow_up',
                notes: telecallerNotes,
                mergeNotes: true,
            });
        }
        return {
            callbackId: callbackRow?.id ? String(callbackRow.id) : null,
            taskCreated: true,
        };
    },
    async processMonitoringProgressionJob(job) {
        const fieldFindingId = String(job.payload.fieldFindingId ?? '');
        const visitIssueId = String(job.payload.visitIssueId ?? '');
        if (!fieldFindingId || !visitIssueId) {
            logger.warn({ payload: job.payload }, 'Monitoring progression job missing ids');
            return;
        }
        const progressionConfirmed = Boolean(job.payload.diseaseProgression ?? job.payload.progressionConfirmed);
        if (!progressionConfirmed)
            return;
        const { data: issue } = await supabase
            .from('visit_issues')
            .select('id, issue_name, severity, field_finding_id')
            .eq('id', visitIssueId)
            .eq('field_finding_id', fieldFindingId)
            .maybeSingle();
        if (!issue || String(issue.severity) !== 'high')
            return;
        const { data: finding } = await supabase
            .from('crm_field_findings')
            .select('farmer_id, lead_id')
            .eq('id', fieldFindingId)
            .maybeSingle();
        const farmerId = finding?.farmer_id ? String(finding.farmer_id) : job.farmer_id;
        await this.escalate({
            farmerId,
            reason: 'disease_progression',
            fieldFindingId,
            visitIssueId,
            issueLabel: String(issue.issue_name),
            leadId: finding?.lead_id ? String(finding.lead_id) : null,
            notes: job.payload.notes ? String(job.payload.notes) : 'High severity issue progressed during monitoring',
        });
    },
    async processEscalationJob(job) {
        const reason = job.payload.reason;
        if (!reason || !(reason in REASON_TITLES)) {
            logger.warn({ payload: job.payload }, 'Visit escalation job missing valid reason');
            return;
        }
        await this.escalate({
            farmerId: job.farmer_id,
            reason,
            fieldFindingId: job.payload.fieldFindingId ? String(job.payload.fieldFindingId) : null,
            recommendationRecordId: job.payload.recommendationRecordId
                ? String(job.payload.recommendationRecordId)
                : null,
            visitIssueId: job.payload.visitIssueId ? String(job.payload.visitIssueId) : null,
            issueLabel: job.payload.issueLabel ? String(job.payload.issueLabel) : null,
            notes: job.payload.notes ? String(job.payload.notes) : null,
            leadId: job.payload.leadId ? String(job.payload.leadId) : null,
        });
    },
    async scheduleEscalationJob(params) {
        await supabase.from('advisory_automation_jobs').insert({
            farmer_id: params.farmerId,
            session_id: params.sessionId ?? null,
            job_type: 'visit_callback_escalation',
            scheduled_at: params.scheduledAt ?? new Date().toISOString(),
            payload: {
                reason: params.reason,
                ...params.payload,
            },
        });
    },
};
//# sourceMappingURL=visit-advisory-escalation.service.js.map