import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { recommendationRecordsService } from './recommendation-records.service.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
import { cultivationLoggingService } from '../whatsapp/cultivation/cultivation-logging.service.js';
import { accuracyMetricsService } from '../ai/accuracy-metrics.service.js';
import { aiReuseService } from '../ai/ai-reuse.service.js';
import { learningLoopService } from './learning-loop.service.js';
import { followUpCopy } from './recommendation-follow-up-copy.js';
import { escalationService } from '../ai/escalation.service.js';
import { improvementLevelToOutcomeReply, } from '../../domain/ai-training/outcome-kpi.js';
import { outcomeKpiInterpretationService } from './outcome-kpi-interpretation.service.js';
import { outcomeHumanRoutingService } from './outcome-human-routing.service.js';
import { visitAdvisoryEscalationService } from './visit-advisory-escalation.service.js';
const APPLICATION_CHECK_DAYS = () => Number(process.env.REC_FOLLOWUP_APPLICATION_DAYS ?? 1);
const OUTCOME_CHECK_DAYS = () => Number(process.env.REC_FOLLOWUP_OUTCOME_DAYS ?? 5);
const MAX_APPLICATION_REMINDERS = () => Number(process.env.REC_FOLLOWUP_MAX_REMINDERS ?? 3);
const NO_RESPONSE_ESCALATION_DAYS = () => Number(process.env.REC_FOLLOWUP_NO_RESPONSE_DAYS ?? 3);
const OUTCOME_REMINDER_DAYS = () => Number(process.env.REC_FOLLOWUP_OUTCOME_REMINDER_DAYS ?? 2);
const MAX_OUTCOME_REMINDERS = () => Number(process.env.REC_FOLLOWUP_MAX_OUTCOME_REMINDERS ?? 2);
const OUTCOME_NO_RESPONSE_DAYS = () => Number(process.env.REC_FOLLOWUP_OUTCOME_NO_RESPONSE_DAYS ?? 3);
function parseProducts(products) {
    if (!Array.isArray(products) || !products.length)
        return {};
    const first = products[0];
    if (typeof first === 'string')
        return { tradeName: first, technicalName: first };
    if (first && typeof first === 'object') {
        const o = first;
        return {
            technicalName: String(o.technicalName ?? o.activeIngredient ?? o.productTitle ?? ''),
            tradeName: String(o.tradeName ?? o.productTitle ?? o.brand ?? ''),
        };
    }
    return {};
}
function addDays(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
function addDaysDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
async function resolveEscalationSessionId(rec) {
    if (rec.ai_session_id)
        return rec.ai_session_id;
    const visitAiCaseId = rec.metadata?.visitAiCaseId;
    if (!visitAiCaseId)
        return null;
    const { data } = await supabase
        .from('visit_ai_cases')
        .select('ai_advisory_session_id')
        .eq('id', String(visitAiCaseId))
        .maybeSingle();
    return data?.ai_advisory_session_id ? String(data.ai_advisory_session_id) : null;
}
export const recommendationFollowUpService = {
    async loadRecord(recommendationRecordId) {
        const { data, error } = await supabase
            .from('recommendation_records')
            .select(`id, farmer_id, block_id, ai_session_id, field_finding_id, visit_issue_id, issue_detected, recommendation_text, products, dosage,
         application_type, dap_at_recommendation, language, status, communicated_at, technical_name, trade_name,
         severity, metadata, farmers(phone, preferred_language), farm_blocks(crop_type)`)
            .eq('id', recommendationRecordId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load recommendation');
        if (!data)
            return null;
        const raw = data;
        const farmersRel = raw.farmers;
        const blocksRel = raw.farm_blocks;
        return {
            ...raw,
            farmers: (Array.isArray(farmersRel) ? farmersRel[0] : farmersRel),
            farm_blocks: (Array.isArray(blocksRel) ? blocksRel[0] : blocksRel),
        };
    },
    /** Stage 1 — recommendation communicated; schedule Day-1 application check. */
    async onRecommendationCommunicated(recommendationRecordId) {
        if (!env.ENABLE_ADVISORY_FOLLOW_UPS)
            return;
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec)
            return;
        const now = new Date().toISOString();
        await supabase
            .from('recommendation_records')
            .update({
            application_status: 'pending_application',
            updated_at: now,
            ...(rec.communicated_at ? {} : { communicated_at: now, status: 'communicated' }),
        })
            .eq('id', recommendationRecordId);
        await this.scheduleJob({
            farmerId: rec.farmer_id,
            recommendationRecordId,
            jobType: 'rec_application_check',
            scheduledAt: addDays(APPLICATION_CHECK_DAYS()),
            payload: { language: rec.language, phase: 'application_check' },
            sessionId: rec.ai_session_id,
        });
        await this.scheduleNoResponseEscalation(recommendationRecordId, rec.farmer_id);
        await this.upsertLearningSample(rec, { applicationConfirmed: false });
    },
    /** After AI diagnosis — mark latest session rec as communicated and start follow-up. */
    async bootstrapFromDiagnosisSession(sessionId, farmerId) {
        const { data: rec } = await supabase
            .from('recommendation_records')
            .select('id')
            .eq('ai_session_id', sessionId)
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!rec?.id)
            return;
        const now = new Date().toISOString();
        await supabase
            .from('recommendation_records')
            .update({
            status: 'communicated',
            communicated_at: now,
            application_status: 'pending_application',
            updated_at: now,
        })
            .eq('id', rec.id);
        await this.onRecommendationCommunicated(rec.id);
    },
    async scheduleJob(params) {
        await supabase.from('advisory_automation_jobs').insert({
            farmer_id: params.farmerId,
            session_id: params.sessionId ?? null,
            job_type: params.jobType,
            scheduled_at: params.scheduledAt,
            payload: {
                recommendationRecordId: params.recommendationRecordId,
                ...params.payload,
            },
        });
    },
    async sendApplicationCheck(recommendationRecordId) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec?.farmers?.phone)
            return false;
        const lang = (rec.language || rec.farmers.preferred_language || 'en');
        const copy = followUpCopy(lang);
        const body = copy.applicationCheck;
        try {
            await whatsappService.sendButtons({
                to: rec.farmers.phone,
                body,
                buttons: [
                    { id: 'rec.apply_yes', title: 'Yes Applied' },
                    { id: 'rec.apply_not', title: 'Not Yet' },
                    { id: 'rec.apply_help', title: 'Need Help' },
                ],
            });
        }
        catch {
            await whatsappService.sendText(rec.farmers.phone, `${body}\n\nReply: Yes Applied / Not Yet / Need Clarification`);
        }
        const now = new Date().toISOString();
        await supabase.from('recommendation_follow_ups').insert({
            recommendation_record_id: recommendationRecordId,
            farmer_id: rec.farmer_id,
            block_id: rec.block_id,
            phase: 'application_check',
            status: 'sent',
            scheduled_at: now,
            sent_at: now,
        });
        await conversationPatchPending(rec.farmer_id, recommendationRecordId, 'application');
        return true;
    },
    async sendApplicationReminder(recommendationRecordId, reminderCount) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec?.farmers?.phone)
            return;
        const lang = (rec.language || rec.farmers.preferred_language || 'en');
        await whatsappService.sendText(rec.farmers.phone, followUpCopy(lang).notYetReminder);
        const now = new Date().toISOString();
        await supabase.from('recommendation_follow_ups').insert({
            recommendation_record_id: recommendationRecordId,
            farmer_id: rec.farmer_id,
            block_id: rec.block_id,
            phase: 'application_reminder',
            status: 'sent',
            scheduled_at: now,
            sent_at: now,
            reminder_count: reminderCount,
        });
    },
    async sendOutcomeCheck(recommendationRecordId) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec?.farmers?.phone)
            return false;
        const lang = (rec.language || rec.farmers.preferred_language || 'en');
        const copy = followUpCopy(lang);
        const issue = (rec.issue_detected ?? 'your crop issue').slice(0, 80);
        const body = copy.outcomeCheck.replace('our recommendation', `our advice for ${issue}`);
        const kpiOptions = this.outcomeKpiListOptions(lang);
        try {
            await whatsappService.sendList({
                to: rec.farmers.phone,
                body,
                buttonText: lang === 'ml' ? 'ഓപ്ഷൻ തിരഞ്ഞെടുക്കൂ' : 'Choose option',
                sections: [{ title: 'Outcome', rows: kpiOptions }],
            });
        }
        catch {
            try {
                await whatsappService.sendButtons({
                    to: rec.farmers.phone,
                    body,
                    buttons: [
                        { id: 'rec.outcome_full', title: 'Fully better' },
                        { id: 'rec.outcome_slight', title: 'Slight better' },
                        { id: 'rec.outcome_none', title: 'No change' },
                    ],
                });
                await whatsappService.sendText(rec.farmers.phone, lang === 'ml' ? '4 = കൂടുതൽ മോശം (Worse)' : '4 = Worse — reply 4 if crop worsened');
            }
            catch {
                await whatsappService.sendText(rec.farmers.phone, `${body}\n\n1 Fully improved\n2 Slightly improved\n3 No improvement\n4 Worse`);
            }
        }
        const now = new Date().toISOString();
        await supabase.from('recommendation_follow_ups').insert({
            recommendation_record_id: recommendationRecordId,
            farmer_id: rec.farmer_id,
            block_id: rec.block_id,
            phase: 'outcome_check',
            status: 'sent',
            scheduled_at: now,
            sent_at: now,
            metadata: { kpiVersion: 2 },
        });
        await this.scheduleJob({
            farmerId: rec.farmer_id,
            recommendationRecordId,
            jobType: 'rec_outcome_reminder',
            scheduledAt: addDays(OUTCOME_REMINDER_DAYS()),
            payload: { language: rec.language, reminderCount: 1 },
            sessionId: rec.ai_session_id,
        });
        await this.scheduleJob({
            farmerId: rec.farmer_id,
            recommendationRecordId,
            jobType: 'rec_outcome_no_response',
            scheduledAt: addDays(OUTCOME_NO_RESPONSE_DAYS()),
            payload: { language: rec.language },
            sessionId: rec.ai_session_id,
        });
        await conversationPatchPending(rec.farmer_id, recommendationRecordId, 'outcome');
        return true;
    },
    outcomeKpiListOptions(lang) {
        if (lang === 'ml') {
            return [
                { id: 'rec.outcome_full', title: '1 പൂർണ്ണ മെച്ചം', description: 'Fully improved' },
                { id: 'rec.outcome_slight', title: '2 കുറച്ച് മെച്ചം', description: 'Slightly improved' },
                { id: 'rec.outcome_none', title: '3 മെച്ചമില്ല', description: 'No improvement' },
                { id: 'rec.outcome_worse', title: '4 കൂടുതൽ മോശം', description: 'Worse' },
            ];
        }
        return [
            { id: 'rec.outcome_full', title: '1 Fully improved' },
            { id: 'rec.outcome_slight', title: '2 Slightly improved' },
            { id: 'rec.outcome_none', title: '3 No improvement' },
            { id: 'rec.outcome_worse', title: '4 Worse' },
        ];
    },
    async sendOutcomeReminder(recommendationRecordId, reminderCount) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec?.farmers?.phone)
            return;
        const { data: open } = await supabase
            .from('recommendation_follow_ups')
            .select('id, status')
            .eq('recommendation_record_id', recommendationRecordId)
            .eq('phase', 'outcome_check')
            .in('status', ['sent'])
            .limit(1);
        if (!open?.length)
            return;
        const lang = (rec.language || rec.farmers.preferred_language || 'en');
        const copy = followUpCopy(lang);
        await whatsappService.sendText(rec.farmers.phone, copy.outcomeReminder);
        const now = new Date().toISOString();
        await supabase.from('recommendation_follow_ups').insert({
            recommendation_record_id: recommendationRecordId,
            farmer_id: rec.farmer_id,
            block_id: rec.block_id,
            phase: 'outcome_reminder',
            status: 'sent',
            scheduled_at: now,
            sent_at: now,
            reminder_count: reminderCount,
        });
        if (reminderCount < MAX_OUTCOME_REMINDERS()) {
            await this.scheduleJob({
                farmerId: rec.farmer_id,
                recommendationRecordId,
                jobType: 'rec_outcome_reminder',
                scheduledAt: addDays(OUTCOME_REMINDER_DAYS()),
                payload: { language: rec.language, reminderCount: reminderCount + 1 },
                sessionId: rec.ai_session_id,
            });
        }
    },
    async handleOutcomePhotoUpload(farmerId, recommendationRecordId) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec || rec.farmer_id !== farmerId)
            return null;
        const lang = (rec.language || 'en');
        const existing = await this.readOutcomeKpi(recommendationRecordId);
        const kpi = {
            ...(existing ?? {
                improvementLevel: 'slight_improvement',
                collectedAt: new Date().toISOString(),
                source: 'whatsapp_text',
                aiClassification: 'uncertain',
                aiConfidence: 0.5,
            }),
            photoUploaded: true,
            collectedAt: new Date().toISOString(),
        };
        await supabase
            .from('recommendation_records')
            .update({
            outcome_kpi: kpi,
            updated_at: new Date().toISOString(),
        })
            .eq('id', recommendationRecordId);
        return followUpCopy(lang).outcomePhotoPrompt;
    },
    async handleOutcomeKpi(params) {
        const rec = await this.loadRecord(params.recommendationRecordId);
        if (!rec || rec.farmer_id !== params.farmerId) {
            return 'Could not find your recommendation. Type menu for help.';
        }
        const lang = (rec.language || 'en');
        const copy = followUpCopy(lang);
        const level = params.improvementLevel;
        const aiConf = params.aiConfidence ?? 0.88;
        const kpi = {
            improvementLevel: level,
            photoUploaded: params.photoUploaded ?? false,
            aiClassification: params.aiClassification ?? (aiConf < 0.6 ? 'uncertain' : level === 'fully_improved' ? 'positive' : level === 'slight_improvement' ? 'partial' : 'failed'),
            aiConfidence: aiConf,
            collectedAt: new Date().toISOString(),
            source: params.source,
            rawSnippet: params.rawSnippet?.slice(0, 300),
        };
        const meta = (rec.metadata ?? {});
        const routing = await outcomeHumanRoutingService.decide({
            farmerId: params.farmerId,
            recommendationRecordId: params.recommendationRecordId,
            improvementLevel: level,
            kpi,
            severity: rec.severity,
            aiSessionConfidence: null,
            farmerMetadata: meta,
        });
        await supabase
            .from('recommendation_records')
            .update({
            outcome_kpi: kpi,
            outcome_source: params.source === 'agronomist' ? 'agronomist' : 'whatsapp_kpi',
            needs_human_outcome_review: routing.needsHumanReview,
            human_outcome_review_reason: routing.needsHumanReview
                ? outcomeHumanRoutingService.formatReasonsForStaff(routing.reasons)
                : null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', params.recommendationRecordId);
        const reply = improvementLevelToOutcomeReply(level);
        await this.markOutcomeFollowUpResponded(params.recommendationRecordId, reply);
        if (routing.needsHumanReview) {
            await this.queueHumanOutcomeVerification(params.farmerId, rec, level, routing.reasons);
            if (level === 'worse') {
                await clearConversationPending(params.farmerId);
                return copy.worsenedReply;
            }
            if (level === 'no_improvement') {
                await clearConversationPending(params.farmerId);
                return copy.noImprovementReply;
            }
            await clearConversationPending(params.farmerId);
            return lang === 'ml'
                ? 'നന്ദി! ഞങ്ങളുടെ ടീം ഈ അപ്ഡേറ്റ് പരിശോധിക്കും.'
                : 'Thank you! Our team will verify this update shortly.';
        }
        return this.handleOutcomeReply(params.farmerId, params.recommendationRecordId, reply, {
            kpi,
            skipHumanRouting: true,
        });
    },
    async interpretAndHandleOutcomeText(farmerId, recommendationRecordId, text, hasImage) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec || rec.farmer_id !== farmerId)
            return null;
        const lang = (rec.language || 'en');
        const interpreted = await outcomeKpiInterpretationService.interpretFarmerReply({
            text,
            language: lang,
            issueLabel: rec.issue_detected,
            hasImage,
        });
        if (!interpreted)
            return null;
        return this.handleOutcomeKpi({
            farmerId,
            recommendationRecordId,
            improvementLevel: interpreted.improvementLevel,
            source: interpreted.source === 'whatsapp_ai' ? 'whatsapp_ai' : 'whatsapp_text',
            photoUploaded: hasImage,
            aiClassification: interpreted.aiClassification,
            aiConfidence: interpreted.confidence,
            rawSnippet: interpreted.rawSnippet,
        });
    },
    async readOutcomeKpi(recommendationRecordId) {
        const { data } = await supabase
            .from('recommendation_records')
            .select('outcome_kpi')
            .eq('id', recommendationRecordId)
            .maybeSingle();
        const kpi = data?.outcome_kpi;
        if (!kpi || typeof kpi !== 'object')
            return null;
        return kpi;
    },
    async markOutcomeFollowUpResponded(recommendationRecordId, reply) {
        const now = new Date().toISOString();
        await supabase
            .from('recommendation_follow_ups')
            .update({
            status: 'responded',
            farmer_response: reply,
            responded_at: now,
            updated_at: now,
        })
            .eq('recommendation_record_id', recommendationRecordId)
            .eq('phase', 'outcome_check')
            .in('status', ['sent', 'scheduled']);
    },
    async queueHumanOutcomeVerification(farmerId, rec, level, reasons) {
        const needsEscalation = level === 'worse' || level === 'no_improvement';
        if (needsEscalation && rec.ai_session_id) {
            if (level === 'worse') {
                await this.escalateWorsened(farmerId, rec);
            }
            else {
                await this.escalateNoImprovement(farmerId, rec.id, rec);
            }
            return;
        }
        if (reasons.includes('qa_random_sample') || reasons.includes('uncertain_ai_classification')) {
            await createTelecallerTask({
                farmerId,
                title: 'Outcome QA verification',
                notes: `Verify WhatsApp KPI outcome for ${rec.issue_detected ?? 'crop case'}. Reasons: ${reasons.join(', ')}`,
                priority: 'normal',
            });
        }
    },
    async escalateOutcomeNoResponse(farmerId, recommendationRecordId) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec)
            return;
        const { data: responded } = await supabase
            .from('recommendation_follow_ups')
            .select('id')
            .eq('recommendation_record_id', recommendationRecordId)
            .eq('phase', 'outcome_check')
            .in('status', ['responded', 'completed'])
            .limit(1);
        if (responded?.length)
            return;
        await supabase
            .from('recommendation_records')
            .update({
            needs_human_outcome_review: true,
            human_outcome_review_reason: outcomeHumanRoutingService.formatReasonsForStaff([
                'outcome_no_whatsapp_response',
            ]),
            updated_at: new Date().toISOString(),
        })
            .eq('id', recommendationRecordId);
        await visitAdvisoryEscalationService.escalate({
            farmerId,
            reason: 'outcome_no_whatsapp_response',
            recommendationRecordId,
            issueLabel: rec.issue_detected,
            notes: `No KPI reply after outcome message. Rec ${recommendationRecordId.slice(0, 8)}`,
        });
    },
    async handleApplicationReply(farmerId, recommendationRecordId, reply) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec || rec.farmer_id !== farmerId) {
            return 'Could not find your recommendation. Type menu for help.';
        }
        const lang = (rec.language || 'en');
        const copy = followUpCopy(lang);
        const now = new Date().toISOString();
        await supabase
            .from('recommendation_follow_ups')
            .update({
            status: 'responded',
            farmer_response: reply,
            responded_at: now,
            updated_at: now,
        })
            .eq('recommendation_record_id', recommendationRecordId)
            .eq('phase', 'application_check')
            .in('status', ['sent', 'scheduled']);
        if (reply === 'yes_applied') {
            const productMeta = parseProducts(rec.products);
            const technicalName = rec.technical_name || productMeta.technicalName || null;
            const tradeName = rec.trade_name || productMeta.tradeName || null;
            const appliedDate = new Date().toISOString().slice(0, 10);
            const followUpDate = addDaysDate(OUTCOME_CHECK_DAYS());
            const activity = await cultivationLoggingService.logActivity({
                farmerId,
                activityType: mapApplicationMethod(rec.application_type),
                advisorySessionId: rec.ai_session_id ?? undefined,
                dosageNotes: rec.dosage ?? undefined,
                notes: 'Farmer confirmed recommendation applied (auto follow-up)',
                source: 'recommendation_follow_up',
            });
            await supabase.from('recommendation_applications').upsert({
                recommendation_record_id: recommendationRecordId,
                farmer_id: farmerId,
                block_id: rec.block_id,
                technical_name: technicalName,
                trade_name: tradeName,
                dosage: rec.dosage,
                application_method: rec.application_type,
                applied_at: appliedDate,
                follow_up_date: followUpDate,
                result_status: 'pending',
                applied_by: 'farmer',
                cultivation_activity_id: activity.id,
                updated_at: now,
            }, { onConflict: 'recommendation_record_id' });
            await supabase
                .from('recommendation_records')
                .update({
                status: 'applied',
                application_status: 'applied',
                applied_at: now,
                updated_at: now,
            })
                .eq('id', recommendationRecordId);
            await this.scheduleJob({
                farmerId,
                recommendationRecordId,
                jobType: 'rec_outcome_check',
                scheduledAt: new Date(Date.now() + OUTCOME_CHECK_DAYS() * 24 * 60 * 60 * 1000).toISOString(),
                payload: { language: rec.language, phase: 'outcome_check' },
                sessionId: rec.ai_session_id,
            });
            await this.upsertLearningSample(rec, { applicationConfirmed: true });
            const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
            void farmerEventCaptureService.trackRecommendationApplied({
                farmerId,
                recommendationRecordId,
            });
            await clearConversationPending(farmerId);
            return copy.appliedThanks;
        }
        if (reply === 'not_yet') {
            await supabase
                .from('recommendation_records')
                .update({ application_status: 'pending_application', updated_at: now })
                .eq('id', recommendationRecordId);
            const { count } = await supabase
                .from('recommendation_follow_ups')
                .select('id', { count: 'exact', head: true })
                .eq('recommendation_record_id', recommendationRecordId)
                .eq('phase', 'application_reminder');
            const reminderCount = (count ?? 0) + 1;
            if (reminderCount <= MAX_APPLICATION_REMINDERS()) {
                await this.scheduleJob({
                    farmerId,
                    recommendationRecordId,
                    jobType: 'rec_application_reminder',
                    scheduledAt: addDays(1),
                    payload: { language: rec.language, reminderCount },
                    sessionId: rec.ai_session_id,
                });
            }
            else {
                await this.escalateNoApplicationConfirmation(farmerId, recommendationRecordId, rec);
            }
            await clearConversationPending(farmerId);
            return copy.notYetReminder;
        }
        // need_clarification
        await supabase
            .from('recommendation_records')
            .update({ application_status: 'need_clarification', updated_at: now })
            .eq('id', recommendationRecordId);
        await createTelecallerTask({
            farmerId,
            title: 'Telecaller Callback Required',
            notes: `Farmer needs clarification on recommendation ${recommendationRecordId.slice(0, 8)}`,
            priority: 'high',
        });
        await clearConversationPending(farmerId);
        return copy.clarificationAck;
    },
    async handleOutcomeReply(farmerId, recommendationRecordId, reply, opts) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec || rec.farmer_id !== farmerId) {
            return 'Could not find your recommendation. Type menu for help.';
        }
        const lang = (rec.language || 'en');
        const copy = followUpCopy(lang);
        const now = new Date().toISOString();
        const outcomeMap = {
            improved: 'better',
            partial: 'partial',
            no_improvement: 'no_improvement',
            worsened: 'no_improvement',
        };
        const resultStatusMap = {
            improved: 'improved',
            partial: 'partial',
            no_improvement: 'no_improvement',
            worsened: 'worsened',
        };
        if (!opts?.skipHumanRouting) {
            await this.markOutcomeFollowUpResponded(recommendationRecordId, reply);
        }
        else {
            const now2 = new Date().toISOString();
            await supabase
                .from('recommendation_follow_ups')
                .update({
                status: 'completed',
                farmer_response: reply,
                responded_at: now2,
                updated_at: now2,
            })
                .eq('recommendation_record_id', recommendationRecordId)
                .eq('phase', 'outcome_check');
        }
        if (opts?.kpi) {
            await supabase
                .from('recommendation_records')
                .update({
                outcome_kpi: opts.kpi,
                outcome_source: 'whatsapp_kpi',
                updated_at: now,
            })
                .eq('id', recommendationRecordId);
        }
        await supabase
            .from('recommendation_applications')
            .update({
            result_status: resultStatusMap[reply],
            updated_at: now,
        })
            .eq('recommendation_record_id', recommendationRecordId);
        await recommendationRecordsService.recordOutcome(recommendationRecordId, outcomeMap[reply === 'worsened' ? 'no_improvement' : reply], { notes: `WhatsApp follow-up: ${reply}` });
        await accuracyMetricsService.logFollowupOutcome({
            farmerId,
            sessionId: rec.ai_session_id ?? undefined,
            outcome: reply === 'improved'
                ? 'improved'
                : reply === 'worsened'
                    ? 'worsened'
                    : reply === 'partial'
                        ? 'partial'
                        : 'no_improvement',
            notes: `Recommendation ${recommendationRecordId}: ${reply}`,
        });
        await this.upsertLearningSample(rec, {
            applicationConfirmed: true,
            outcome: reply,
            escalated: reply === 'worsened' || reply === 'no_improvement',
        });
        if (reply === 'improved' || reply === 'partial') {
            await aiReuseService.markOutcomeForSession(rec.ai_session_id, true).catch(() => { });
            await learningLoopService.onLearningSampleReady(recommendationRecordId).catch(() => { });
            await clearConversationPending(farmerId);
            return reply === 'partial' ? copy.slightImprovementThanks : copy.improvedThanks;
        }
        if (reply === 'worsened') {
            await this.escalateWorsened(farmerId, rec);
            await clearConversationPending(farmerId);
            return copy.worsenedReply;
        }
        await this.escalateNoImprovement(farmerId, recommendationRecordId, rec);
        await clearConversationPending(farmerId);
        return copy.noImprovementReply;
    },
    async resolvePendingRecommendationId(farmerId) {
        const { data: session } = await supabase
            .from('conversation_sessions')
            .select('context')
            .eq('farmer_id', farmerId)
            .eq('channel', 'whatsapp')
            .maybeSingle();
        const ctx = (session?.context ?? {});
        if (typeof ctx.pendingRecommendationRecordId === 'string') {
            return ctx.pendingRecommendationRecordId;
        }
        const { data: rec } = await supabase
            .from('recommendation_records')
            .select('id')
            .eq('farmer_id', farmerId)
            .in('status', ['communicated', 'applied'])
            .in('application_status', ['pending_application', 'applied'])
            .order('communicated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return rec?.id ?? null;
    },
    async processAutomationJob(job) {
        const recId = String(job.payload.recommendationRecordId ?? '');
        if (!recId) {
            logger.warn({ jobType: job.job_type }, 'Recommendation follow-up job missing rec id');
            return;
        }
        switch (job.job_type) {
            case 'rec_application_check':
                await this.sendApplicationCheck(recId);
                break;
            case 'rec_application_reminder': {
                const reminderCount = Number(job.payload.reminderCount ?? 1);
                await this.sendApplicationReminder(recId, reminderCount);
                break;
            }
            case 'rec_outcome_check':
                await this.sendOutcomeCheck(recId);
                break;
            case 'rec_outcome_reminder': {
                const reminderCount = Number(job.payload.reminderCount ?? 1);
                await this.sendOutcomeReminder(recId, reminderCount);
                break;
            }
            case 'rec_outcome_no_response':
                await this.escalateOutcomeNoResponse(job.farmer_id, recId);
                break;
            case 'rec_no_response_escalation':
                await this.escalateNoApplicationConfirmation(job.farmer_id, recId, null);
                break;
            default:
                break;
        }
    },
    async escalateNoApplicationConfirmation(farmerId, recommendationRecordId, rec) {
        const row = rec ?? (await this.loadRecord(recommendationRecordId));
        await visitAdvisoryEscalationService.escalate({
            farmerId,
            reason: 'recommendation_not_applied',
            recommendationRecordId,
            fieldFindingId: row?.field_finding_id ? String(row.field_finding_id) : null,
            issueLabel: row?.issue_detected,
            notes: `No application confirmation after reminders. Rec ${recommendationRecordId.slice(0, 8)}`,
        });
    },
    async escalateNoImprovement(farmerId, recommendationRecordId, rec) {
        await createTelecallerTask({
            farmerId,
            title: 'Reassessment Required',
            notes: `No improvement after recommendation ${recommendationRecordId.slice(0, 8)}. Issue: ${rec.issue_detected ?? 'n/a'}`,
            priority: 'high',
        });
        const sessionId = await resolveEscalationSessionId(rec);
        if (sessionId) {
            await escalationService.ensureOpenEscalation({
                sessionId,
                farmerId,
                reason: 'No improvement after recommendation (Day-5 follow-up)',
                confidence_at_escalation: 0.5,
                priority: 'high',
            });
        }
    },
    async escalateWorsened(farmerId, rec) {
        await visitAdvisoryEscalationService.escalate({
            farmerId,
            reason: 'outcome_worse',
            recommendationRecordId: rec.id,
            fieldFindingId: rec.field_finding_id ? String(rec.field_finding_id) : null,
            issueLabel: rec.issue_detected,
            notes: `Recommendation ${rec.id.slice(0, 8)}`,
            priority: 'urgent',
        });
        const sessionId = await resolveEscalationSessionId(rec);
        if (sessionId) {
            await escalationService.ensureOpenEscalation({
                sessionId,
                farmerId,
                reason: 'Worsened after recommendation (Day-5 follow-up)',
                confidence_at_escalation: 0.4,
                priority: 'urgent',
            });
        }
    },
    async scheduleNoResponseEscalation(recommendationRecordId, farmerId) {
        await this.scheduleJob({
            farmerId,
            recommendationRecordId,
            jobType: 'rec_no_response_escalation',
            scheduledAt: addDays(NO_RESPONSE_ESCALATION_DAYS()),
            payload: {},
        });
    },
    async getTelecallerFollowUpDetail(recommendationRecordId) {
        const rec = await this.loadRecord(recommendationRecordId);
        if (!rec)
            return null;
        const [{ data: application }, { data: followUps }, { data: sessions }] = await Promise.all([
            supabase
                .from('recommendation_applications')
                .select('*')
                .eq('recommendation_record_id', recommendationRecordId)
                .maybeSingle(),
            supabase
                .from('recommendation_follow_ups')
                .select('*')
                .eq('recommendation_record_id', recommendationRecordId)
                .order('created_at', { ascending: false }),
            rec.ai_session_id
                ? supabase
                    .from('ai_advisory_sessions')
                    .select('id, confidence_score, status, created_at')
                    .eq('id', rec.ai_session_id)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
        ]);
        return {
            recommendation: rec,
            application: application ?? null,
            followUps: followUps ?? [],
            session: sessions ?? null,
            escalationStatus: followUps?.some((f) => f.status === 'escalated') ?? false,
        };
    },
    async getKpis(days = 30) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data: recs } = await supabase
            .from('recommendation_records')
            .select('id, status, application_status, outcome, communicated_at, applied_at, needs_human_outcome_review, outcome_kpi')
            .gte('created_at', since);
        const rows = recs ?? [];
        const communicated = rows.filter((r) => ['communicated', 'applied', 'outcome_recorded'].includes(String(r.status)));
        const applied = rows.filter((r) => r.application_status === 'applied' || r.status === 'applied' || r.status === 'outcome_recorded');
        const outcomes = rows.filter((r) => r.status === 'outcome_recorded');
        const success = outcomes.filter((r) => r.outcome === 'better' || r.outcome === 'partial');
        const { data: outcomeFollowUps } = await supabase
            .from('recommendation_follow_ups')
            .select('status, farmer_response, phase')
            .eq('phase', 'outcome_check')
            .gte('created_at', since);
        const outcomeSent = (outcomeFollowUps ?? []).filter((f) => f.status === 'sent' || f.status === 'responded' || f.status === 'completed');
        const outcomeResponded = (outcomeFollowUps ?? []).filter((f) => ['responded', 'completed'].includes(String(f.status)));
        let photoUploaded = 0;
        let fullyImproved = 0;
        let slightImproved = 0;
        for (const r of rows) {
            const kpi = r.outcome_kpi;
            if (kpi?.photoUploaded)
                photoUploaded += 1;
            if (kpi?.improvementLevel === 'fully_improved')
                fullyImproved += 1;
            if (kpi?.improvementLevel === 'slight_improvement')
                slightImproved += 1;
        }
        const { count: pendingFollowUps } = await supabase
            .from('recommendation_follow_ups')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'scheduled')
            .gte('scheduled_at', since);
        const needsHumanReview = rows.filter((r) => r.needs_human_outcome_review && !r.outcome).length;
        return {
            periodDays: days,
            recommendationsCommunicated: communicated.length,
            applicationRatePct: communicated.length > 0
                ? Math.round((applied.length / communicated.length) * 100)
                : 0,
            outcomeRecorded: outcomes.length,
            successRatePct: outcomes.length > 0 ? Math.round((success.length / outcomes.length) * 100) : 0,
            whatsappKpi: {
                outcomeMessagesSent: outcomeSent.length,
                outcomeResponseRatePct: outcomeSent.length > 0
                    ? Math.round((outcomeResponded.length / outcomeSent.length) * 100)
                    : 0,
                fullyImprovedCount: fullyImproved,
                slightImprovementCount: slightImproved,
                photoUploadedCount: photoUploaded,
                pendingHumanVerification: needsHumanReview,
            },
            pendingScheduledFollowUps: pendingFollowUps ?? 0,
            noResponseFarmers: rows.filter((r) => r.application_status === 'pending_application').length,
        };
    },
    async upsertLearningSample(rec, patch) {
        const productMeta = parseProducts(rec.products);
        const snapshot = {
            issue: rec.issue_detected,
            text: rec.recommendation_text.slice(0, 2000),
            dosage: rec.dosage,
            applicationType: rec.application_type,
            technicalName: rec.technical_name || productMeta.technicalName,
            tradeName: rec.trade_name || productMeta.tradeName,
            products: rec.products,
        };
        const { data: existing } = await supabase
            .from('ai_learning_samples')
            .select('id')
            .eq('recommendation_record_id', rec.id)
            .maybeSingle();
        const visitIssueId = rec.visit_issue_id;
        const fieldFindingId = rec.field_finding_id;
        const row = {
            farmer_id: rec.farmer_id,
            ai_session_id: rec.ai_session_id,
            visit_issue_id: visitIssueId ?? null,
            field_finding_id: fieldFindingId ?? null,
            crop_type: rec.farm_blocks?.crop_type ?? null,
            disease_label: rec.issue_detected,
            dap: rec.dap_at_recommendation,
            severity: rec.severity,
            recommendation_snapshot: snapshot,
            application_confirmed: patch.applicationConfirmed ?? null,
            outcome: patch.outcome ?? null,
            escalated: patch.escalated ?? false,
        };
        if (existing?.id) {
            await supabase.from('ai_learning_samples').update(row).eq('id', existing.id);
        }
        else {
            await supabase.from('ai_learning_samples').insert({
                recommendation_record_id: rec.id,
                ...row,
            });
        }
    },
    async buildBlockTimelineEvents(blockId, farmerId) {
        const events = [];
        const { data: recs } = await supabase
            .from('recommendation_records')
            .select('id, created_at, communicated_at, applied_at, issue_detected, status, application_status, outcome')
            .eq('block_id', blockId)
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(10);
        for (const r of recs ?? []) {
            events.push({
                kind: 'diagnosis',
                title: 'Diagnosis / recommendation created',
                at: String(r.created_at),
                detail: r.issue_detected ?? undefined,
            });
            if (r.communicated_at) {
                events.push({
                    kind: 'recommendation_sent',
                    title: 'Recommendation sent',
                    at: String(r.communicated_at),
                });
            }
            if (r.applied_at || r.application_status === 'applied') {
                events.push({
                    kind: 'recommendation_applied',
                    title: 'Recommendation applied',
                    at: String(r.applied_at ?? r.communicated_at),
                });
            }
            if (r.status === 'outcome_recorded') {
                events.push({
                    kind: 'follow_up_completed',
                    title: 'Follow-up completed',
                    at: String(r.applied_at ?? r.created_at),
                    detail: r.outcome ? `Result: ${r.outcome}` : undefined,
                });
            }
        }
        const { data: apps } = await supabase
            .from('recommendation_applications')
            .select('applied_at, trade_name, technical_name, result_status')
            .eq('block_id', blockId)
            .eq('farmer_id', farmerId)
            .order('applied_at', { ascending: false })
            .limit(5);
        for (const a of apps ?? []) {
            events.push({
                kind: 'application_entry',
                title: `Application recorded — ${a.trade_name || a.technical_name || 'Treatment'}`,
                at: `${a.applied_at}T12:00:00.000Z`,
                detail: a.result_status ? `Result: ${a.result_status}` : undefined,
            });
        }
        return events;
    },
};
function mapApplicationMethod(applicationType) {
    const t = (applicationType ?? '').toLowerCase();
    if (/drench|root/i.test(t))
        return 'drench';
    if (/fertig/i.test(t))
        return 'fertigation';
    if (/spray|foliar/i.test(t))
        return 'spray_applied';
    return 'spray_applied';
}
async function conversationPatchPending(farmerId, recommendationRecordId, phase) {
    const { data } = await supabase
        .from('conversation_sessions')
        .select('context')
        .eq('farmer_id', farmerId)
        .eq('channel', 'whatsapp')
        .maybeSingle();
    const ctx = (data?.context ?? {});
    await supabase
        .from('conversation_sessions')
        .update({
        context: {
            ...ctx,
            pendingRecommendationRecordId: recommendationRecordId,
            pendingRecommendationFollowUp: phase,
        },
        updated_at: new Date().toISOString(),
    })
        .eq('farmer_id', farmerId)
        .eq('channel', 'whatsapp');
}
async function clearConversationPending(farmerId) {
    const { data } = await supabase
        .from('conversation_sessions')
        .select('context')
        .eq('farmer_id', farmerId)
        .eq('channel', 'whatsapp')
        .maybeSingle();
    const ctx = { ...(data?.context ?? {}) };
    delete ctx.pendingRecommendationRecordId;
    delete ctx.pendingRecommendationFollowUp;
    await supabase
        .from('conversation_sessions')
        .update({ context: ctx, updated_at: new Date().toISOString() })
        .eq('farmer_id', farmerId)
        .eq('channel', 'whatsapp');
}
//# sourceMappingURL=recommendation-follow-up.service.js.map