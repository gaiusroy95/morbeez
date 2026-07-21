import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
import { buildGingerRecoveryCheckInBody, resolveRecoveryCheckInCondition, } from '../case/recovery-checkin-copy.js';
function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}
const RECOVERY_DAYS = [3, 7, 14];
export const gingerSopFollowUpService = {
    enabled() {
        return env.ENABLE_GINGER_SOP_V3 !== false;
    },
    async scheduleRecoveryLoop(params) {
        if (!this.enabled())
            return;
        const issueLabel = params.issueLabel?.trim() ||
            (await resolveRecoveryCheckInCondition({
                sessionId: params.sessionId,
                recommendationRecordId: params.recommendationRecordId,
            }));
        for (const day of RECOVERY_DAYS) {
            await supabase.from('advisory_automation_jobs').insert({
                farmer_id: params.farmerId,
                session_id: params.sessionId,
                job_type: `ginger_sop_recovery_d${day}`,
                scheduled_at: addDays(day),
                payload: {
                    sessionId: params.sessionId,
                    day,
                    language: params.language,
                    recommendationRecordId: params.recommendationRecordId ?? null,
                    sopVersion: '3.0',
                    issueLabel: issueLabel ?? null,
                },
            });
        }
    },
    async processRecoveryJob(job) {
        const day = Number(job.payload.day ?? 0);
        const lang = String(job.payload.language ?? 'en');
        const sessionId = String(job.payload.sessionId ?? '');
        const { data: farmer } = await supabase
            .from('farmers')
            .select('phone')
            .eq('id', job.farmer_id)
            .maybeSingle();
        if (!farmer?.phone)
            return;
        const condition = await resolveRecoveryCheckInCondition({
            sessionId,
            recommendationRecordId: job.payload.recommendationRecordId
                ? String(job.payload.recommendationRecordId)
                : null,
            issueLabelHint: job.payload.issueLabel ? String(job.payload.issueLabel) : null,
        });
        const body = buildGingerRecoveryCheckInBody({ lang, day, condition });
        try {
            await whatsappService.sendButtons({
                to: farmer.phone,
                body,
                buttons: [
                    { id: `ginger.recovery.d${day}.improved`, title: 'Improved' },
                    { id: `ginger.recovery.d${day}.same`, title: 'Same' },
                    { id: `ginger.recovery.d${day}.worse`, title: 'Worse' },
                ],
            });
        }
        catch (err) {
            logger.warn({ err, day, sessionId }, 'Ginger SOP recovery buttons failed — text fallback');
            await whatsappService.sendText(farmer.phone, `${body}\n\nReply: Improved / Same / Worse`);
        }
        const recId = job.payload.recommendationRecordId;
        if (recId) {
            await supabase
                .from('recommendation_follow_ups')
                .insert({
                recommendation_record_id: String(recId),
                farmer_id: job.farmer_id,
                phase: 'outcome_check',
                status: 'sent',
                scheduled_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
                metadata: {
                    gingerSopRecoveryDay: day,
                    sessionId,
                    sopVersion: '3.0',
                    issueLabel: condition,
                },
            })
                .then(({ error }) => {
                if (error)
                    logger.warn({ error, day }, 'Ginger recovery follow-up row insert skipped');
            });
        }
    },
    async handleRecoveryReply(params) {
        if (params.outcome === 'worse') {
            await createTelecallerTask({
                farmerId: params.farmerId,
                title: 'Ginger SOP — no recovery',
                notes: `Day ${params.day} recovery check: farmer reported WORSE. Session ${params.sessionId ?? 'n/a'}`,
                priority: 'urgent',
            });
            return 'Thank you. We marked this as urgent — our agronomist team will contact you soon.';
        }
        if (params.outcome === 'same' && params.day >= 7) {
            await createTelecallerTask({
                farmerId: params.farmerId,
                title: 'Ginger SOP — stagnant recovery',
                notes: `Day ${params.day}: no improvement reported.`,
                priority: 'high',
            });
            return 'Thank you. Since improvement is limited, our team will review and suggest the next step.';
        }
        return params.day < 14
            ? 'Thank you. We will check again on the next follow-up day.'
            : 'Thank you for the update. Send a fresh photo anytime if symptoms change.';
    },
};
//# sourceMappingURL=ginger-sop-follow-up.service.js.map