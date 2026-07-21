import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { escalationAdminService } from './escalation-admin.service.js';
import { blockService } from '../core/block.service.js';
import { recommendationRecordsService } from '../core/recommendation-records.service.js';
import { agronomistWorkflowService } from './agronomist-workflow.service.js';
import { weatherAlertsService } from '../whatsapp/scenarios/weather-alerts.service.js';
import { resolveAdvisoryImageUrl, urlFromWhatsAppPayload, } from '../core/advisory-image-storage.service.js';
import { mapRecordSeverityToUi, mapUiSeverityToRecord, parseEscalationCorrection, pickFarmerFacingSummary, pickLatestOutput, resolveFarmerQuestion, resolveProbableIssue, textsLikelySame, } from './case-review-inquiry.util.js';
import { confidenceLifecycleService } from '../core/confidence-lifecycle.service.js';
import { fieldContextService } from '../case/field-context.service.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { economicGateService } from '../case/economic-gate.service.js';
import { goldLearningQueueService } from '../ml/retraining-pipeline.service.js';
import { maiosLearningFacadeService } from '../maios-reasoning/maios-learning-facade.service.js';
import { caseNeedsSiteVisit } from '../agronomist/case-needs-site-visit.js';
function isAgronomistVerifyAction(action) {
    return action === 'approve_ai' || action === 'correct_ai' || action === 'partial_match';
}
function formatDt(iso) {
    if (!iso)
        return null;
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }
    catch {
        return iso;
    }
}
function timeAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60)
        return `${Math.max(1, m)}m`;
    const h = Math.floor(m / 60);
    if (h < 48)
        return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}
function caseRef(id, createdAt) {
    const d = new Date(createdAt);
    const y = d.getFullYear().toString().slice(-2);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `ESC-${y}${mo}${day}-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}
function priorityRank(p) {
    if (p === 'urgent')
        return 0;
    if (p === 'high')
        return 1;
    if (p === 'normal')
        return 2;
    return 3;
}
async function pushFarmerImage(images, row) {
    if (!row.url)
        return;
    if (images.some((i) => i.url === row.url))
        return;
    images.push(row);
}
function buildTopDiagnoses(probableIssue, confidence, plantIdRaw, stressAnalysis) {
    const rows = [];
    const baseConf = confidence != null ? Number(confidence) : 0.66;
    if (probableIssue) {
        rows.push({ label: probableIssue, confidence: baseConf });
    }
    const plant = plantIdRaw;
    for (const d of plant?.diseases ?? []) {
        if (!d.name)
            continue;
        if (rows.some((r) => r.label.toLowerCase() === d.name.toLowerCase()))
            continue;
        rows.push({ label: d.name, confidence: d.probability ?? 0.25 });
    }
    const stress = Array.isArray(stressAnalysis) ? stressAnalysis : [];
    for (const s of stress.slice(0, 2)) {
        const label = typeof s === 'string' ? s : String(s);
        if (!label || rows.some((r) => r.label === label))
            continue;
        rows.push({ label, confidence: Math.max(0.12, baseConf * 0.45) });
    }
    if (!rows.length && probableIssue) {
        rows.push({ label: probableIssue, confidence: baseConf });
    }
    const total = rows.reduce((s, r) => s + r.confidence, 0) || 1;
    return rows
        .slice(0, 3)
        .map((r) => ({ ...r, confidence: r.confidence / total }))
        .sort((a, b) => b.confidence - a.confidence);
}
function confidenceBreakdown(confidence, cropMatch, hasImages, hasWeather) {
    const base = confidence ?? 0.66;
    return [
        { label: 'Crop match', score: cropMatch ? 0.92 : 0.55 },
        { label: 'Visual match', score: hasImages ? Math.min(0.95, base + 0.08) : 0.4 },
        { label: 'Weather match', score: hasWeather ? 0.78 : 0.5 },
        { label: 'Regional history', score: Math.min(0.88, base + 0.05) },
        { label: 'Overall', score: base },
    ];
}
async function fetchOutboundWhatsAppReply(farmerId, aroundIso) {
    let query = supabase
        .from('interaction_logs')
        .select('content, created_at')
        .eq('farmer_id', farmerId)
        .eq('channel', 'whatsapp')
        .eq('direction', 'outbound')
        .eq('message_type', 'text')
        .order('created_at', { ascending: false })
        .limit(8);
    if (aroundIso) {
        const center = new Date(aroundIso).getTime();
        if (!Number.isNaN(center)) {
            const from = new Date(center - 45 * 60 * 1000).toISOString();
            const to = new Date(center + 45 * 60 * 1000).toISOString();
            query = query.gte('created_at', from).lte('created_at', to);
        }
    }
    const { data } = await query;
    const rows = (data ?? []).filter((r) => String(r.content ?? '').trim().length >= 20);
    if (!rows.length)
        return null;
    return String(rows[0].content).trim();
}
function parseReviewAction(raw) {
    if (raw === 'approve_ai' ||
        raw === 'correct_ai' ||
        raw === 'partial_match' ||
        raw === 'escalate_urgent') {
        return raw;
    }
    return undefined;
}
export const agronomistCaseReviewService = {
    async listQueue(params) {
        const status = params.status ?? 'open';
        const limit = Math.min(params.limit ?? 24, 50);
        const page = params.page ?? 1;
        const { items, total } = await escalationAdminService.list({
            status: status === 'all' ? 'all' : status,
            page,
            limit,
        });
        let sorted = [...items];
        if (params.sort === 'priority') {
            sorted.sort((a, b) => {
                const pr = priorityRank(String(a.priority)) - priorityRank(String(b.priority));
                if (pr !== 0)
                    return pr;
                return new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime();
            });
        }
        const farmerIds = [...new Set(sorted.map((i) => String(i.farmerId)))];
        const { data: farmerSources } = farmerIds.length
            ? await supabase.from('farmers').select('id, source').in('id', farmerIds)
            : { data: [] };
        const demoFarmerIds = new Set((farmerSources ?? []).filter((f) => f.source === 'demo_seed').map((f) => String(f.id)));
        sorted = sorted.filter((i) => !demoFarmerIds.has(String(i.farmerId)));
        const sessionIds = [...new Set(sorted.map((i) => String(i.sessionId)).filter(Boolean))];
        const { data: sessionMetas } = sessionIds.length
            ? await supabase.from('ai_advisory_sessions').select('id, metadata').in('id', sessionIds)
            : { data: [] };
        const routeBySession = new Map();
        for (const row of sessionMetas ?? []) {
            const meta = row.metadata ?? {};
            const maios = meta.maiosCase;
            const ginger = meta.gingerSopV3;
            routeBySession.set(String(row.id), maios?.route ?? ginger?.route ?? null);
        }
        const enriched = await Promise.all(sorted.map(async (item) => {
            const primary = await blockService.getPrimaryBlock(String(item.farmerId));
            const { data: fb } = await supabase
                .from('farmer_advisory_feedback')
                .select('id, status')
                .eq('session_id', item.sessionId)
                .in('status', ['pending_review', 'partial', 'pending_capture'])
                .limit(1)
                .maybeSingle();
            const maiosRoute = routeBySession.get(String(item.sessionId)) ?? null;
            const needsSiteVisit = caseNeedsSiteVisit({
                reason: item.reason,
                maiosRoute,
            });
            return {
                id: item.id,
                caseRef: caseRef(item.id, String(item.createdAt)),
                farmerId: item.farmerId ? String(item.farmerId) : null,
                sessionId: item.sessionId ? String(item.sessionId) : null,
                farmerName: item.farmerName,
                farmerPhone: item.farmerPhone,
                cropType: item.cropType ?? primary?.crop_type ?? '—',
                dap: primary?.dap ?? null,
                confidence: item.confidence != null ? Number(item.confidence) : null,
                priority: item.priority,
                status: item.status,
                reason: item.reason,
                createdAt: item.createdAt,
                createdLabel: item.createdLabel,
                timeAgo: timeAgo(String(item.createdAt)),
                farmerDisagrees: Boolean(fb),
                feedbackId: fb?.id ?? null,
                maiosRoute,
                needsSiteVisit,
            };
        }));
        return { items: enriched, total, page, limit };
    },
    async getCaseDetail(escalationId) {
        const esc = await escalationAdminService.getById(escalationId);
        const { data: sessionRow } = await supabase
            .from('ai_advisory_sessions')
            .select('*, ai_advisory_outputs(*)')
            .eq('id', esc.sessionId)
            .maybeSingle();
        const outputs = sessionRow?.ai_advisory_outputs ?? [];
        const latestOutput = pickLatestOutput(outputs);
        const plantId = sessionRow?.plant_id_result;
        const sessionCreated = sessionRow?.created_at ? String(sessionRow.created_at) : null;
        const { data: imageLogs } = await supabase
            .from('interaction_logs')
            .select('id, message_type, content, created_at, raw_payload')
            .eq('farmer_id', esc.farmerId)
            .eq('direction', 'inbound')
            .order('created_at', { ascending: false })
            .limit(20);
        const images = [];
        const mainPath = sessionRow?.image_storage_path ? String(sessionRow.image_storage_path) : null;
        if (mainPath) {
            const url = await resolveAdvisoryImageUrl(mainPath);
            await pushFarmerImage(images, {
                id: 'session-main',
                url,
                caption: sessionRow?.symptoms_text ? String(sessionRow.symptoms_text).slice(0, 120) : null,
                at: sessionCreated ?? new Date().toISOString(),
            });
        }
        for (const log of imageLogs ?? []) {
            if (images.length >= 6)
                break;
            const payload = log.raw_payload ?? {};
            const nestedMessage = payload.message;
            const path = payload.storagePath ||
                payload.image_storage_path ||
                payload.path ||
                nestedMessage?.storagePath ||
                null;
            let url = path ? await resolveAdvisoryImageUrl(path) : null;
            if (!url)
                url = urlFromWhatsAppPayload(payload);
            if (!url && nestedMessage)
                url = urlFromWhatsAppPayload(nestedMessage);
            const msgType = String(log.message_type ?? '');
            const isMediaType = ['image', 'image_message', 'document', 'photo', 'media', 'picture'].includes(msgType);
            if (!url && !path && !isMediaType)
                continue;
            if (!url)
                continue;
            const t = new Date(String(log.created_at)).getTime();
            if (sessionCreated) {
                const s = new Date(sessionCreated).getTime();
                if (Math.abs(t - s) > 72 * 60 * 60 * 1000)
                    continue;
            }
            await pushFarmerImage(images, {
                id: String(log.id),
                url,
                caption: log.content ? String(log.content).slice(0, 200) : null,
                at: String(log.created_at),
            });
        }
        const primary = await blockService.getPrimaryBlock(esc.farmerId);
        const lang = (esc.farmer?.language ?? 'en');
        let weatherSummary = null;
        try {
            weatherSummary = await weatherAlertsService.formatForFarmer(esc.farmerId, lang);
            if (weatherSummary.length > 400)
                weatherSummary = `${weatherSummary.slice(0, 397)}…`;
        }
        catch {
            weatherSummary = null;
        }
        const { data: soil } = await supabase
            .from('crm_soil_reports')
            .select('metrics, reported_at')
            .eq('farmer_id', esc.farmerId)
            .order('reported_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const { data: lastApp } = await supabase
            .from('recommendation_applications')
            .select('technical_name, trade_name, dosage, applied_at')
            .eq('farmer_id', esc.farmerId)
            .order('applied_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const { data: prevRec } = await supabase
            .from('recommendation_records')
            .select('issue_detected, status, outcome, created_at')
            .eq('farmer_id', esc.farmerId)
            .eq('status', 'outcome_recorded')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const { data: feedback } = await supabase
            .from('farmer_advisory_feedback')
            .select('*')
            .eq('session_id', esc.sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const farmerQuestion = resolveFarmerQuestion(sessionRow);
        const probable = resolveProbableIssue(latestOutput, esc.session?.probableIssue ? String(esc.session.probableIssue) : null, farmerQuestion);
        const conf = esc.confidence ??
            (sessionRow?.confidence_score != null ? Number(sessionRow.confidence_score) : null);
        const topDiagnoses = buildTopDiagnoses(probable, conf, plantId, latestOutput?.stress_analysis);
        let whatsappResponse = pickFarmerFacingSummary(latestOutput, lang);
        if (!whatsappResponse || textsLikelySame(whatsappResponse, farmerQuestion)) {
            const escSummary = esc.session?.summaryEn ? String(esc.session.summaryEn).trim() : '';
            if (escSummary && !textsLikelySame(escSummary, farmerQuestion)) {
                whatsappResponse = escSummary;
            }
        }
        if (!whatsappResponse || textsLikelySame(whatsappResponse, farmerQuestion)) {
            const logged = await fetchOutboundWhatsAppReply(esc.farmerId, sessionCreated ?? String(esc.createdAt));
            if (logged && !textsLikelySame(logged, farmerQuestion)) {
                whatsappResponse = logged;
            }
        }
        const { data: farmerRow } = await supabase
            .from('farmers')
            .select('crop_experience_years, village, state')
            .eq('id', esc.farmerId)
            .maybeSingle();
        const { data: similar } = await supabase
            .from('advisory_reuse_cases')
            .select('id, symptom_key, issue_label, district, dap_bucket, advisory_snapshot, created_at')
            .eq('crop_type', sessionRow?.crop_type ?? esc.session?.cropType ?? 'ginger')
            .order('created_at', { ascending: false })
            .limit(6);
        const { data: existingRec } = await supabase
            .from('recommendation_records')
            .select('id, status, issue_detected, recommendation_text, dosage, severity, metadata')
            .eq('ai_session_id', esc.sessionId)
            .not('status', 'in', '(rejected,cancelled)')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const savedCorrection = parseEscalationCorrection(esc.correction);
        const recMeta = existingRec?.metadata ?? {};
        const savedAction = parseReviewAction(savedCorrection?.action ?? recMeta.caseReviewAction);
        const savedSeverity = savedCorrection?.severity ??
            mapRecordSeverityToUi(existingRec?.severity ? String(existingRec.severity) : null);
        const draftRecommendation = existingRec?.recommendation_text != null
            ? String(existingRec.recommendation_text).trim()
            : '';
        const editableRecommendation = draftRecommendation || whatsappResponse;
        const timeline = [
            {
                at: esc.createdAt,
                label: 'Case created via WhatsApp',
                status: 'done',
                kind: 'whatsapp',
            },
            {
                at: sessionCreated,
                label: 'AI analysis completed',
                status: 'done',
                kind: 'ai',
            },
            ...(feedback
                ? [
                    {
                        at: String(feedback.created_at),
                        label: 'Farmer disagreed with AI',
                        status: 'done',
                        kind: 'farmer',
                    },
                ]
                : []),
            {
                at: null,
                label: 'Awaiting agronomist review',
                status: 'pending',
                kind: 'pending',
            },
        ];
        const sessionMeta = sessionRow?.metadata ?? {};
        let maiosCase = sessionMeta.maiosCase ?? sessionMeta.gingerSopV3 ?? null;
        let gingerSopV3 = sessionMeta.gingerSopV3 ?? maiosCase ?? null;
        if (maiosCase && typeof maiosCase === 'object' && primary) {
            try {
                const cropType = String(primary.crop_type ?? 'ginger');
                const pack = await cropPackLoaderService.load(cropType);
                const fieldCtx = await fieldContextService.loadFieldContext({
                    farmerId: esc.farmerId,
                    blockId: primary.id,
                    dap: primary.dap,
                    pack,
                });
                maiosCase = {
                    ...maiosCase,
                    fieldMetrics: fieldCtx.fieldMetrics ?? maiosCase.fieldMetrics,
                    canopyAudit: fieldCtx.canopyAudit ?? maiosCase.canopyAudit,
                    waterReading: fieldCtx.waterReading ?? maiosCase.waterReading,
                    inputHistory: fieldCtx.inputHistory ?? maiosCase.inputHistory,
                };
            }
            catch (err) {
                logger.warn({ err, escalationId }, 'MAIOS field context refresh failed');
            }
        }
        if (maiosCase && typeof maiosCase === 'object') {
            const g = maiosCase;
            if (g.createdAt) {
                timeline.splice(2, 0, {
                    at: g.createdAt,
                    label: `MAIOS — ${g.evidence?.tier ?? 'T?'} EQS ${g.evidence?.eqs ?? g.evidence?.completenessPct ?? 0} → ${g.route ?? 'pending'}`,
                    status: 'done',
                    kind: 'ai',
                });
            }
            const failedGate = g.gates?.find((x) => !x.passed);
            if (failedGate) {
                timeline.splice(timeline.length - 1, 0, {
                    at: g.createdAt ?? sessionCreated,
                    label: `Gate ${failedGate.gate}: ${failedGate.reason}`,
                    status: 'done',
                    kind: 'ai',
                });
            }
        }
        return {
            escalation: {
                id: esc.id,
                farmerId: esc.farmerId,
                caseRef: caseRef(esc.id, String(esc.createdAt)),
                sessionId: esc.sessionId,
                status: esc.status,
                priority: esc.priority,
                reason: esc.reason,
                confidence: conf,
                createdAt: esc.createdAt,
                createdLabel: esc.createdLabel,
                timeAgo: timeAgo(String(esc.createdAt)),
                agronomistNotes: esc.agronomistNotes,
                correction: esc.correction,
            },
            lifecycle: sessionRow
                ? {
                    confidenceBand: sessionRow.confidence_band
                        ? String(sessionRow.confidence_band)
                        : null,
                    autoSent: Boolean(sessionRow.auto_sent),
                    autoSentAt: sessionRow.auto_sent_at ? String(sessionRow.auto_sent_at) : null,
                    humanReviewed: Boolean(sessionRow.human_reviewed),
                    humanReviewedAt: sessionRow.human_reviewed_at
                        ? String(sessionRow.human_reviewed_at)
                        : null,
                    humanReviewedBy: sessionRow.human_reviewed_by
                        ? String(sessionRow.human_reviewed_by)
                        : null,
                    corrected: Boolean(sessionRow.corrected),
                    correctedAt: sessionRow.corrected_at ? String(sessionRow.corrected_at) : null,
                    routingDecidedAt: sessionRow.routing_decided_at
                        ? String(sessionRow.routing_decided_at)
                        : null,
                }
                : null,
            farmer: esc.farmer,
            block: primary
                ? {
                    id: primary.id,
                    name: primary.name,
                    cropType: primary.crop_type,
                    dap: primary.dap,
                }
                : null,
            location: {
                district: esc.farmer?.district ?? null,
                village: farmerRow?.village ? String(farmerRow.village) : null,
                state: farmerRow?.state ? String(farmerRow.state) : null,
                weatherSummary,
            },
            images,
            inquiry: {
                farmerQuestion: farmerQuestion || null,
                whatsappResponse: whatsappResponse || null,
            },
            review: {
                action: savedAction ?? null,
                correctDiagnosis: savedCorrection?.correctDiagnosis ??
                    existingRec?.issue_detected ??
                    probable,
                severity: savedSeverity ?? null,
                recommendationText: editableRecommendation || null,
                dosage: existingRec?.dosage ? String(existingRec.dosage) : null,
                notesForLearning: esc.agronomistNotes ? String(esc.agronomistNotes) : null,
                recommendationId: existingRec?.id ? String(existingRec.id) : null,
                recommendationStatus: existingRec?.status ? String(existingRec.status) : null,
            },
            ai: {
                topDiagnoses,
                summary: whatsappResponse || '',
                probableIssue: probable,
                confidence: conf,
                treatments: latestOutput?.treatment_recommendations ?? esc.session?.treatments,
                precautions: latestOutput?.precautions ?? esc.session?.precautions,
            },
            confidenceBreakdown: confidenceBreakdown(conf, Boolean(sessionRow?.crop_type), images.length > 0, Boolean(weatherSummary)),
            context: {
                lastSpray: lastApp
                    ? {
                        product: lastApp.trade_name ?? lastApp.technical_name ?? '—',
                        dosage: lastApp.dosage,
                        at: formatDt(String(lastApp.applied_at)),
                        appliedAt: String(lastApp.applied_at),
                    }
                    : null,
                soil: soil
                    ? (() => {
                        const m = soil.metrics ?? {};
                        return {
                            ph: m.ph ?? m.pH ?? null,
                            ec: m.ec ?? m.EC ?? null,
                            organicCarbon: m.organic_carbon ?? m.oc ?? null,
                            testedAt: formatDt(String(soil.reported_at)),
                        };
                    })()
                    : null,
                previousIssue: prevRec
                    ? {
                        issue: prevRec.issue_detected,
                        outcome: prevRec.outcome,
                        status: prevRec.status,
                    }
                    : null,
                rainfallNote: weatherSummary?.includes('mm') ? weatherSummary.split('\n')[0] : null,
            },
            farmerFeedback: feedback
                ? {
                    id: feedback.id,
                    status: feedback.status,
                    disagrees: true,
                    farmerDiagnosis: feedback.farmer_suggested_diagnosis,
                    farmerExperience: feedback.farmer_prior_experience,
                    farmerProduct: feedback.farmer_prior_product,
                    farmerOutcome: feedback.farmer_prior_outcome,
                    aiIssue: feedback.ai_probable_issue,
                    cropExperienceYears: feedback.crop_experience_years != null
                        ? Number(feedback.crop_experience_years)
                        : farmerRow?.crop_experience_years != null
                            ? Number(farmerRow.crop_experience_years)
                            : null,
                }
                : null,
            productRecommendations: esc.productRecommendations,
            similarCases: (similar ?? []).map((s) => {
                const snap = s.advisory_snapshot;
                return {
                    id: s.id,
                    symptomKey: s.symptom_key,
                    issueLabel: s.issue_label ?? snap?.probableIssue ?? String(s.symptom_key),
                    district: s.district,
                    dap: s.dap_bucket,
                };
            }),
            existingRecommendation: existingRec
                ? {
                    id: String(existingRec.id),
                    status: String(existingRec.status),
                    issueDetected: existingRec.issue_detected,
                    recommendationText: existingRec.recommendation_text,
                }
                : null,
            gingerSopV3,
            maiosCase,
            timeline,
        };
    },
    async submitReview(escalationId, body, agent) {
        const agentEmail = agent.email;
        const { agronomistTierService } = await import('./agronomist-tier.service.js');
        const selfApprove = await agronomistTierService.canSelfApproveRecommendations(agent.adminUserId, agentEmail, agent.role);
        const detail = await this.getCaseDetail(escalationId);
        const esc = detail.escalation;
        const issue = body.action === 'approve_ai'
            ? String(detail.ai.probableIssue ?? 'Field issue')
            : body.correctDiagnosis?.trim() ||
                String(detail.ai.probableIssue ?? 'Field issue');
        const recText = body.recommendationText?.trim() ||
            detail.review.recommendationText?.trim() ||
            detail.inquiry.whatsappResponse?.trim() ||
            detail.ai.summary ||
            `Agronomist reviewed: ${issue}`;
        const recordSeverity = mapUiSeverityToRecord(body.severity);
        const nextRecStatus = body.submitForApproval ? 'pending_approval' : 'draft';
        let recommendationId = detail.review.recommendationId
            ? String(detail.review.recommendationId)
            : null;
        if (recommendationId) {
            await supabase
                .from('recommendation_records')
                .update({
                issue_detected: issue,
                recommendation_text: recText,
                dosage: body.dosage ?? null,
                severity: recordSeverity,
                status: nextRecStatus,
                reviewed_by: agentEmail,
                updated_at: new Date().toISOString(),
                metadata: {
                    caseReviewAction: body.action,
                    notesForLearning: body.notesForLearning ?? null,
                    farmerQuestion: detail.inquiry.farmerQuestion ?? null,
                },
            })
                .eq('id', recommendationId);
        }
        else {
            const row = await recommendationRecordsService.create({
                farmerId: esc.farmerId,
                blockId: detail.block?.id,
                aiSessionId: esc.sessionId,
                source: 'agronomist',
                issueDetected: issue,
                recommendationText: recText,
                dosage: body.dosage,
                language: String(detail.farmer?.language ?? 'en').slice(0, 2),
                createdBy: agentEmail,
                status: nextRecStatus,
                severity: recordSeverity ?? undefined,
            });
            recommendationId = String(row.id);
            await supabase
                .from('recommendation_records')
                .update({
                metadata: {
                    caseReviewAction: body.action,
                    notesForLearning: body.notesForLearning ?? null,
                    farmerQuestion: detail.inquiry.farmerQuestion ?? null,
                },
            })
                .eq('id', recommendationId);
        }
        const newStatus = body.action === 'escalate_urgent' || body.action === 'reject_recommendation'
            ? 'in_review'
            : body.submitForApproval
                ? 'in_review'
                : 'resolved';
        const newPriority = body.action === 'escalate_urgent' ? 'urgent' : undefined;
        await escalationAdminService.update(escalationId, {
            status: newStatus,
            assignedTo: agentEmail,
            comment: body.notesForLearning,
            commentRole: 'agronomist',
            resolution: body.action === 'approve_ai'
                ? 'AI diagnosis approved by agronomist'
                : body.action === 'partial_match'
                    ? 'Partial match — agronomist correction applied'
                    : body.action === 'correct_ai'
                        ? 'Agronomist corrected AI diagnosis'
                        : body.action === 'reject_recommendation'
                            ? 'Recommendation rejected — pending alternate guidance'
                            : 'Escalated for senior review',
            correction: {
                action: body.action,
                correctDiagnosis: body.correctDiagnosis ?? null,
                severity: body.severity ?? null,
                recommendationId,
                reviewedAt: new Date().toISOString(),
            },
        }, agentEmail);
        if (newPriority) {
            await supabase
                .from('agronomist_escalations')
                .update({ priority: newPriority, updated_at: new Date().toISOString() })
                .eq('id', escalationId);
        }
        let selfApproved = false;
        if (body.submitForApproval && recommendationId) {
            const latestOutput = detail.ai;
            const costEst = latestOutput.costEstimate?.[0];
            const treatmentCost = costEst?.note
                ? Number(String(costEst.note).replace(/[^\d.]/g, '')) || undefined
                : undefined;
            const economic = economicGateService.assess({
                treatmentCostInr: treatmentCost,
                expectedBenefitInr: treatmentCost ? treatmentCost * 1.2 : undefined,
            });
            const fusedConf = detail.maiosCase
                ?.diagnostics?.fusedConfidence;
            if (!economic.proceed &&
                (fusedConf ?? detail.ai.confidence ?? 0) < 0.8 &&
                body.action === 'approve_ai') {
                throw new Error(`Economic gate blocked auto-approval: ${economic.reason}. Correct diagnosis or escalate.`);
            }
            const currentStatus = detail.review.recommendationStatus;
            if (currentStatus !== 'pending_approval') {
                await agronomistWorkflowService.submitForApproval(recommendationId, agentEmail);
            }
            if (selfApprove) {
                const { recommendationRecordsService } = await import('../core/recommendation-records.service.js');
                const { verifiedAdvisoryLearningService } = await import('../core/verified-advisory-learning.service.js');
                const { recommendationCommunicationService } = await import('../core/recommendation-communication.service.js');
                await recommendationRecordsService.approve(recommendationId, agentEmail);
                await verifiedAdvisoryLearningService
                    .promoteFromRecommendationRecord(recommendationId, agentEmail)
                    .catch(() => { });
                await recommendationCommunicationService
                    .sendApprovedRecommendation(recommendationId)
                    .catch(() => { });
                selfApproved = true;
            }
        }
        if (body.action === 'correct_ai' && esc.sessionId) {
            void goldLearningQueueService.enqueue({
                sessionId: esc.sessionId,
                cropType: String(detail.block?.cropType ?? ''),
                district: detail.location.district ? String(detail.location.district) : undefined,
                failureType: 'agronomist_failure',
                metadata: { action: body.action, correctDiagnosis: body.correctDiagnosis },
            });
        }
        if (recommendationId &&
            body.submitForApproval &&
            (body.action === 'approve_ai' ||
                body.action === 'correct_ai' ||
                body.action === 'partial_match')) {
            const { verifiedAdvisoryLearningService } = await import('../core/verified-advisory-learning.service.js');
            await verifiedAdvisoryLearningService
                .promoteFromRecommendationRecord(recommendationId, agentEmail)
                .catch(() => { });
            const { expertFollowUpLearningService } = await import('../core/expert-follow-up-learning.service.js');
            let farmerSymptoms = detail.inquiry.farmerQuestion?.trim() ?? '';
            if (!farmerSymptoms && esc.sessionId) {
                const { data: sessRow } = await supabase
                    .from('ai_advisory_sessions')
                    .select('symptoms_text, crop_type')
                    .eq('id', esc.sessionId)
                    .maybeSingle();
                farmerSymptoms = sessRow?.symptoms_text ? String(sessRow.symptoms_text).trim() : '';
            }
            const intakeQa = esc.sessionId
                ? await expertFollowUpLearningService.loadIntakeQaFromSession(esc.sessionId)
                : [];
            void expertFollowUpLearningService
                .onCaseReviewApproved({
                sessionId: esc.sessionId,
                recommendationId,
                farmerId: esc.farmerId,
                cropType: String(detail.block?.cropType ?? 'ginger').toLowerCase(),
                district: detail.location.district
                    ? String(detail.location.district).trim().toLowerCase()
                    : null,
                symptomsText: farmerSymptoms || issue,
                issueLabel: issue,
                expertNotes: body.notesForLearning ?? detail.review.notesForLearning ?? null,
                verifiedBy: agentEmail,
                intakeQa,
            })
                .catch((err) => logger.warn({ err, escalationId }, 'Expert follow-up save failed'));
        }
        if (detail.farmerFeedback &&
            (body.action === 'approve_ai' || body.action === 'partial_match' || body.action === 'correct_ai')) {
            await supabase
                .from('farmer_advisory_feedback')
                .update({
                status: body.action === 'partial_match' ? 'partial' : 'approved',
                agronomist_final_diagnosis: issue,
                agronomist_notes: body.notesForLearning ?? null,
                reviewed_by: agentEmail,
                reviewed_at: new Date().toISOString(),
                metadata: {
                    updated_recommendation: recText.trim().slice(0, 4000),
                    promoted_from_case_review: true,
                },
                updated_at: new Date().toISOString(),
            })
                .eq('id', detail.farmerFeedback.id);
        }
        const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
        void farmerEventCaptureService.trackCaseReviewSubmitted({
            farmerId: detail.escalation.farmerId,
            escalationId,
            recommendationId: recommendationId ?? null,
            agentEmail,
            submittedForApproval: Boolean(body.submitForApproval),
            selfApproved,
        });
        const { aiTrainingEventService } = await import('../core/ai-training-event.service.js');
        void aiTrainingEventService.recordFromCaseReview({
            farmerId: detail.escalation.farmerId,
            blockId: detail.block?.id ?? null,
            aiSessionId: detail.escalation.sessionId ?? null,
            escalationId,
            recommendationRecordId: recommendationId,
            aiPrediction: detail.ai.probableIssue ?? null,
            aiConfidence: detail.ai.confidence ?? null,
            aiTopK: (detail.ai.topDiagnoses ?? []).map((d) => ({
                label: d.label,
                confidence: d.confidence ?? null,
            })),
            action: body.action,
            correctDiagnosis: body.correctDiagnosis ?? null,
            notesForLearning: body.notesForLearning ?? null,
            reviewedBy: agentEmail,
        });
        if (detail.escalation.sessionId) {
            void confidenceLifecycleService.markHumanReviewed(detail.escalation.sessionId, {
                reviewedBy: agentEmail,
                corrected: body.action === 'correct_ai' || body.action === 'partial_match',
                action: body.action,
            });
        }
        let learningFacadeRecorded = false;
        if (isAgronomistVerifyAction(body.action) && issue.trim()) {
            const maiosCase = detail.maiosCase;
            try {
                await maiosLearningFacadeService.recordAgronomistVerifiedOutcome({
                    farmerId: esc.farmerId,
                    cropType: String(detail.block?.cropType ?? 'ginger').toLowerCase(),
                    verifiedIssueLabel: issue.trim(),
                    sessionId: esc.sessionId ?? undefined,
                    reasoning: maiosCase?.reasoning ?? null,
                    reviewAction: body.action,
                });
                learningFacadeRecorded = true;
            }
            catch (err) {
                logger.warn({ err, escalationId }, 'MAIOS learning facade case review record failed');
            }
        }
        return {
            escalationId,
            recommendationId,
            submittedForApproval: Boolean(body.submitForApproval),
            selfApproved,
            verifiedAnswerIndexed: selfApproved,
            learningFacadeRecorded,
            message: body.submitForApproval
                ? selfApproved
                    ? 'Approved and sent to the farmer. Similar questions will reuse this answer.'
                    : 'Submitted for Super Admin approval. Verified reuse is indexed after approval.'
                : 'Review saved as draft.',
        };
    },
    async listDiagnosisLabels(params) {
        const labels = new Set();
        const crop = params.cropType?.trim().toLowerCase() || null;
        const search = params.search?.trim().toLowerCase() || '';
        const defaultLabels = [
            'Pyricularia leaf blast',
            'high humidity',
            'rain-induced disease spread risk',
            'Thrips damage',
            'Heat stress',
            'Leaf spot (fungal)',
            'Nutrient deficiency',
            'Root rot',
            'Bacterial wilt',
            'Compost comparison — vermi vs city',
            'Organic matter / compost advisory',
            'Fertigation scheduling',
            'Weed management',
        ];
        for (const label of defaultLabels)
            labels.add(label);
        const { data: masters, error: mErr } = await supabase
            .from('crm_masters')
            .select('name, category')
            .eq('master_type', 'disease')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true })
            .limit(300);
        if (mErr)
            throw mErr;
        for (const row of masters ?? []) {
            const name = String(row.name ?? '').trim();
            if (!name)
                continue;
            const rowCrop = row.category ? String(row.category).trim().toLowerCase() : null;
            if (!crop || !rowCrop || rowCrop === crop)
                labels.add(name);
        }
        let rtq = supabase
            .from('recommendation_templates')
            .select('issue_label_en, crop_type, issue_key')
            .not('issue_label_en', 'is', null)
            .neq('status', 'archived')
            .limit(200);
        if (crop)
            rtq = rtq.eq('crop_type', crop);
        const { data: templates, error: tErr } = await rtq;
        if (tErr)
            throw tErr;
        for (const row of templates ?? []) {
            const name = String(row.issue_label_en ?? '').trim();
            if (name)
                labels.add(name);
        }
        const { data: history, error: hErr } = await supabase
            .from('disease_history')
            .select('issue_label, crop_type')
            .order('recorded_at', { ascending: false })
            .limit(300);
        if (hErr)
            throw hErr;
        for (const row of history ?? []) {
            const name = String(row.issue_label ?? '').trim();
            if (!name)
                continue;
            const rowCrop = row.crop_type ? String(row.crop_type).trim().toLowerCase() : null;
            if (!crop || !rowCrop || rowCrop === crop)
                labels.add(name);
        }
        let list = [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        if (search) {
            list = list.filter((label) => label.toLowerCase().includes(search));
        }
        return list.slice(0, 120);
    },
    async createDiagnosisLabel(params) {
        const name = params.label.trim();
        if (!name)
            throw new Error('Diagnosis label is required');
        const crop = params.cropType?.trim().toLowerCase() || null;
        const { data: existing, error: findErr } = await supabase
            .from('crm_masters')
            .select('id, name')
            .eq('master_type', 'disease')
            .ilike('name', name)
            .maybeSingle();
        if (findErr)
            throw findErr;
        if (existing?.id) {
            return { id: String(existing.id), label: String(existing.name) };
        }
        const { data, error } = await supabase
            .from('crm_masters')
            .insert({
            master_type: 'disease',
            name,
            category: crop,
            active: true,
            sort_order: 50,
        })
            .select('id, name')
            .single();
        if (error)
            throw error;
        return { id: String(data.id), label: String(data.name) };
    },
};
//# sourceMappingURL=agronomist-case-review.service.js.map