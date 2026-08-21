import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ValidationError } from '../../lib/errors.js';
import { evaluateCallingWindow } from '../../domain/ai-calling/calling-window.js';
import { matchProtocolForDap, daysAfterPlanting } from '../../domain/ai-calling/crop-protocol.js';
import { detectCallLanguage, normalizeCallLanguage } from '../../domain/ai-calling/language-detect.js';
import { parseFarmerIntent } from '../../domain/ai-calling/intent.js';
import { assertNoPrescription } from '../../domain/ai-calling/no-prescribe.js';
import { scoreQualification } from '../../domain/ai-calling/qualification-score.js';
import { escalationLadderStep, nextHealthFollowUpDays, resolveCallAction } from '../../domain/ai-calling/rule-engine.js';
import { buildCallScript } from '../../domain/ai-calling/scripts.js';
import { createCropAdvisorTask } from '../whatsapp/pipeline/crop-advisor-tasks.service.js';
import { callingTelephonyProvider } from './providers/telephony.provider.js';
function enabled() {
    return env.ENABLE_AI_CALLING !== false;
}
function whatsappFallbackOn() {
    return env.AI_CALLING_WHATSAPP_FALLBACK !== false;
}
async function loadPrefs(farmerId) {
    const { data, error } = await supabase
        .from('farmer_call_preferences')
        .select('*')
        .eq('farmer_id', farmerId)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not load call preferences');
    return data;
}
async function ensurePrefs(farmerId, farmerLang) {
    const existing = await loadPrefs(farmerId);
    if (existing)
        return existing;
    const { data, error } = await supabase
        .from('farmer_call_preferences')
        .insert({
        farmer_id: farmerId,
        preferred_language: normalizeCallLanguage(farmerLang),
        language_source: 'farmer_profile',
    })
        .select('*')
        .maybeSingle();
    if (error && error.code !== '23505')
        throwIfSupabaseError(error, 'Could not create call preferences');
    return data ?? (await loadPrefs(farmerId));
}
async function loadFarmer(farmerId) {
    const { data, error } = await supabase
        .from('farmers')
        .select('id, phone, name, preferred_language, district, state, village, assigned_crop_advisor')
        .eq('id', farmerId)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not load farmer');
    return data;
}
async function loadIdentities() {
    const { data, error } = await supabase
        .from('agronomist_call_identities')
        .select('id, slot_number, agronomist_email, display_name, did_number, backup_identity_id, is_active')
        .order('slot_number', { ascending: true });
    throwIfSupabaseError(error, 'Could not load call identities');
    return (data ?? []);
}
async function resolveIdentity(farmer, prefs) {
    const identities = await loadIdentities();
    const active = identities.filter((i) => i.is_active);
    const ownerEmail = String(farmer.assigned_crop_advisor ?? prefs?.assigned_agronomist_email ?? '')
        .trim()
        .toLowerCase();
    const stickyId = prefs?.assigned_identity_id ? String(prefs.assigned_identity_id) : '';
    const sticky = active.find((i) => i.id === stickyId);
    if (sticky)
        return sticky;
    if (ownerEmail) {
        const owned = active.find((i) => (i.agronomist_email ?? '').toLowerCase() === ownerEmail);
        if (owned)
            return owned;
    }
    const { data: least } = await supabase
        .from('agronomist_call_identities')
        .select('id, slot_number, agronomist_email, display_name, did_number, backup_identity_id, is_active, last_assigned_at')
        .eq('is_active', true)
        .order('last_assigned_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .maybeSingle();
    return least ?? active[0] ?? null;
}
async function loadProtocols() {
    const { data, error } = await supabase
        .from('crop_call_protocols')
        .select('crop_type, stage_key, stage_label, dap_from, dap_to, prompt_kind, question_en, follow_up_hours_if_no, health_follow_up_days')
        .eq('is_active', true);
    throwIfSupabaseError(error, 'Could not load crop call protocols');
    return (data ?? []).map((row) => ({
        cropType: String(row.crop_type),
        stageKey: String(row.stage_key),
        stageLabel: String(row.stage_label),
        dapFrom: Number(row.dap_from),
        dapTo: Number(row.dap_to),
        promptKind: row.prompt_kind,
        questionEn: String(row.question_en),
        followUpHoursIfNo: Number(row.follow_up_hours_if_no ?? 24),
        healthFollowUpDays: Array.isArray(row.health_follow_up_days)
            ? row.health_follow_up_days
            : [1, 3, 7],
    }));
}
function snapshotOutcome(parts) {
    return {
        ...parts,
        frozenAt: new Date().toISOString(),
    };
}
export const aiCallingOrchestrator = {
    enabled,
    async enqueue(input) {
        if (!enabled())
            return null;
        const dedupeKey = String(input.payload?.dedupeKey ?? '');
        let existingQuery = supabase
            .from('ai_call_jobs')
            .select('id')
            .eq('farmer_id', input.farmerId)
            .eq('call_type', input.callType)
            .in('status', ['pending', 'calling', 'awaiting_reply', 'queued_for_agent']);
        existingQuery = dedupeKey
            ? existingQuery.contains('payload', { dedupeKey })
            : existingQuery;
        const { data: existing } = await existingQuery.maybeSingle();
        if (existing?.id) {
            return { id: String(existing.id), reused: true };
        }
        const { data, error } = await supabase
            .from('ai_call_jobs')
            .insert({
            farmer_id: input.farmerId,
            lead_id: input.leadId ?? null,
            call_type: input.callType,
            status: 'pending',
            scheduled_at: (input.scheduledAt ?? new Date()).toISOString(),
            language: input.language ?? null,
            payload: input.payload ?? {},
        })
            .select('id')
            .maybeSingle();
        if (error?.code === '23505') {
            const { data: again } = await supabase
                .from('ai_call_jobs')
                .select('id')
                .eq('farmer_id', input.farmerId)
                .eq('call_type', input.callType)
                .in('status', ['pending', 'calling', 'awaiting_reply', 'queued_for_agent'])
                .maybeSingle();
            if (again?.id)
                return { id: String(again.id), reused: true };
        }
        throwIfSupabaseError(error, 'Could not enqueue AI call job');
        if (!data?.id)
            return null;
        return { id: String(data.id), reused: false };
    },
    async processDueJobs(limit = 10) {
        if (!enabled())
            return 0;
        const { data, error } = await supabase
            .from('ai_call_jobs')
            .select('id')
            .in('status', ['pending', 'skipped_window'])
            .lte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not list due AI call jobs');
        let n = 0;
        for (const row of data ?? []) {
            try {
                await this.processJob(String(row.id));
                n += 1;
            }
            catch (err) {
                logger.warn({ err, jobId: row.id }, 'AI call job failed');
            }
        }
        return n;
    },
    async processJob(jobId) {
        const { data: job, error } = await supabase.from('ai_call_jobs').select('*').eq('id', jobId).maybeSingle();
        throwIfSupabaseError(error, 'Could not load AI call job');
        if (!job)
            return;
        if (!['pending', 'skipped_window'].includes(String(job.status)))
            return;
        const farmer = await loadFarmer(String(job.farmer_id));
        if (!farmer?.phone) {
            await supabase
                .from('ai_call_jobs')
                .update({ status: 'failed', last_error: 'Farmer phone missing', updated_at: new Date().toISOString() })
                .eq('id', jobId);
            return;
        }
        const prefs = await ensurePrefs(String(job.farmer_id), String(farmer.preferred_language ?? 'en'));
        const payload = (job.payload ?? {});
        const staffInitiated = payload.staffInitiated === true;
        const window = evaluateCallingWindow(new Date(), {
            dnd: Boolean(prefs?.dnd),
            optedOut: Boolean(prefs?.opted_out_at),
            consentOutboundCall: Boolean(prefs?.consent_outbound_call),
            staffInitiated,
        });
        if (window.reason === 'dnd' || window.reason === 'opted_out') {
            await supabase
                .from('ai_call_jobs')
                .update({
                status: 'skipped_dnd',
                last_error: window.reason,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', jobId);
            return;
        }
        if (window.reason === 'no_consent') {
            await supabase
                .from('ai_call_jobs')
                .update({
                status: 'queued_for_agent',
                last_error: 'no_consent_outbound_call',
                updated_at: new Date().toISOString(),
            })
                .eq('id', jobId);
            await this.openStaffScriptSession({
                job,
                farmer,
                prefs,
                channel: 'staff_script',
                note: 'No outbound-call consent — queued for assigned agronomist / cropAdvisor',
            });
            return;
        }
        if (window.reason === 'quiet_hours' && window.nextAllowedAt) {
            await supabase
                .from('ai_call_jobs')
                .update({
                status: 'skipped_window',
                scheduled_at: window.nextAllowedAt.toISOString(),
                last_error: 'quiet_hours',
                updated_at: new Date().toISOString(),
            })
                .eq('id', jobId);
            return;
        }
        const identity = await resolveIdentity(farmer, prefs);
        const language = normalizeCallLanguage(String(job.language ?? prefs?.preferred_language ?? farmer.preferred_language ?? 'en'));
        if (identity) {
            await supabase
                .from('agronomist_call_identities')
                .update({ last_assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', identity.id);
            await supabase
                .from('farmer_call_preferences')
                .update({
                assigned_identity_id: identity.id,
                updated_at: new Date().toISOString(),
            })
                .eq('farmer_id', job.farmer_id);
        }
        await supabase
            .from('ai_call_jobs')
            .update({
            assigned_identity_id: identity?.id ?? null,
            assigned_agronomist_email: identity?.agronomist_email ?? farmer.assigned_crop_advisor ?? null,
            language,
            attempts: Number(job.attempts ?? 0) + 1,
            updated_at: new Date().toISOString(),
        })
            .eq('id', jobId);
        const voice = await callingTelephonyProvider.initiate({
            farmerPhone: String(farmer.phone),
            fromDid: identity?.did_number,
            farmerId: String(job.farmer_id),
            leadId: job.lead_id ? String(job.lead_id) : null,
            agentEmail: identity?.agronomist_email ?? 'ai-calling@morbeez',
        });
        if (voice.mode === 'voicebot' && voice.providerCallId) {
            await this.openStaffScriptSession({
                job: { ...job, language },
                farmer,
                prefs,
                channel: 'voice',
                identity,
                providerCallId: voice.providerCallId,
                note: 'Voicebot initiated',
            });
            await supabase
                .from('ai_call_jobs')
                .update({ status: 'calling', updated_at: new Date().toISOString() })
                .eq('id', jobId);
            return;
        }
        if (whatsappFallbackOn() && prefs?.consent_whatsapp !== false) {
            const delivered = await this.deliverWhatsApp({
                job: { ...job, language },
                farmer,
                identity,
            });
            if (delivered) {
                await supabase
                    .from('ai_call_jobs')
                    .update({ status: 'awaiting_reply', updated_at: new Date().toISOString() })
                    .eq('id', jobId);
                return;
            }
        }
        await this.openStaffScriptSession({
            job: { ...job, language },
            farmer,
            prefs,
            channel: 'staff_script',
            identity,
            note: 'Voicebot not configured — queued for human agronomist with script',
        });
        await supabase
            .from('ai_call_jobs')
            .update({
            status: 'queued_for_agent',
            last_error: voice.status,
            updated_at: new Date().toISOString(),
        })
            .eq('id', jobId);
    },
    async deliverWhatsApp(params) {
        const language = normalizeCallLanguage(String(params.job.language ?? 'en'));
        const script = await this.scriptForJob(params.job, language);
        try {
            const { whatsappService } = await import('../whatsapp/whatsapp.service.js');
            await whatsappService.sendText(String(params.farmer.phone), script.fullText);
        }
        catch (err) {
            logger.warn({ err, farmerId: params.farmer.id }, 'AI calling WhatsApp fallback failed');
            return false;
        }
        const { data: session, error } = await supabase
            .from('ai_call_sessions')
            .insert({
            job_id: params.job.id,
            farmer_id: params.job.farmer_id,
            call_type: params.job.call_type,
            channel: 'whatsapp',
            status: 'awaiting_reply',
            identity_id: params.identity?.id ?? null,
            did_number: params.identity?.did_number ?? null,
            language_used: language,
            summary: script.fullText,
        })
            .select('id')
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not create calling session');
        await supabase
            .from('farmer_call_preferences')
            .update({ last_call_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('farmer_id', params.job.farmer_id);
        return Boolean(session?.id);
    },
    async openStaffScriptSession(params) {
        const language = normalizeCallLanguage(String(params.job.language ?? params.prefs?.preferred_language ?? 'en'));
        const script = await this.scriptForJob(params.job, language);
        await supabase.from('ai_call_sessions').insert({
            job_id: params.job.id,
            farmer_id: params.job.farmer_id,
            call_type: params.job.call_type,
            channel: params.channel,
            status: 'awaiting_reply',
            identity_id: params.identity?.id ?? null,
            did_number: params.identity?.did_number ?? null,
            language_used: language,
            provider_call_id: params.providerCallId ?? null,
            summary: `${params.note}. Script: ${script.fullText}`,
        });
        await createCropAdvisorTask({
            farmerId: String(params.job.farmer_id),
            title: `AI calling — ${String(params.job.call_type).replace(/_/g, ' ')}`,
            notes: script.fullText,
            priority: params.job.call_type === 'escalation' ? 'urgent' : 'high',
            leadId: params.job.lead_id ? String(params.job.lead_id) : undefined,
        });
    },
    async scriptForJob(job, language) {
        const payload = (job.payload ?? {});
        const type = String(job.call_type);
        const stageQuestion = typeof payload.stageQuestion === 'string' ? payload.stageQuestion : null;
        const reminderLabel = typeof payload.reminderLabel === 'string' ? payload.reminderLabel : null;
        const script = buildCallScript({ type, language, stageQuestion, reminderLabel });
        assertNoPrescription(script.fullText, 'orchestrator.script');
        return script;
    },
    async tryConsumeInboundReply(farmerId, text) {
        if (!enabled() || !text.trim())
            return { handled: false };
        const { data: session } = await supabase
            .from('ai_call_sessions')
            .select('id, job_id, call_type, language_used, status')
            .eq('farmer_id', farmerId)
            .eq('status', 'awaiting_reply')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!session?.id)
            return { handled: false };
        const result = await this.applyFarmerReply({
            sessionId: String(session.id),
            text,
            source: 'whatsapp',
        });
        return { handled: true, reply: result.farmerReply };
    },
    async applyFarmerReply(params) {
        const { data: session, error } = await supabase
            .from('ai_call_sessions')
            .select('*')
            .eq('id', params.sessionId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load calling session');
        if (!session)
            throw new ValidationError('Calling session not found');
        if (session.status === 'completed') {
            throw new ValidationError('This call outcome is already frozen');
        }
        const detected = detectCallLanguage(params.text, String(session.language_used ?? 'en'));
        if (detected.shouldLock) {
            await supabase
                .from('farmer_call_preferences')
                .update({
                preferred_language: detected.language,
                language_source: 'first_speech',
                language_locked_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('farmer_id', session.farmer_id);
            await supabase
                .from('farmers')
                .update({ preferred_language: detected.language, updated_at: new Date().toISOString() })
                .eq('id', session.farmer_id);
        }
        const intent = parseFarmerIntent(params.text);
        const { data: job } = await supabase
            .from('ai_call_jobs')
            .select('*')
            .eq('id', session.job_id)
            .maybeSingle();
        const callType = String(job?.call_type ?? session.call_type);
        const payload = (job?.payload ?? {});
        const action = resolveCallAction({
            callType,
            intent,
            followUpHoursIfNo: Number(payload.followUpHoursIfNo ?? 24),
        });
        const language = detected.language;
        let farmerReply = buildCallScript({ type: 'clarify', language }).fullText;
        if (action.kind === 'opt_out') {
            farmerReply = buildCallScript({ type: 'opt_out_ack', language }).fullText;
            await this.optOut(String(session.farmer_id), params.text);
        }
        else if (action.kind === 'transfer_human') {
            farmerReply = buildCallScript({ type: 'human_ack', language }).fullText;
            await this.escalate({
                farmerId: String(session.farmer_id),
                sessionId: String(session.id),
                jobId: String(session.job_id),
                ladder: 'assigned',
                reason: action.note,
                priority: 'high',
            });
        }
        else if (action.kind === 'escalate') {
            farmerReply = buildCallScript({ type: 'escalation', language }).fullText;
            await this.escalate({
                farmerId: String(session.farmer_id),
                sessionId: String(session.id),
                jobId: String(session.job_id),
                ladder: action.ladder,
                reason: action.note,
                priority: 'urgent',
            });
        }
        else if (action.kind === 'open_ticket') {
            farmerReply = buildCallScript({ type: 'escalation', language }).fullText;
            await this.escalate({
                farmerId: String(session.farmer_id),
                sessionId: String(session.id),
                jobId: String(session.job_id),
                ladder: 'assigned',
                reason: action.note,
                priority: action.priority,
            });
        }
        else if (action.kind === 'schedule_reminder') {
            farmerReply = buildCallScript({
                type: 'reminder',
                language,
                reminderLabel: 'We will remind you again.',
            }).fullText;
            const when = new Date(Date.now() + action.hours * 60 * 60 * 1000);
            await this.enqueue({
                farmerId: String(session.farmer_id),
                callType: callType === 'qualification' ? 'reminder' : callType,
                scheduledAt: when,
                leadId: job?.lead_id ? String(job.lead_id) : null,
                payload: { ...payload, reminderLabel: action.note, parentSessionId: session.id },
                language,
            });
        }
        else if (action.kind === 'mark_completed') {
            farmerReply = language === 'ml'
                ? 'നന്ദി, രേഖപ്പെടുത്തി. അഗ്രോണമിസ്റ്റ് ആവശ്യമെങ്കിൽ ബന്ധപ്പെടും.'
                : 'Thank you, we recorded that. Your agronomist will follow up if needed.';
            if (callType === 'crop_application' && payload.recommendationRecordId) {
                await supabase
                    .from('recommendation_records')
                    .update({
                    application_status: 'applied',
                    applied_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', String(payload.recommendationRecordId));
                const { agronomistEarningsTriggers } = await import('../remuneration/agronomist-earnings-triggers.js');
                agronomistEarningsTriggers.onRecommendationApplied(String(payload.recommendationRecordId));
            }
            if (callType === 'crop_application' || callType === 'health_follow_up') {
                const currentDay = Number(payload.healthDay ?? 0);
                for (const day of nextHealthFollowUpDays(currentDay)) {
                    await this.enqueue({
                        farmerId: String(session.farmer_id),
                        callType: 'health_follow_up',
                        scheduledAt: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
                        payload: {
                            healthDay: day,
                            parentSessionId: session.id,
                            dedupeKey: `health:${day}`,
                        },
                        language,
                    });
                }
            }
            if (callType === 'qualification') {
                await this.recordQualification(String(session.farmer_id), String(session.id), payload, job);
            }
        }
        const outcomeSnapshot = snapshotOutcome({
            intent,
            action,
            source: params.source,
            language,
            transcript: params.text.slice(0, 4000),
            farmerReply,
        });
        await supabase
            .from('ai_call_sessions')
            .update({
            status: action.kind === 'clarify' ? 'awaiting_reply' : 'completed',
            farmer_intent: intent,
            outcome: action.kind,
            transcript: params.text.slice(0, 8000),
            language_detected: language,
            language_used: language,
            ended_at: action.kind === 'clarify' ? null : new Date().toISOString(),
            outcome_snapshot: outcomeSnapshot,
            summary: `${action.kind}: ${action.note}`,
        })
            .eq('id', session.id)
            .neq('status', 'completed');
        if (action.kind !== 'clarify') {
            await supabase
                .from('ai_call_jobs')
                .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', session.job_id);
        }
        return { farmerReply, intent, actionKind: action.kind };
    },
    async recordQualification(farmerId, sessionId, payload, job) {
        const farmer = await loadFarmer(farmerId);
        const result = scoreQualification({
            hasName: Boolean(farmer?.name),
            hasPhone: Boolean(farmer?.phone),
            hasLocation: Boolean(farmer?.district || farmer?.village),
            crop: typeof payload.crop === 'string' ? payload.crop : null,
            acres: typeof payload.acres === 'number' ? payload.acres : null,
            cropAgeDays: typeof payload.cropAgeDays === 'number' ? payload.cropAgeDays : null,
            problemStated: payload.problemStated === true,
            requirementStated: payload.requirementStated === true,
            marketingSource: typeof payload.marketingSource === 'string' ? payload.marketingSource : null,
            availabilityStated: payload.availabilityStated === true,
        });
        const identityEmail = job?.assigned_agronomist_email ? String(job.assigned_agronomist_email) : null;
        await supabase.from('farmer_qualifications').insert({
            farmer_id: farmerId,
            session_id: sessionId,
            score: result.score,
            band: result.band,
            answers: result.answers,
            assigned_agronomist_email: identityEmail,
        });
    },
    async escalate(params) {
        const prefs = await loadPrefs(params.farmerId);
        const identities = await loadIdentities();
        const assignedId = prefs?.assigned_identity_id ? String(prefs.assigned_identity_id) : '';
        const assigned = identities.find((i) => i.id === assignedId) ?? identities.find((i) => i.is_active);
        const backup = assigned?.backup_identity_id
            ? identities.find((i) => i.id === assigned.backup_identity_id)
            : null;
        let status = 'open';
        let email = assigned?.agronomist_email ?? null;
        let backupId = backup?.id ?? null;
        let ladder = params.ladder;
        if (ladder === 'assigned' && !email)
            ladder = 'backup';
        if (ladder === 'backup' && !backup)
            ladder = 'queue';
        if (ladder === 'queue') {
            status = 'callback_queue';
            email = backup?.agronomist_email ?? email;
        }
        else if (ladder === 'backup') {
            status = 'assigned';
            email = backup?.agronomist_email ?? email;
        }
        else {
            status = email ? 'assigned' : 'callback_queue';
        }
        await supabase.from('ai_call_escalations').insert({
            farmer_id: params.farmerId,
            session_id: params.sessionId,
            job_id: params.jobId,
            assigned_agronomist_email: email,
            backup_identity_id: backupId,
            status,
            reason: params.reason,
            priority: params.priority,
        });
        await createCropAdvisorTask({
            farmerId: params.farmerId,
            title: `AI calling escalation — ${ladder}`,
            notes: `${params.reason}. Assigned: ${email ?? 'callback queue'}`,
            priority: params.priority,
        });
        if (status === 'callback_queue' || ladder === 'backup') {
            const next = escalationLadderStep(ladder === 'queue' ? 'backup' : ladder);
            logger.info({ farmerId: params.farmerId, next }, 'AI calling escalation ladder advanced');
        }
    },
    async optOut(farmerId, reason) {
        await ensurePrefs(farmerId);
        await supabase
            .from('farmer_call_preferences')
            .update({
            dnd: true,
            opted_out_at: new Date().toISOString(),
            opted_out_reason: reason.slice(0, 500),
            consent_outbound_call: false,
            updated_at: new Date().toISOString(),
        })
            .eq('farmer_id', farmerId);
        await supabase
            .from('ai_call_jobs')
            .update({
            status: 'cancelled',
            last_error: 'opted_out',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('farmer_id', farmerId)
            .in('status', ['pending', 'calling', 'awaiting_reply', 'queued_for_agent', 'skipped_window']);
    },
    async setConsent(farmerId, patch) {
        const farmer = await loadFarmer(farmerId);
        await ensurePrefs(farmerId, farmer?.preferred_language ? String(farmer.preferred_language) : 'en');
        const updates = { updated_at: new Date().toISOString() };
        if (patch.consentOutboundCall !== undefined)
            updates.consent_outbound_call = patch.consentOutboundCall;
        if (patch.consentWhatsapp !== undefined)
            updates.consent_whatsapp = patch.consentWhatsapp;
        if (patch.dnd !== undefined) {
            updates.dnd = patch.dnd;
            if (patch.dnd)
                updates.opted_out_at = new Date().toISOString();
            else {
                updates.opted_out_at = null;
                updates.opted_out_reason = null;
            }
        }
        if (patch.language) {
            updates.preferred_language = patch.language;
            updates.language_source = 'staff';
            updates.language_locked_at = new Date().toISOString();
        }
        if (patch.bestTimeStart !== undefined)
            updates.best_time_start = patch.bestTimeStart;
        if (patch.bestTimeEnd !== undefined)
            updates.best_time_end = patch.bestTimeEnd;
        const { error } = await supabase.from('farmer_call_preferences').update(updates).eq('farmer_id', farmerId);
        throwIfSupabaseError(error, 'Could not update call preferences');
    },
    async upsertIdentity(input) {
        if (input.slotNumber < 1 || input.slotNumber > 10) {
            throw new ValidationError('Identity slot must be 1–10');
        }
        const { data: existing } = await supabase
            .from('agronomist_call_identities')
            .select('id')
            .eq('slot_number', input.slotNumber)
            .maybeSingle();
        const row = {
            agronomist_email: input.agronomistEmail ?? null,
            agronomist_admin_id: input.agronomistAdminId ?? null,
            display_name: input.displayName ?? 'Morbeez crop specialist',
            did_number: input.didNumber ?? null,
            backup_identity_id: input.backupIdentityId ?? null,
            is_active: input.isActive ?? false,
            notes: input.notes ?? null,
            updated_at: new Date().toISOString(),
        };
        if (existing?.id) {
            const { data, error } = await supabase
                .from('agronomist_call_identities')
                .update(row)
                .eq('id', existing.id)
                .select('*')
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not update identity');
            return data;
        }
        const { data, error } = await supabase
            .from('agronomist_call_identities')
            .insert({ slot_number: input.slotNumber, ...row })
            .select('*')
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not create identity');
        return data;
    },
    async listConsole() {
        const [jobs, sessions, identities, escalations] = await Promise.all([
            supabase
                .from('ai_call_jobs')
                .select('id, farmer_id, call_type, status, scheduled_at, assigned_agronomist_email, language, attempts, last_error, created_at, payload')
                .order('created_at', { ascending: false })
                .limit(80),
            supabase
                .from('ai_call_sessions')
                .select('id, job_id, farmer_id, call_type, channel, status, language_used, farmer_intent, outcome, summary, started_at, ended_at')
                .order('started_at', { ascending: false })
                .limit(80),
            supabase
                .from('agronomist_call_identities')
                .select('id, slot_number, agronomist_email, display_name, did_number, backup_identity_id, is_active, last_assigned_at, notes')
                .order('slot_number', { ascending: true }),
            supabase
                .from('ai_call_escalations')
                .select('id, farmer_id, assigned_agronomist_email, status, reason, priority, created_at')
                .in('status', ['open', 'assigned', 'callback_queue'])
                .order('created_at', { ascending: false })
                .limit(50),
        ]);
        throwIfSupabaseError(jobs.error, 'Could not list call jobs');
        throwIfSupabaseError(sessions.error, 'Could not list call sessions');
        throwIfSupabaseError(identities.error, 'Could not list identities');
        throwIfSupabaseError(escalations.error, 'Could not list calling escalations');
        const farmerIds = [
            ...new Set([...(jobs.data ?? []), ...(sessions.data ?? []), ...(escalations.data ?? [])]
                .map((r) => String(r.farmer_id ?? ''))
                .filter(Boolean)),
        ];
        const farmers = farmerIds.length === 0
            ? []
            : (await supabase.from('farmers').select('id, name, phone, district').in('id', farmerIds)).data ?? [];
        const farmerMap = new Map(farmers.map((f) => [String(f.id), f]));
        const decorate = (row) => {
            const f = farmerMap.get(String(row.farmer_id ?? ''));
            return {
                ...row,
                farmerName: f?.name ?? 'Farmer',
                farmerPhone: f?.phone ?? null,
                district: f?.district ?? null,
            };
        };
        const pendingJobs = (jobs.data ?? []).filter((j) => ['pending', 'calling', 'awaiting_reply', 'queued_for_agent', 'skipped_window'].includes(String(j.status))).length;
        return {
            voicebotConfigured: callingTelephonyProvider.isVoicebotConfigured(),
            whatsappFallback: whatsappFallbackOn(),
            pendingJobs,
            jobs: (jobs.data ?? []).map(decorate),
            sessions: (sessions.data ?? []).map(decorate),
            identities: identities.data ?? [],
            escalations: (escalations.data ?? []).map(decorate),
        };
    },
    async resolveCropDueJob(farmerId, cropType, plantingDateIso) {
        const dap = daysAfterPlanting(plantingDateIso);
        if (dap == null)
            return null;
        const protocol = matchProtocolForDap(await loadProtocols(), cropType, dap);
        if (!protocol)
            return null;
        return this.enqueue({
            farmerId,
            callType: 'crop_application',
            payload: {
                cropType: protocol.cropType,
                stageKey: protocol.stageKey,
                stageQuestion: protocol.questionEn,
                followUpHoursIfNo: protocol.followUpHoursIfNo,
                dap,
            },
        });
    },
};
//# sourceMappingURL=ai-calling-orchestrator.service.js.map