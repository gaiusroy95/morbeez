import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { failureAnalysisService } from './failure-analysis.service.js';
import { executionVerificationService } from './execution-verification.service.js';
import { regionalLearningService } from '../regional-learning/regional-learning.service.js';
import { goldLearningQueueService } from '../ml/retraining-pipeline.service.js';
function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}
export const recoveryValidationService = {
    enabled() {
        return env.ENABLE_MAIOS_V12 !== false;
    },
    async scheduleRecoveryLoop(params) {
        if (!this.enabled())
            return;
        const pack = await cropPackLoaderService.load(params.cropType);
        const days = pack.recoveryDays.length ? pack.recoveryDays : [3, 7, 14];
        for (const day of days) {
            await supabase.from('advisory_automation_jobs').insert({
                farmer_id: params.farmerId,
                session_id: params.sessionId,
                job_type: `maios_recovery_d${day}`,
                scheduled_at: addDays(day),
                payload: {
                    sessionId: params.sessionId,
                    day,
                    language: params.language,
                    recommendationRecordId: params.recommendationRecordId,
                    cropType: params.cropType,
                    sopVersion: pack.version,
                },
            });
        }
    },
    async processRecoveryJobSend(job) {
        const day = Number(job.payload.day ?? 0);
        const lang = String(job.payload.language ?? 'en');
        const sessionId = String(job.payload.sessionId ?? '');
        const cropType = String(job.payload.cropType ?? '_default');
        const pack = await cropPackLoaderService.load(cropType);
        const { data: farmer } = await supabase
            .from('farmers')
            .select('phone')
            .eq('id', job.farmer_id)
            .maybeSingle();
        if (!farmer?.phone)
            return;
        const body = lang === 'ml'
            ? `MAIOS (${pack.displayName}) — ദിവസം ${day}: ഇപ്പോൾ വിളയുടെ നില എങ്ങനെയാണ്?`
            : `MAIOS (${pack.displayName}) check-in — Day ${day}: How is the crop now?`;
        try {
            await whatsappService.sendButtons({
                to: farmer.phone,
                body,
                buttons: [
                    { id: `maios.recovery.d${day}.improved`, title: 'Improved' },
                    { id: `maios.recovery.d${day}.same`, title: 'Same' },
                    { id: `maios.recovery.d${day}.worse`, title: 'Worse' },
                ],
            });
        }
        catch (err) {
            logger.warn({ err, day, sessionId }, 'MAIOS recovery buttons failed — text fallback');
            await whatsappService.sendText(farmer.phone, `${body}\n\nReply: Improved / Same / Worse`);
        }
        const recId = job.payload.recommendationRecordId;
        if (recId && day === 3) {
            const verification = await executionVerificationService.verify({
                farmerId: job.farmer_id,
                sessionId,
                recommendationRecordId: String(recId),
            });
            if (sessionId) {
                const { data: session } = await supabase
                    .from('ai_advisory_sessions')
                    .select('metadata')
                    .eq('id', sessionId)
                    .maybeSingle();
                const meta = session?.metadata ?? {};
                const maiosCase = meta.maiosCase ?? {};
                await supabase
                    .from('ai_advisory_sessions')
                    .update({
                    metadata: {
                        ...meta,
                        maiosCase: { ...maiosCase, executionVerification: verification },
                    },
                })
                    .eq('id', sessionId);
            }
        }
        if (recId) {
            await supabase.from('recommendation_follow_ups').insert({
                recommendation_record_id: String(recId),
                phase: 'outcome_check',
                channel: 'whatsapp',
                metadata: { maiosRecoveryDay: day, sessionId },
            }).then(({ error }) => {
                if (error)
                    logger.warn({ error, day }, 'MAIOS recovery follow-up row insert skipped');
            });
        }
    },
    async handleRecoveryReply(params) {
        let maiosCase = null;
        let recommendationRecordId = null;
        if (params.sessionId) {
            const { data: session } = await supabase
                .from('ai_advisory_sessions')
                .select('metadata, corrected, human_reviewed')
                .eq('id', params.sessionId)
                .maybeSingle();
            const meta = session?.metadata ?? {};
            maiosCase = meta.maiosCase ?? null;
            const outcomes = Array.isArray(maiosCase?.outcomes) ? [...maiosCase.outcomes] : [];
            outcomes.push({
                day: params.day,
                status: params.outcome,
                at: new Date().toISOString(),
            });
            const { data: rec } = await supabase
                .from('recommendation_records')
                .select('id')
                .eq('ai_session_id', params.sessionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            recommendationRecordId = rec?.id ? String(rec.id) : null;
            let executionVerification = maiosCase?.executionVerification;
            if (!executionVerification && recommendationRecordId) {
                executionVerification = await executionVerificationService.verify({
                    farmerId: params.farmerId,
                    sessionId: params.sessionId,
                    recommendationRecordId,
                });
            }
            const failureType = params.outcome !== 'improved'
                ? failureAnalysisService.classify({
                    outcomeStatus: params.outcome,
                    agronomistCorrected: Boolean(session?.corrected || session?.human_reviewed),
                    applicationLogged: Boolean(executionVerification?.checks.includes('application_logged')),
                    fusedConfidence: maiosCase?.diagnostics?.fusedConfidence,
                })
                : null;
            const updatedCase = {
                ...(maiosCase ?? {}),
                outcomes,
                executionVerification,
                failureType,
            };
            await supabase
                .from('ai_advisory_sessions')
                .update({
                metadata: { ...meta, maiosCase: updatedCase },
                updated_at: new Date().toISOString(),
            })
                .eq('id', params.sessionId);
            if (failureType && params.sessionId) {
                const { data: farmer } = await supabase
                    .from('farmers')
                    .select('district')
                    .eq('id', params.farmerId)
                    .maybeSingle();
                await goldLearningQueueService.enqueue({
                    sessionId: params.sessionId,
                    cropType: maiosCase?.identity?.cropType,
                    district: farmer?.district ? String(farmer.district) : undefined,
                    failureType,
                    metadata: { recoveryDay: params.day, outcome: params.outcome },
                });
            }
            if (params.day >= 14 && maiosCase?.identity?.cropType && maiosCase.regionalClusterId) {
                const district = maiosCase.regionalClusterId.split(':')[1] ?? '';
                const issue = maiosCase.diagnostics?.primary ?? 'unknown';
                const protocolKey = recommendationRecordId ?? 'whatsapp_recovery';
                if (district) {
                    await regionalLearningService.recordProtocolOutcome({
                        district,
                        cropType: maiosCase.identity.cropType,
                        issueLabel: issue,
                        protocolKey,
                        success: params.outcome === 'improved',
                    });
                }
            }
        }
        if (params.outcome === 'worse') {
            await createTelecallerTask({
                farmerId: params.farmerId,
                title: 'MAIOS — no recovery',
                notes: `Day ${params.day} recovery check: farmer reported WORSE. Session ${params.sessionId ?? 'n/a'}`,
                priority: 'urgent',
            });
            return 'Thank you. We marked this as urgent — our agronomist team will contact you soon.';
        }
        if (params.outcome === 'same' && params.day >= 7) {
            await createTelecallerTask({
                farmerId: params.farmerId,
                title: 'MAIOS — stagnant recovery',
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
//# sourceMappingURL=recovery-validation.service.js.map