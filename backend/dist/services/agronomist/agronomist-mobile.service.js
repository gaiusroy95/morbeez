import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { formatPhoneE164 } from '../../lib/phone.js';
import { fieldPwaService } from '../admin/field-pwa.service.js';
import { crmFarmerService } from '../admin/crm-farmer.service.js';
import { cropHealthFromTone } from '../../lib/block-health.js';
import { blockService } from '../core/block.service.js';
import { agronomistIntelligenceService } from '../intelligence/agronomist-intelligence.service.js';
import { agronomistCaseReviewService } from '../admin/agronomist-case-review.service.js';
import { agronomistWorkflowService } from '../admin/agronomist-workflow.service.js';
import { recommendationFollowUpService } from '../core/recommendation-follow-up.service.js';
import { recommendationRecordsService } from '../core/recommendation-records.service.js';
import { resolveAdvisoryImageUrl, urlFromWhatsAppPayload, } from '../core/advisory-image-storage.service.js';
import { normalizeSoilMetrics, SOIL_MACRO_FIELDS } from '../soil/soil-lab-metrics.js';
import { getFarmerSuggestedDiagnosesFromStored } from '../../domain/learning/farmer-nutrient-suggestions.js';
function soilMetricCells(metrics) {
    return SOIL_MACRO_FIELDS.slice(0, 6)
        .map((f) => {
        const v = metrics.macro[f.key];
        if (!v?.value)
            return null;
        const unit = f.unit ? ` ${f.unit}` : '';
        return { label: f.label, value: `${v.value}${unit}` };
    })
        .filter(Boolean);
}
function haversineKm(lat1, lng1, lat2, lng2) {
    const r = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
/** preferred_time is free text in DB — only expose parseable ISO timestamps as due dates. */
function parseOptionalDueAt(value) {
    if (!value?.trim())
        return null;
    const v = value.trim();
    if (v === 'any' || v === 'asap')
        return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : v;
}
function taskKey(kind, entityId) {
    return `${kind}-${entityId}`;
}
function normalizeJoinRow(raw) {
    if (!raw)
        return null;
    if (Array.isArray(raw))
        return raw[0] ?? null;
    return raw;
}
function farmerDisplayName(row) {
    if (!row)
        return null;
    const first = String(row.first_name ?? '').trim();
    const last = String(row.last_name ?? '').trim();
    const combined = [first, last].filter(Boolean).join(' ');
    return combined || String(row.name ?? '').trim() || null;
}
async function resolveLeadId(farmerId) {
    const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('farmer_id', farmerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data?.id ? String(data.id) : null;
}
function mapFarmerFromJoin(farmerId, f) {
    return {
        id: farmerId,
        phone: formatPhoneE164(f?.phone != null ? String(f.phone) : null),
        name: [f?.first_name, f?.last_name].filter(Boolean).join(' ') ||
            String(f?.name ?? '').trim() ||
            'Farmer',
        district: f?.district ? String(f.district) : null,
        village: f?.village ? String(f.village) : null,
        preferredLanguage: f?.preferred_language ? String(f.preferred_language) : 'en',
    };
}
function farmersFromRelationRows(rows, limit) {
    const seen = new Set();
    const farmers = [];
    for (const row of rows) {
        const fid = String(row.farmer_id);
        if (seen.has(fid))
            continue;
        seen.add(fid);
        const joined = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
        farmers.push(mapFarmerFromJoin(fid, joined ?? null));
        if (farmers.length >= limit)
            break;
    }
    return farmers;
}
async function loadAiSessionVisitImages(farmerId, aiSessionId) {
    const images = [];
    const seenUrls = new Set();
    const pushImage = (url, caption) => {
        if (!url || seenUrls.has(url) || images.length >= 6)
            return;
        seenUrls.add(url);
        images.push({ url, caption });
    };
    const { data: sessionRow } = await supabase
        .from('ai_advisory_sessions')
        .select('image_storage_path, symptoms_text, created_at, crop_type, confidence_score')
        .eq('id', aiSessionId)
        .maybeSingle();
    const symptomsText = sessionRow?.symptoms_text ? String(sessionRow.symptoms_text).trim() : null;
    const sessionCreated = sessionRow?.created_at ? String(sessionRow.created_at) : null;
    const cropType = sessionRow?.crop_type ? String(sessionRow.crop_type) : null;
    const aiConfidence = sessionRow?.confidence_score != null ? Number(sessionRow.confidence_score) : null;
    const { data: outputRow } = await supabase
        .from('ai_advisory_outputs')
        .select('probable_issue')
        .eq('session_id', aiSessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    const aiDiagnosis = outputRow?.probable_issue ? String(outputRow.probable_issue) : null;
    const mainPath = sessionRow?.image_storage_path ? String(sessionRow.image_storage_path) : null;
    if (mainPath) {
        const url = await resolveAdvisoryImageUrl(mainPath);
        pushImage(url, symptomsText ? symptomsText.slice(0, 120) : null);
    }
    const { data: imageLogs } = await supabase
        .from('interaction_logs')
        .select('id, message_type, content, created_at, raw_payload')
        .eq('farmer_id', farmerId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(20);
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
        pushImage(url, log.content ? String(log.content).slice(0, 200) : null);
    }
    return { symptomsText, images, cropType, aiDiagnosis, aiConfidence };
}
async function loadFarmerFeedbackForVisit(params) {
    const empty = {
        farmerFeedbackId: null,
        farmerSuggestedDiagnosis: null,
        farmerSuggestedDiagnoses: [],
        farmerRefinedConditions: [],
        farmerRefineSequenceSummary: null,
        farmerPriorExperience: null,
        farmerPriorProduct: null,
        farmerPriorOutcome: null,
    };
    const select = 'id, farmer_suggested_diagnosis, farmer_prior_experience, farmer_prior_product, farmer_prior_outcome, session_id, escalation_id, created_at, status, metadata';
    const mapRow = (fb) => {
        if (!fb)
            return empty;
        const experience = fb.farmer_prior_experience
            ? String(fb.farmer_prior_experience).trim()
            : '';
        const metadata = fb.metadata ?? null;
        const diagnoses = getFarmerSuggestedDiagnosesFromStored({
            farmer_suggested_diagnosis: fb.farmer_suggested_diagnosis
                ? String(fb.farmer_suggested_diagnosis)
                : null,
            farmer_prior_experience: experience || null,
            metadata,
        });
        const primary = diagnoses[0] ?? (fb.farmer_suggested_diagnosis ? String(fb.farmer_suggested_diagnosis) : null);
        const refined = metadata?.farmer_refined_assessment;
        const farmerRefinedConditions = Array.isArray(refined?.conditions)
            ? refined.conditions
                .map((c) => ({
                label: String(c.label ?? '').trim(),
                probability: Number(c.probability ?? 0),
                probabilityLow: c.probabilityLow != null && Number.isFinite(Number(c.probabilityLow))
                    ? Number(c.probabilityLow)
                    : undefined,
                probabilityHigh: c.probabilityHigh != null && Number.isFinite(Number(c.probabilityHigh))
                    ? Number(c.probabilityHigh)
                    : undefined,
                likelihood: c.likelihood ? String(c.likelihood) : undefined,
                role: c.role ? String(c.role) : undefined,
                reason: c.reason ? String(c.reason) : undefined,
            }))
                .filter((c) => c.label)
            : [];
        return {
            farmerFeedbackId: fb.id ? String(fb.id) : null,
            farmerSuggestedDiagnosis: primary,
            farmerSuggestedDiagnoses: diagnoses,
            farmerRefinedConditions,
            farmerRefineSequenceSummary: refined?.sequenceSummary
                ? String(refined.sequenceSummary)
                : null,
            farmerPriorExperience: experience || null,
            farmerPriorProduct: fb.farmer_prior_product ? String(fb.farmer_prior_product) : null,
            farmerPriorOutcome: fb.farmer_prior_outcome ? String(fb.farmer_prior_outcome) : null,
        };
    };
    if (params.escalationId) {
        const { data } = await supabase
            .from('farmer_advisory_feedback')
            .select(select)
            .eq('escalation_id', params.escalationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const mapped = mapRow(data);
        if (mapped.farmerSuggestedDiagnosis || mapped.farmerPriorExperience)
            return mapped;
    }
    if (params.aiSessionId) {
        const { data } = await supabase
            .from('farmer_advisory_feedback')
            .select(select)
            .eq('session_id', params.aiSessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const mapped = mapRow(data);
        if (mapped.farmerSuggestedDiagnosis || mapped.farmerPriorExperience)
            return mapped;
    }
    // Latest open/reviewed farmer correction for this farmer (rectification visits).
    const { data: latest } = await supabase
        .from('farmer_advisory_feedback')
        .select(select)
        .eq('farmer_id', params.farmerId)
        .in('status', ['pending_capture', 'pending_review', 'approved', 'partial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return mapRow(latest);
}
export const agronomistMobileService = {
    async getMobileDashboard(agentEmail) {
        const email = agentEmail.trim().toLowerCase();
        const todayStart = `${todayIsoDate()}T00:00:00.000Z`;
        const todayEnd = `${todayIsoDate()}T23:59:59.999Z`;
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [intelligence, visitsToday, followUps, callbacks, escalations, soilReports, aiCases, findingQueue, routesToday,] = await Promise.all([
            agronomistIntelligenceService.getWorkspaceIntelligence(email),
            supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('task_type', 'visit')
                .or(`assigned_agronomist.eq.${email},assigned_to.eq.${email}`)
                .gte('due_at', todayStart)
                .lte('due_at', todayEnd)
                .eq('status', 'pending'),
            supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .or(`assigned_agronomist.eq.${email},assigned_to.eq.${email}`)
                .in('task_type', ['follow_up', 'call', 'other'])
                .lte('due_at', todayEnd)
                .eq('status', 'pending'),
            supabase
                .from('callback_requests')
                .select('id', { count: 'exact', head: true })
                .in('status', ['pending', 'open', 'requested']),
            supabase
                .from('agronomist_escalations')
                .select('id', { count: 'exact', head: true })
                .in('status', ['pending', 'assigned', 'in_review']),
            supabase
                .from('crm_soil_reports')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', weekAgo),
            agronomistCaseReviewService.listQueue({ status: 'open', page: 1, limit: 1 }),
            agronomistWorkflowService.listReviewQueue(1),
            supabase
                .from('agronomist_routes')
                .select('id', { count: 'exact', head: true })
                .eq('agronomist_email', email)
                .eq('route_date', todayIsoDate()),
        ]);
        return {
            todaysVisits: visitsToday.count ?? 0,
            routesToday: routesToday.count ?? 0,
            pendingFollowUps: followUps.count ?? 0,
            pendingCallbacks: callbacks.count ?? 0,
            openEscalations: escalations.count ?? 0,
            newSoilReports: soilReports.count ?? 0,
            aiReviewCases: aiCases.total ?? 0,
            findingReviewQueue: (findingQueue.items ?? []).length,
            focusFarmers: intelligence.focusFarmers,
        };
    },
    async listMobileFarmers(agentEmail, opts) {
        const email = agentEmail.trim().toLowerCase();
        const limit = opts.limit ?? 40;
        let farmers = opts.q?.trim()
            ? await fieldPwaService.searchFarmers(opts.q, limit)
            : [];
        if (!opts.q?.trim() && opts.filter === 'assigned') {
            const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('crm_field_findings')
                .select('farmer_id, farmers(id, phone, name, first_name, last_name, district, village, preferred_language)')
                .eq('agronomist_name', email)
                .gte('visited_at', since90)
                .is('archived_at', null)
                .order('visited_at', { ascending: false })
                .limit(limit);
            throwIfSupabaseError(error, 'Could not load assigned farmers');
            farmers = farmersFromRelationRows(data ?? [], limit);
        }
        if (!farmers.length && !opts.q?.trim() && opts.filter === 'follow_up_due') {
            const todayEnd = `${todayIsoDate()}T23:59:59.999Z`;
            const { data, error } = await supabase
                .from('crm_tasks')
                .select('farmer_id, farmers(id, phone, name, first_name, last_name, district, village, preferred_language)')
                .eq('assigned_to', email)
                .in('task_type', ['follow_up', 'call', 'other'])
                .lte('due_at', todayEnd)
                .in('status', ['pending', 'open', 'in_progress'])
                .not('farmer_id', 'is', null)
                .order('due_at', { ascending: true })
                .limit(limit);
            throwIfSupabaseError(error, 'Could not load follow-up farmers');
            farmers = farmersFromRelationRows(data ?? [], limit);
        }
        if (!farmers.length && !opts.q?.trim() && opts.filter === 'escalation_open') {
            const { data, error } = await supabase
                .from('agronomist_escalations')
                .select('farmer_id, farmers(id, phone, name, first_name, last_name, district, village, preferred_language)')
                .in('status', ['pending', 'assigned', 'in_review'])
                .not('farmer_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(limit);
            throwIfSupabaseError(error, 'Could not load escalation farmers');
            farmers = farmersFromRelationRows(data ?? [], limit);
        }
        if (!farmers.length && !opts.q?.trim()) {
            farmers = await fieldPwaService.listRecentFarmers(limit);
        }
        const enriched = await Promise.all(farmers.map(async (f) => {
            const blocks = await blockService.listByFarmer(f.id);
            const primary = blocks[0];
            let distanceKm = null;
            if (opts.lat != null && opts.lng != null && primary?.latitude != null && primary?.longitude != null) {
                distanceKm = Math.round(haversineKm(opts.lat, opts.lng, primary.latitude, primary.longitude) * 10) / 10;
            }
            const { data: lastVisit } = await supabase
                .from('crm_field_findings')
                .select('visited_at')
                .eq('farmer_id', f.id)
                .is('archived_at', null)
                .order('visited_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            const { count: openTasks } = await supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('farmer_id', f.id)
                .in('status', ['pending', 'open', 'in_progress']);
            return {
                ...f,
                acreage: blocks.reduce((s, b) => s + (b.acreage_decimal ?? 0), 0) || null,
                primaryCrop: primary?.crop_type ?? null,
                dap: primary?.dap ?? null,
                distanceKm,
                healthStatus: 'stable',
                lastVisitAt: lastVisit?.visited_at ? String(lastVisit.visited_at) : null,
                openTaskCount: openTasks ?? 0,
            };
        }));
        let rows = enriched;
        if (opts.filter === 'recently_visited') {
            rows = rows.filter((r) => r.lastVisitAt).sort((a, b) => String(b.lastVisitAt).localeCompare(String(a.lastVisitAt)));
        }
        if (opts.lat != null && opts.lng != null) {
            rows.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
        }
        if (opts.crop?.trim()) {
            const crop = opts.crop.trim().toLowerCase();
            rows = rows.filter((r) => String(r.primaryCrop ?? '').toLowerCase().includes(crop));
        }
        if (opts.village?.trim()) {
            const village = opts.village.trim().toLowerCase();
            rows = rows.filter((r) => String(r.village ?? '').toLowerCase().includes(village));
        }
        return rows.slice(0, limit);
    },
    async getWorkspaceSummary(farmerId) {
        const { data: farmer, error } = await supabase
            .from('farmers')
            .select('id, phone, name, first_name, last_name, district')
            .eq('id', farmerId)
            .single();
        throwIfSupabaseError(error, 'Farmer not found');
        if (!farmer)
            throw new NotFoundError('Farmer not found');
        const blocks = await blockService.listByFarmer(farmerId);
        const acreage = blocks.reduce((s, b) => s + (b.acreage_decimal ?? 0), 0) || null;
        const leadId = await resolveLeadId(farmerId);
        const { data: lastVisit } = await supabase
            .from('crm_field_findings')
            .select('visited_at')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('visited_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const { count: pendingTasks } = await supabase
            .from('crm_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', farmerId)
            .in('status', ['pending', 'open', 'in_progress']);
        const { count: openEscalations } = await supabase
            .from('agronomist_escalations')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', farmerId)
            .in('status', ['pending', 'assigned', 'in_review']);
        const name = [farmer.first_name, farmer.last_name].filter(Boolean).join(' ') ||
            String(farmer.name ?? '').trim() ||
            'Farmer';
        return {
            farmer: {
                id: farmerId,
                name,
                phone: formatPhoneE164(farmer.phone != null ? String(farmer.phone) : null),
                district: farmer.district ? String(farmer.district) : null,
                acreage,
            },
            leadId,
            healthStatus: openEscalations ? 'alert' : 'stable',
            activeCrops: [...new Set(blocks.map((b) => b.crop_type).filter(Boolean))],
            dap: blocks[0]?.dap ?? null,
            lastVisitAt: lastVisit?.visited_at ? String(lastVisit.visited_at) : null,
            pendingTaskCount: pendingTasks ?? 0,
            openEscalationCount: openEscalations ?? 0,
        };
    },
    async listFarmerDocuments(farmerId) {
        const docs = [];
        const { data: soil } = await supabase
            .from('crm_soil_reports')
            .select('id, pdf_url, created_at, reported_at, block_id, farm_blocks(name)')
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(30);
        for (const r of soil ?? []) {
            const block = normalizeJoinRow(r.farm_blocks);
            docs.push({
                id: String(r.id),
                type: 'soil_report',
                title: `Soil report — ${String(block?.name ?? 'Block')}`,
                url: r.pdf_url ? String(r.pdf_url) : null,
                createdAt: String(r.created_at ?? r.reported_at),
            });
        }
        const { data: recs } = await supabase
            .from('recommendation_records')
            .select('id, issue_detected, created_at, status')
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(20);
        for (const r of recs ?? []) {
            docs.push({
                id: String(r.id),
                type: 'recommendation',
                title: String(r.issue_detected ?? 'Recommendation'),
                url: null,
                createdAt: String(r.created_at),
            });
        }
        return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listUnifiedTasks(agentEmail, filter) {
        const email = agentEmail.trim().toLowerCase();
        const tasks = [];
        if (!filter || filter === 'visit' || filter === 'all') {
            const { data } = await supabase
                .from('crm_tasks')
                .select('id, title, task_type, due_at, status, farmer_id, lead_id, block_id, notes')
                .eq('task_type', 'visit')
                .or(`assigned_agronomist.eq.${email},assigned_to.eq.${email}`)
                .eq('status', 'pending')
                .order('due_at', { ascending: true })
                .limit(50);
            for (const t of data ?? []) {
                const entityId = String(t.id);
                tasks.push({
                    id: taskKey('visit', entityId),
                    kind: 'visit',
                    title: String(t.title ?? 'Scheduled visit'),
                    subtitle: 'Visit task',
                    dueAt: t.due_at ? String(t.due_at) : null,
                    status: String(t.status),
                    farmerId: t.farmer_id ? String(t.farmer_id) : null,
                    leadId: t.lead_id ? String(t.lead_id) : null,
                    blockId: t.block_id ? String(t.block_id) : null,
                    refId: entityId,
                    needsSiteVisit: true,
                });
            }
        }
        if (!filter || filter === 'follow_up' || filter === 'all') {
            const { data } = await supabase
                .from('crm_tasks')
                .select('id, title, task_type, due_at, status, farmer_id, lead_id, priority, task_category')
                .or(`assigned_agronomist.eq.${email},assigned_to.eq.${email}`)
                .in('task_type', ['follow_up', 'call', 'other'])
                .eq('status', 'pending')
                .order('due_at', { ascending: true })
                .limit(50);
            for (const t of data ?? []) {
                const entityId = String(t.id);
                tasks.push({
                    id: taskKey('follow_up', entityId),
                    kind: 'follow_up',
                    title: String(t.title ?? 'Follow-up'),
                    subtitle: String(t.task_type),
                    dueAt: t.due_at ? String(t.due_at) : null,
                    status: String(t.status),
                    farmerId: t.farmer_id ? String(t.farmer_id) : null,
                    leadId: t.lead_id ? String(t.lead_id) : null,
                    refId: entityId,
                });
            }
        }
        if (!filter || filter === 'callback' || filter === 'all') {
            const callbacks = await this.listCallbacks(email);
            for (const c of callbacks) {
                tasks.push({
                    id: taskKey('callback', c.id),
                    kind: 'callback',
                    title: c.reason ?? 'Callback',
                    subtitle: c.farmerName ?? c.phone ?? 'Farmer',
                    dueAt: c.dueAt,
                    status: c.status,
                    farmerId: c.farmerId,
                    refId: c.id,
                });
            }
        }
        const aiReviewEscalationIds = new Set();
        const siteVisitEscalationIds = new Set();
        if (!filter || filter === 'ai_review' || filter === 'escalation' || filter === 'all') {
            const queue = await agronomistCaseReviewService.listQueue({ status: 'open', page: 1, limit: 15 });
            for (const c of queue.items ?? []) {
                const entityId = String(c.id);
                const needsSiteVisit = Boolean(c.needsSiteVisit);
                // Field-routed AI cases belong in the site-visit / escalation path, not desk review.
                if (needsSiteVisit) {
                    siteVisitEscalationIds.add(entityId);
                    if (!filter || filter === 'escalation' || filter === 'all') {
                        tasks.push({
                            id: taskKey('escalation', entityId),
                            kind: 'escalation',
                            title: String(c.reason ?? 'Site visit required'),
                            subtitle: c.farmerName
                                ? `${c.farmerName} · Site visit`
                                : c.confidence != null
                                    ? `Site visit · ${Math.round(Number(c.confidence) * 100)}%`
                                    : 'Site visit required',
                            dueAt: c.createdAt ? String(c.createdAt) : null,
                            status: String(c.status ?? 'open'),
                            farmerId: c.farmerId ?? null,
                            refId: entityId,
                            needsSiteVisit: true,
                        });
                    }
                    continue;
                }
                aiReviewEscalationIds.add(entityId);
                if (!filter || filter === 'ai_review' || filter === 'all') {
                    tasks.push({
                        id: taskKey('ai_review', entityId),
                        kind: 'ai_review',
                        title: String(c.reason ?? 'AI review'),
                        subtitle: c.confidence != null ? `Confidence ${Math.round(Number(c.confidence) * 100)}%` : 'Needs review',
                        dueAt: c.createdAt ? String(c.createdAt) : null,
                        status: String(c.status ?? 'open'),
                        farmerId: c.farmerId ?? null,
                        refId: entityId,
                        needsSiteVisit: false,
                    });
                }
            }
        }
        if (!filter || filter === 'escalation' || filter === 'all') {
            const esc = await this.listEscalations({ status: 'open' });
            for (const e of esc) {
                if ((!filter || filter === 'all') &&
                    (aiReviewEscalationIds.has(e.id) || siteVisitEscalationIds.has(e.id))) {
                    continue;
                }
                if (siteVisitEscalationIds.has(e.id))
                    continue;
                tasks.push({
                    id: taskKey('escalation', e.id),
                    kind: 'escalation',
                    title: e.summary ?? e.type,
                    subtitle: e.farmerName ?? 'Escalation',
                    dueAt: null,
                    status: e.status,
                    farmerId: e.farmerId,
                    refId: e.id,
                    needsSiteVisit: true,
                });
            }
        }
        if (!filter || filter === 'finding_review' || filter === 'all') {
            const fq = await agronomistWorkflowService.listReviewQueue(15);
            for (const raw of fq.items ?? []) {
                const item = raw;
                const entityId = item.finding.id;
                tasks.push({
                    id: taskKey('finding_review', entityId),
                    kind: 'finding_review',
                    title: item.farmer?.name ?? item.farmer?.phone ?? 'Finding review',
                    subtitle: `${item.finding.blockName} · ${item.finding.cropType}`,
                    dueAt: item.finding.visitedAt,
                    status: item.existingRecommendation?.status ?? 'pending',
                    refId: entityId,
                });
            }
        }
        return tasks;
    },
    async listCallbacks(_agentEmail) {
        const { data, error } = await supabase
            .from('callback_requests')
            .select('id, farmer_id, telecaller_notes, status, created_at, preferred_time, farmers(name, phone)')
            .in('status', ['pending', 'open', 'requested'])
            .order('created_at', { ascending: false })
            .limit(40);
        throwIfSupabaseError(error, 'Could not load callbacks');
        return (data ?? []).map((r) => {
            const f = r.farmers;
            return {
                id: String(r.id),
                farmerId: String(r.farmer_id),
                farmerName: f?.name ?? null,
                phone: formatPhoneE164(f?.phone != null ? String(f.phone) : null),
                reason: r.telecaller_notes ? String(r.telecaller_notes) : null,
                status: String(r.status),
                requestedAt: String(r.created_at),
                dueAt: parseOptionalDueAt(r.preferred_time ? String(r.preferred_time) : null),
            };
        });
    },
    async updateCallback(id, status) {
        const { data, error } = await supabase
            .from('callback_requests')
            .update({ status })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update callback');
        return data;
    },
    async createCallback(agentEmail, input) {
        const dueAt = new Date(Date.now() + (input.dueInDays ?? 5) * 24 * 60 * 60 * 1000).toISOString();
        const leadId = await resolveLeadId(input.farmerId);
        const { data, error } = await supabase
            .from('callback_requests')
            .insert({
            farmer_id: input.farmerId,
            lead_id: leadId,
            telecaller_notes: input.reason.slice(0, 500),
            status: 'pending',
            preferred_time: dueAt,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create callback');
        if (leadId) {
            await supabase.from('crm_tasks').insert({
                lead_id: leadId,
                farmer_id: input.farmerId,
                task_type: 'call',
                title: input.reason.slice(0, 120),
                status: 'pending',
                due_at: dueAt,
                assigned_to: agentEmail,
                notes: 'Callback from agronomist app',
            });
        }
        return data;
    },
    async listEscalations(opts) {
        let query = supabase
            .from('agronomist_escalations')
            .select('id, farmer_id, reason, priority, status, created_at, farmers(name, first_name, last_name)')
            .order('created_at', { ascending: false })
            .limit(50);
        if (opts?.status === 'open') {
            query = query.in('status', ['pending', 'assigned', 'in_review']);
        }
        else if (opts?.status) {
            query = query.eq('status', opts.status);
        }
        if (opts?.farmerId)
            query = query.eq('farmer_id', opts.farmerId);
        const { data, error } = await query;
        throwIfSupabaseError(error, 'Could not load escalations');
        return (data ?? []).map((r) => {
            const f = normalizeJoinRow(r.farmers);
            return {
                id: String(r.id),
                farmerId: r.farmer_id ? String(r.farmer_id) : null,
                farmerName: farmerDisplayName(f),
                type: String(r.priority ?? 'normal'),
                status: String(r.status),
                summary: r.reason ? String(r.reason) : null,
                createdAt: String(r.created_at),
            };
        });
    },
    async getProfileStats(agentEmail) {
        const email = agentEmail.trim().toLowerCase();
        const intelligence = await agronomistIntelligenceService.getWorkspaceIntelligence(email);
        const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { count: visitsCompleted } = await supabase
            .from('crm_field_findings')
            .select('id', { count: 'exact', head: true })
            .eq('agronomist_name', email)
            .gte('visited_at', since90);
        const { count: recommendationsGiven } = await supabase
            .from('recommendation_records')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', email)
            .gte('created_at', since90);
        let recoverySuccessRate = null;
        try {
            const kpis = await recommendationFollowUpService.getKpis(30);
            recoverySuccessRate = kpis.recoveryRatePct ?? null;
        }
        catch {
            /* optional */
        }
        return {
            assignedFarmers: intelligence.employee.attributedFarmers ?? intelligence.focusFarmers.length,
            visitsCompleted: visitsCompleted ?? 0,
            recommendationsGiven: recommendationsGiven ?? 0,
            recoverySuccessRate,
            performanceScore: intelligence.employee.performanceScore,
            openEscalations: intelligence.cohort.openEscalations,
        };
    },
    async startVisitSession(input) {
        const { data, error } = await supabase
            .from('agronomist_visit_sessions')
            .insert({
            farmer_id: input.farmerId,
            block_id: input.blockId ?? null,
            agronomist_email: input.agronomistEmail.trim().toLowerCase(),
            status: 'in_progress',
            check_in_lat: input.latitude ?? null,
            check_in_lng: input.longitude ?? null,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not start visit session');
        return data;
    },
    async checkOutVisitSession(sessionId, input) {
        const { data: existing, error: loadErr } = await supabase
            .from('agronomist_visit_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        throwIfSupabaseError(loadErr, 'Session not found');
        if (!existing)
            throw new NotFoundError('Session not found');
        const checkOutAt = new Date();
        const checkInAt = new Date(String(existing.check_in_at));
        const durationMinutes = Math.max(1, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
        const { data, error } = await supabase
            .from('agronomist_visit_sessions')
            .update({
            status: 'completed',
            check_out_at: checkOutAt.toISOString(),
            check_out_lat: input.latitude ?? null,
            check_out_lng: input.longitude ?? null,
            duration_minutes: durationMinutes,
            field_finding_id: input.fieldFindingId ?? null,
            updated_at: checkOutAt.toISOString(),
        })
            .eq('id', sessionId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not check out');
        return data;
    },
    async listFarmerRecommendations(farmerId, limit = 20) {
        const rows = await recommendationRecordsService.listByFarmer(farmerId, limit);
        return rows.map((r) => {
            const meta = r.metadata ?? {};
            return {
                id: String(r.id),
                farmerId: String(r.farmer_id),
                blockId: r.block_id ? String(r.block_id) : null,
                fieldFindingId: r.field_finding_id ? String(r.field_finding_id) : null,
                visitIssueId: r.visit_issue_id ? String(r.visit_issue_id) : null,
                issueDetected: r.issue_detected ? String(r.issue_detected) : null,
                recommendationText: String(r.recommendation_text ?? ''),
                dosage: r.dosage ? String(r.dosage) : null,
                status: String(r.status),
                fieldRecStatus: meta.fieldRecStatus ? String(meta.fieldRecStatus) : null,
                priority: meta.priority ? String(meta.priority) : null,
                reviewDate: meta.reviewDate ? String(meta.reviewDate) : null,
                outcome: r.outcome ? String(r.outcome) : null,
                createdAt: String(r.created_at),
            };
        });
    },
    async createFarmerRecommendation(farmerId, createdBy, input) {
        return recommendationRecordsService.create({
            farmerId,
            blockId: input.blockId,
            leadId: input.leadId,
            fieldFindingId: input.fieldFindingId,
            source: input.fieldFindingId ? 'field_finding' : 'agronomist',
            issueDetected: input.issueDetected,
            recommendationText: input.recommendationText,
            dosage: input.dosage,
            weatherWarning: input.weatherWarning,
            language: input.language,
            createdBy,
            status: 'draft',
        });
    },
    async getBlockDetail(farmerId, blockId) {
        const blocks = await fieldPwaService.getFarmerBlocks(farmerId);
        const block = blocks.find((b) => b.id === blockId);
        if (!block)
            throw new NotFoundError('Block not found');
        const [activitiesRes, soilRows, findingsRes, crmRecs, recordRows, farmerRes, blockRawRes] = await Promise.all([
            supabase
                .from('cultivation_activities')
                .select('id, activity_label, activity_type, applied_at, notes, cost_inr')
                .eq('farmer_id', farmerId)
                .eq('farm_block_id', blockId)
                .order('applied_at', { ascending: false })
                .limit(30),
            crmFarmerService.listSoilReports(farmerId, blockId).catch(() => []),
            supabase
                .from('crm_field_findings')
                .select('id, visited_at, disease_pest, observations, disease_tone, agronomist_name, action_taken')
                .eq('farmer_id', farmerId)
                .eq('block_id', blockId)
                .is('archived_at', null)
                .order('visited_at', { ascending: false })
                .limit(20),
            crmFarmerService.listRecommendationsForBlock(farmerId, blockId),
            supabase
                .from('recommendation_records')
                .select('id, issue_detected, recommendation_text, dosage, created_at, status, created_by')
                .eq('farmer_id', farmerId)
                .eq('block_id', blockId)
                .not('status', 'in', '(draft,cancelled,rejected)')
                .order('created_at', { ascending: false })
                .limit(20),
            supabase
                .from('farmers')
                .select('phone, village, district, name')
                .eq('id', farmerId)
                .maybeSingle(),
            supabase
                .from('farm_blocks')
                .select('variety_name, irrigation_type, planting_date, acreage_decimal, area, metadata')
                .eq('id', blockId)
                .maybeSingle(),
        ]);
        const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const activities = (activitiesRes.data ?? []).map((a) => ({
            id: String(a.id),
            blockId,
            blockName: block.name,
            activityType: String(a.activity_type ?? 'other'),
            activityLabel: String(a.activity_label ?? a.activity_type ?? 'Activity'),
            activityDate: String(a.applied_at).slice(0, 10),
            dateLabel: fmt(String(a.applied_at)),
            notes: a.notes ? String(a.notes) : null,
            costInr: a.cost_inr != null ? Number(a.cost_inr) : null,
            status: 'completed',
        }));
        const findingIds = (findingsRes.data ?? []).map((r) => String(r.id));
        const issueCounts = new Map();
        const recCounts = new Map();
        if (findingIds.length) {
            const [{ data: issueRows }, { data: recRows }] = await Promise.all([
                supabase.from('visit_issues').select('field_finding_id').in('field_finding_id', findingIds),
                supabase
                    .from('recommendation_records')
                    .select('field_finding_id')
                    .in('field_finding_id', findingIds),
            ]);
            for (const row of issueRows ?? []) {
                const fid = String(row.field_finding_id);
                issueCounts.set(fid, (issueCounts.get(fid) ?? 0) + 1);
            }
            for (const row of recRows ?? []) {
                const fid = String(row.field_finding_id);
                recCounts.set(fid, (recCounts.get(fid) ?? 0) + 1);
            }
        }
        const fieldFindings = (findingsRes.data ?? []).map((r) => {
            const id = String(r.id);
            const health = cropHealthFromTone(r.disease_tone);
            return {
                id,
                visitedAt: String(r.visited_at),
                visitedLabel: fmt(String(r.visited_at)),
                diseasePest: r.disease_pest ? String(r.disease_pest) : null,
                observations: r.observations ? String(r.observations) : null,
                diseaseTone: String(r.disease_tone ?? 'warning'),
                cropHealthLabel: health.cropHealthLabel,
                cropHealthStatus: health.cropHealthStatus,
                agronomistName: r.agronomist_name ? String(r.agronomist_name) : null,
                actionTaken: r.action_taken ? String(r.action_taken) : null,
                issueCount: issueCounts.get(id) ?? 0,
                recommendationCount: recCounts.get(id) ?? 0,
            };
        });
        const blockRecommendations = [
            ...crmRecs.map((r) => ({
                id: String(r.id),
                title: r.problem ? String(r.problem) : 'Recommendation',
                body: r.recommendation ? String(r.recommendation) : '',
                dosage: r.dosage ? String(r.dosage) : null,
                dateLabel: String(r.dateLabel ?? '—'),
                status: String(r.status ?? 'active'),
                recommendedBy: r.recommendedBy ? String(r.recommendedBy) : null,
                source: 'crm',
            })),
            ...(recordRows.data ?? []).map((r) => ({
                id: String(r.id),
                title: r.issue_detected ? String(r.issue_detected) : 'Agronomist recommendation',
                body: String(r.recommendation_text ?? ''),
                dosage: r.dosage ? String(r.dosage) : null,
                dateLabel: fmt(String(r.created_at)),
                status: String(r.status ?? 'approved'),
                recommendedBy: r.created_by ? String(r.created_by) : null,
                source: 'record',
            })),
        ];
        return {
            block,
            farmContext: {
                farmerPhone: farmerRes.data?.phone ? String(farmerRes.data.phone) : null,
                village: farmerRes.data?.village ? String(farmerRes.data.village) : null,
                district: farmerRes.data?.district ? String(farmerRes.data.district) : null,
                acreage: block.acreage ?? (blockRawRes.data?.acreage_decimal != null ? Number(blockRawRes.data.acreage_decimal) : null),
                area: block.area ?? (blockRawRes.data?.area ? String(blockRawRes.data.area) : null),
                irrigationType: blockRawRes.data?.irrigation_type ? String(blockRawRes.data.irrigation_type) : null,
                varietyName: blockRawRes.data?.variety_name ? String(blockRawRes.data.variety_name) : null,
                plantingDate: block.plantingDate ?? (blockRawRes.data?.planting_date ? String(blockRawRes.data.planting_date).slice(0, 10) : null),
                expectedHarvestDate: blockRawRes.data?.metadata && typeof blockRawRes.data.metadata === 'object'
                    ? String(blockRawRes.data.metadata.expected_harvest ?? '') || null
                    : null,
                recentVisits: fieldFindings.slice(0, 3).map((v) => ({
                    id: v.id,
                    dateLabel: v.visitedLabel,
                    summary: v.diseasePest ?? v.observations?.slice(0, 80) ?? 'Visit',
                    agronomistName: v.agronomistName,
                })),
                recentRecommendations: blockRecommendations.slice(0, 3).map((r) => ({
                    id: r.id,
                    title: r.title,
                    dateLabel: r.dateLabel,
                    status: r.status,
                })),
                recentApplications: activities.slice(0, 3).map((a) => ({
                    id: a.id,
                    label: a.activityLabel,
                    dateLabel: a.dateLabel,
                    activityType: a.activityType,
                })),
            },
            activities,
            soilReports: await Promise.all(soilRows.map(async (s) => {
                const metrics = normalizeSoilMetrics(s.metrics);
                const metricCells = soilMetricCells(metrics);
                const rawPdf = s.pdf_url ? String(s.pdf_url) : null;
                const pdfUrl = rawPdf
                    ? ((await resolveAdvisoryImageUrl(rawPdf)) ?? rawPdf)
                    : null;
                return {
                    id: String(s.id),
                    blockId,
                    blockName: block.name,
                    dateLabel: s.reported_at ? fmt(String(s.reported_at)) : '—',
                    dapLabel: null,
                    health: 'good',
                    healthLabel: metricCells.length ? 'Lab values on file' : 'Report on file',
                    pdfUrl,
                    highlights: metricCells.map((m) => `${m.label}: ${m.value}`),
                    metrics: metricCells,
                };
            })),
            fieldFindings,
            blockRecommendations,
        };
    },
    async getCallLogSummary(farmerId) {
        const { data, error } = await supabase
            .from('crm_call_logs')
            .select('id, outcome, created_at, agent_email, duration_seconds, ai_summary, processing_status, direction')
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(50);
        throwIfSupabaseError(error, 'Could not load call logs');
        const rows = data ?? [];
        const last = rows[0] ?? null;
        return {
            totalCalls: rows.length,
            lastCallAt: last?.created_at ? String(last.created_at) : null,
            lastCallOutcome: last?.outcome ? String(last.outcome) : null,
            lastCallAgent: last?.agent_email ? String(last.agent_email) : null,
            lastCallSummary: last?.ai_summary ? String(last.ai_summary) : null,
            connectedCount: rows.filter((r) => String(r.outcome) === 'connected').length,
            pendingAiSummary: rows.filter((r) => String(r.processing_status) === 'pending').length,
            recentCalls: rows.slice(0, 5).map((r) => ({
                id: String(r.id),
                outcome: r.outcome ? String(r.outcome) : null,
                at: String(r.created_at),
                agentEmail: r.agent_email ? String(r.agent_email) : null,
                durationSeconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
                aiSummary: r.ai_summary ? String(r.ai_summary) : null,
                direction: r.direction ? String(r.direction) : 'outbound',
            })),
        };
    },
    async listFarmerInteractions(farmerId, leadId, page = 1, limit = 40) {
        return crmFarmerService.listHumanCrmInteractions(farmerId, leadId ?? null, page, limit);
    },
    async getFarmerInteractionDetail(farmerId, interactionId, leadId) {
        return crmFarmerService.getHumanCrmInteractionDetail(farmerId, leadId ?? null, interactionId);
    },
    async getWorkspaceDashboard(farmerId) {
        const summary = await this.getWorkspaceSummary(farmerId);
        const today = todayIsoDate();
        const { data: findingRows } = await supabase
            .from('crm_field_findings')
            .select('id')
            .eq('farmer_id', farmerId)
            .is('archived_at', null);
        const findingIds = (findingRows ?? []).map((f) => String(f.id));
        let openIssues = 0;
        if (findingIds.length) {
            const { count } = await supabase
                .from('visit_issues')
                .select('id', { count: 'exact', head: true })
                .in('field_finding_id', findingIds)
                .in('status', ['open', 'monitoring']);
            openIssues = count ?? 0;
        }
        const [{ count: pendingRecs }, { count: pendingFindingRecs }, { data: lastCall }, { count: todaysVisits },] = await Promise.all([
            supabase
                .from('recommendation_records')
                .select('id', { count: 'exact', head: true })
                .eq('farmer_id', farmerId)
                .in('status', ['draft', 'pending_review', 'approved']),
            supabase
                .from('recommendation_records')
                .select('id', { count: 'exact', head: true })
                .eq('farmer_id', farmerId)
                .not('field_finding_id', 'is', null)
                .eq('status', 'draft'),
            supabase
                .from('crm_call_logs')
                .select('created_at')
                .eq('farmer_id', farmerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('farmer_id', farmerId)
                .eq('task_type', 'visit')
                .in('status', ['pending', 'open'])
                .gte('due_at', `${today}T00:00:00`)
                .lte('due_at', `${today}T23:59:59`),
        ]);
        return {
            ...summary,
            openIssuesCount: openIssues,
            pendingRecommendationsCount: pendingRecs ?? 0,
            pendingFindingReviewsCount: pendingFindingRecs ?? 0,
            pendingAiCasesCount: summary.openEscalationCount,
            todaysVisitsCount: todaysVisits ?? 0,
            lastCallAt: lastCall?.created_at ? String(lastCall.created_at) : null,
            farmerSummary: {
                name: summary.farmer.name,
                lastCallAt: lastCall?.created_at ? String(lastCall.created_at) : null,
                lastVisitAt: summary.lastVisitAt,
                openIssuesCount: openIssues,
                pendingRecommendationsCount: pendingRecs ?? 0,
            },
        };
    },
    async listFarmerOrders(farmerId) {
        return crmFarmerService.listFarmerOrders(farmerId);
    },
    async listWhatsAppHistory(farmerId, limit = 30) {
        const { data, error } = await supabase
            .from('interaction_logs')
            .select('id, summary, content, channel, interaction_at, created_at, done_by, workflow_status')
            .eq('farmer_id', farmerId)
            .eq('channel', 'whatsapp')
            .order('interaction_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not load WhatsApp history');
        return (data ?? []).map((r) => ({
            id: String(r.id),
            summary: String(r.summary ?? r.content ?? '').slice(0, 240),
            at: String(r.interaction_at ?? r.created_at),
            by: r.done_by ? String(r.done_by) : null,
            workflowStatus: r.workflow_status ? String(r.workflow_status) : null,
        }));
    },
    async logFarmerCall(farmerId, agentEmail, input) {
        const leadId = await resolveLeadId(farmerId);
        if (!leadId)
            throw new NotFoundError('No lead linked for this farmer');
        const { telecallerAdminService } = await import('../admin/telecaller-admin.service.js');
        return telecallerAdminService.logCall(leadId, input, agentEmail);
    },
    async createFarmerReminder(farmerId, agentEmail, input) {
        const leadId = await resolveLeadId(farmerId);
        const dueAt = input.dueAt ?? new Date(Date.now() + 3 * 86400000).toISOString();
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert({
            farmer_id: farmerId,
            lead_id: leadId,
            task_type: 'follow_up',
            title: input.reason.slice(0, 120),
            status: 'pending',
            due_at: dueAt,
            assigned_to: agentEmail,
            notes: `Reminder (${input.assignTo ?? 'agronomist'})`,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create reminder');
        return data;
    },
    async listFarmerVisits(farmerId, options = {}) {
        const limit = options.limit ?? 30;
        let findingsQuery = supabase
            .from('crm_field_findings')
            .select('id, block_id, block_name, crop_type, visited_at, dap_at_visit, disease_pest, observations, block_health')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('visited_at', { ascending: false })
            .limit(limit);
        if (options.blockId) {
            findingsQuery = findingsQuery.eq('block_id', options.blockId);
        }
        const { data: findings, error } = await findingsQuery;
        throwIfSupabaseError(error, 'Could not load visits');
        const findingIds = (findings ?? []).map((f) => String(f.id));
        let issueCounts = new Map();
        let recCounts = new Map();
        let topIssuesByFinding = new Map();
        let statusesByFinding = new Map();
        if (findingIds.length) {
            const [{ data: issues }, { data: recs }] = await Promise.all([
                supabase
                    .from('visit_issues')
                    .select('field_finding_id, issue_name, status, sort_order')
                    .in('field_finding_id', findingIds)
                    .order('sort_order', { ascending: true }),
                supabase
                    .from('recommendation_records')
                    .select('field_finding_id')
                    .in('field_finding_id', findingIds),
            ]);
            for (const i of issues ?? []) {
                const fid = String(i.field_finding_id);
                issueCounts.set(fid, (issueCounts.get(fid) ?? 0) + 1);
                const names = topIssuesByFinding.get(fid) ?? [];
                if (i.issue_name && names.length < 3) {
                    names.push(String(i.issue_name));
                    topIssuesByFinding.set(fid, names);
                }
                const statuses = statusesByFinding.get(fid) ?? new Set();
                statuses.add(String(i.status ?? 'open').toLowerCase());
                statusesByFinding.set(fid, statuses);
            }
            for (const r of recs ?? []) {
                const fid = String(r.field_finding_id);
                recCounts.set(fid, (recCounts.get(fid) ?? 0) + 1);
            }
        }
        const rows = (findings ?? []).map((f) => {
            const id = String(f.id);
            return {
                id,
                blockId: f.block_id ? String(f.block_id) : null,
                blockName: f.block_name ? String(f.block_name) : 'Block',
                cropType: f.crop_type ? String(f.crop_type) : null,
                visitedAt: String(f.visited_at),
                dapAtVisit: f.dap_at_visit != null ? Number(f.dap_at_visit) : null,
                issueCount: issueCounts.get(id) ?? 0,
                recommendationCount: recCounts.get(id) ?? 0,
                summary: String(f.disease_pest ?? f.observations ?? '').slice(0, 120),
                blockHealth: f.block_health ? String(f.block_health) : null,
                topIssueNames: topIssuesByFinding.get(id) ?? [],
                _statuses: statusesByFinding.get(id) ?? new Set(),
            };
        });
        if (!options.status) {
            return rows.map(({ _statuses: _, ...row }) => row);
        }
        return rows
            .filter((row) => row._statuses.has(options.status))
            .map(({ _statuses: _, ...row }) => row);
    },
    async listNotifications(agentEmail) {
        void agentEmail;
        const notifications = [];
        const [findingsRes, escalationsRes, supportRes] = await Promise.all([
            supabase
                .from('crm_field_findings')
                .select('id, farmer_id, crop_type, visited_at, review_status')
                .in('review_status', ['pending_review', 'submitted'])
                .order('visited_at', { ascending: false })
                .limit(20),
            supabase
                .from('agronomist_escalations')
                .select('id, title, created_at, farmer_id, status')
                .in('status', ['pending', 'assigned', 'in_review'])
                .order('created_at', { ascending: false })
                .limit(15),
            supabase
                .from('farmer_timeline_entries')
                .select('id, farmer_id, body, created_at, entry_type')
                .eq('entry_type', 'support_request')
                .order('created_at', { ascending: false })
                .limit(10),
        ]);
        throwIfSupabaseError(findingsRes.error, 'Could not load finding notifications');
        throwIfSupabaseError(escalationsRes.error, 'Could not load escalation notifications');
        for (const f of findingsRes.data ?? []) {
            notifications.push({
                id: `finding-${f.id}`,
                category: 'approval_pending',
                title: 'Field finding pending review',
                detail: f.crop_type ? String(f.crop_type) : null,
                at: String(f.visited_at ?? new Date().toISOString()),
                farmerId: String(f.farmer_id),
            });
        }
        for (const e of escalationsRes.data ?? []) {
            notifications.push({
                id: `escalation-${e.id}`,
                category: 'escalation',
                title: String(e.title ?? 'Escalation'),
                detail: String(e.status ?? 'open'),
                at: String(e.created_at ?? new Date().toISOString()),
                farmerId: e.farmer_id ? String(e.farmer_id) : undefined,
            });
        }
        for (const s of supportRes.data ?? []) {
            notifications.push({
                id: `support-${s.id}`,
                category: 'support_request',
                title: 'Partner support request',
                detail: String(s.body ?? '').slice(0, 120),
                at: String(s.created_at ?? new Date().toISOString()),
                farmerId: s.farmer_id ? String(s.farmer_id) : undefined,
            });
        }
        notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        return notifications.slice(0, 50);
    },
    async getRecommendationVisitContext(recommendationId) {
        const row = await recommendationRecordsService.getById(recommendationId);
        if (!row)
            throw new NotFoundError('Recommendation not found');
        const farmerId = String(row.farmer_id);
        const farmer = row.farmers;
        const blockJoin = row.farm_blocks;
        let blockId = row.block_id ? String(row.block_id) : null;
        let blockName = blockJoin?.name ? String(blockJoin.name) : null;
        let cropType = blockJoin?.crop_type ? String(blockJoin.crop_type) : null;
        if (!blockId) {
            const primary = await blockService.getPrimaryBlock(farmerId);
            if (primary) {
                blockId = String(primary.id);
                blockName = primary.name ? String(primary.name) : blockName;
                cropType = primary.crop_type ? String(primary.crop_type) : cropType;
            }
        }
        const aiSessionId = row.ai_session_id ? String(row.ai_session_id) : null;
        let escalationId = null;
        let symptomsText = null;
        let aiDiagnosis = row.issue_detected ? String(row.issue_detected) : null;
        let aiConfidence = null;
        const images = [];
        if (aiSessionId) {
            const { data: esc } = await supabase
                .from('agronomist_escalations')
                .select('id')
                .eq('session_id', aiSessionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            escalationId = esc?.id ? String(esc.id) : null;
            const sessionPack = await loadAiSessionVisitImages(farmerId, aiSessionId);
            symptomsText = sessionPack.symptomsText;
            images.push(...sessionPack.images);
            cropType = cropType ?? sessionPack.cropType;
            aiDiagnosis = aiDiagnosis ?? sessionPack.aiDiagnosis;
            aiConfidence = sessionPack.aiConfidence;
        }
        const farmerFeedback = await loadFarmerFeedbackForVisit({
            farmerId,
            aiSessionId,
            escalationId,
        });
        return {
            recommendationId,
            farmerId,
            farmerName: farmer?.name ? String(farmer.name) : null,
            blockId,
            blockName,
            cropType,
            aiSessionId,
            escalationId,
            issueDetected: row.issue_detected ? String(row.issue_detected) : null,
            aiDiagnosis,
            aiConfidence,
            farmerFeedbackId: farmerFeedback.farmerFeedbackId,
            farmerSuggestedDiagnosis: farmerFeedback.farmerSuggestedDiagnosis,
            farmerSuggestedDiagnoses: farmerFeedback.farmerSuggestedDiagnoses,
            farmerRefinedConditions: farmerFeedback.farmerRefinedConditions,
            farmerRefineSequenceSummary: farmerFeedback.farmerRefineSequenceSummary,
            farmerPriorExperience: farmerFeedback.farmerPriorExperience,
            farmerPriorProduct: farmerFeedback.farmerPriorProduct,
            farmerPriorOutcome: farmerFeedback.farmerPriorOutcome,
            recommendationText: String(row.recommendation_text ?? ''),
            symptomsText,
            images,
            source: row.source ? String(row.source) : null,
            status: row.status ? String(row.status) : null,
            rectificationMode: Boolean(escalationId || row.status === 'draft' || farmerFeedback.farmerSuggestedDiagnosis),
        };
    },
    async getEscalationVisitContext(escalationId) {
        const { data: esc, error } = await supabase
            .from('agronomist_escalations')
            .select('id, farmer_id, session_id, reason, confidence_at_escalation, status, farmers(name, first_name, last_name)')
            .eq('id', escalationId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load escalation');
        if (!esc)
            throw new NotFoundError('Escalation not found');
        const farmerId = String(esc.farmer_id);
        const f = normalizeJoinRow(esc.farmers);
        const aiSessionId = esc.session_id ? String(esc.session_id) : null;
        const primary = await blockService.getPrimaryBlock(farmerId);
        let blockId = primary ? String(primary.id) : null;
        let blockName = primary?.name ? String(primary.name) : null;
        let cropType = primary?.crop_type ? String(primary.crop_type) : null;
        let symptomsText = esc.reason ? String(esc.reason) : null;
        let aiDiagnosis = null;
        let aiConfidence = esc.confidence_at_escalation != null ? Number(esc.confidence_at_escalation) : null;
        const images = [];
        if (aiSessionId) {
            const sessionPack = await loadAiSessionVisitImages(farmerId, aiSessionId);
            symptomsText = sessionPack.symptomsText ?? symptomsText;
            images.push(...sessionPack.images);
            cropType = cropType ?? sessionPack.cropType;
            aiDiagnosis = sessionPack.aiDiagnosis;
            if (aiConfidence == null)
                aiConfidence = sessionPack.aiConfidence;
        }
        let recommendationId = null;
        let recommendationText = '';
        let issueDetected = aiDiagnosis;
        if (aiSessionId) {
            const { data: rec } = await supabase
                .from('recommendation_records')
                .select('id, issue_detected, recommendation_text, block_id, farm_blocks(name, crop_type)')
                .eq('ai_session_id', aiSessionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (rec) {
                recommendationId = String(rec.id);
                recommendationText = String(rec.recommendation_text ?? '');
                issueDetected = rec.issue_detected ? String(rec.issue_detected) : issueDetected;
                if (!blockId && rec.block_id) {
                    blockId = String(rec.block_id);
                    const bj = rec.farm_blocks;
                    blockName = bj?.name ? String(bj.name) : blockName;
                    cropType = cropType ?? (bj?.crop_type ? String(bj.crop_type) : null);
                }
            }
        }
        const farmerFeedback = await loadFarmerFeedbackForVisit({
            farmerId,
            aiSessionId,
            escalationId: String(esc.id),
        });
        return {
            recommendationId,
            farmerId,
            farmerName: farmerDisplayName(f),
            blockId,
            blockName,
            cropType,
            aiSessionId,
            escalationId: String(esc.id),
            issueDetected,
            aiDiagnosis,
            aiConfidence,
            farmerFeedbackId: farmerFeedback.farmerFeedbackId,
            farmerSuggestedDiagnosis: farmerFeedback.farmerSuggestedDiagnosis,
            farmerSuggestedDiagnoses: farmerFeedback.farmerSuggestedDiagnoses,
            farmerRefinedConditions: farmerFeedback.farmerRefinedConditions,
            farmerRefineSequenceSummary: farmerFeedback.farmerRefineSequenceSummary,
            farmerPriorExperience: farmerFeedback.farmerPriorExperience,
            farmerPriorProduct: farmerFeedback.farmerPriorProduct,
            farmerPriorOutcome: farmerFeedback.farmerPriorOutcome,
            recommendationText,
            symptomsText,
            images,
            source: 'escalation',
            status: String(esc.status),
            rectificationMode: true,
        };
    },
};
//# sourceMappingURL=agronomist-mobile.service.js.map