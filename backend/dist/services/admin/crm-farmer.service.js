import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { crmInternalNotesService } from './crm-internal-notes.service.js';
import { recommendationFollowUpService } from '../core/recommendation-follow-up.service.js';
import { emptySoilLabMetrics, normalizeSoilMetrics } from '../soil/soil-lab-metrics.js';
import { resolveNextActionDueAt } from './interaction-next-action.js';
function formatDateShort(iso) {
    if (!iso)
        return null;
    try {
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
        });
    }
    catch {
        return iso;
    }
}
function formatDateTime(iso) {
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
function daysAfterPlanting(date) {
    if (!date)
        return null;
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    return diff >= 0 ? diff : null;
}
export const crmFarmerService = {
    async listMasters(type, parentId, search) {
        let q = supabase
            .from('crm_masters')
            .select('id, master_type, name, parent_id, category, description, active, sort_order')
            .eq('master_type', type)
            .eq('active', true)
            .order('sort_order')
            .order('name');
        if (parentId)
            q = q.eq('parent_id', parentId);
        else
            q = q.is('parent_id', null);
        if (search?.trim())
            q = q.ilike('name', `%${search.trim()}%`);
        const { data, error } = await q.limit(200);
        throwIfSupabaseError(error, 'Could not load masters');
        let rows = data ?? [];
        if (type === 'crop' && !parentId && !search?.trim()) {
            const requiredCrops = ['Ginger', 'Banana', 'Pepper', 'Cardamom'];
            const existing = new Set(rows.map((r) => String(r.name).trim().toLowerCase()));
            const missing = requiredCrops.filter((name) => !existing.has(name.toLowerCase()));
            if (missing.length > 0) {
                for (const name of missing) {
                    const { error: insertErr } = await supabase.from('crm_masters').insert({
                        master_type: 'crop',
                        name,
                        sort_order: 0,
                        parent_id: null,
                        active: true,
                    });
                    if (insertErr && !String(insertErr.message ?? '').toLowerCase().includes('duplicate')) {
                        throwIfSupabaseError(insertErr, 'Could not seed crop defaults');
                    }
                }
                const { data: refreshed, error: refreshErr } = await q.limit(200);
                throwIfSupabaseError(refreshErr, 'Could not reload masters');
                rows = refreshed ?? rows;
            }
        }
        if (type === 'market' && !parentId && !search?.trim()) {
            rows = await this.seedMarketMastersFromPrices(rows);
        }
        return rows;
    },
    async createMaster(input) {
        const { data, error } = await supabase
            .from('crm_masters')
            .insert({
            master_type: input.masterType,
            name: input.name.trim(),
            parent_id: input.parentId ?? null,
            category: input.category,
            description: input.description,
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not create master');
        return data;
    },
    async seedMarketMastersFromPrices(rows) {
        const existing = new Set(rows.map((r) => `${String(r.name).trim().toLowerCase()}|${r.category ? String(r.category).trim().toLowerCase() : ''}`));
        const { data: priceRows, error: priceErr } = await supabase
            .from('crop_daily_prices')
            .select('market_name, district')
            .eq('active', true)
            .order('market_name', { ascending: true })
            .limit(500);
        throwIfSupabaseError(priceErr, 'Could not load market seeds');
        let inserted = 0;
        for (const row of priceRows ?? []) {
            const marketName = String(row.market_name ?? '').trim();
            if (!marketName)
                continue;
            const district = row.district ? String(row.district).trim() : '';
            const key = `${marketName.toLowerCase()}|${district.toLowerCase()}`;
            if (existing.has(key))
                continue;
            const { error: insertErr } = await supabase.from('crm_masters').insert({
                master_type: 'market',
                name: marketName,
                category: district || null,
                sort_order: 0,
                parent_id: null,
                active: true,
            });
            if (insertErr && !String(insertErr.message ?? '').toLowerCase().includes('duplicate')) {
                throwIfSupabaseError(insertErr, 'Could not seed market defaults');
            }
            else {
                inserted += 1;
                existing.add(key);
            }
        }
        if (inserted > 0) {
            const { data: refreshed, error: refreshErr } = await supabase
                .from('crm_masters')
                .select('id, master_type, name, parent_id, category, description, active, sort_order')
                .eq('master_type', 'market')
                .eq('active', true)
                .is('parent_id', null)
                .order('sort_order')
                .order('name')
                .limit(200);
            throwIfSupabaseError(refreshErr, 'Could not reload market masters');
            return refreshed ?? rows;
        }
        return rows;
    },
    async updateMaster(id, patch) {
        const updates = { updated_at: new Date().toISOString() };
        if (patch.name != null)
            updates.name = patch.name.trim();
        if (patch.active != null)
            updates.active = patch.active;
        if (patch.description != null)
            updates.description = patch.description;
        if (patch.category !== undefined)
            updates.category = patch.category?.trim() || null;
        const { data, error } = await supabase.from('crm_masters').update(updates).eq('id', id).select().single();
        throwIfSupabaseError(error, 'Could not update master');
        return data;
    },
    async listBlocks(farmerId) {
        const { data, error } = await supabase
            .from('farm_blocks')
            .select('*')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('name');
        throwIfSupabaseError(error, 'Could not load blocks');
        return (data ?? []).map(mapBlock);
    },
    async getBlock(blockId) {
        const { data, error } = await supabase.from('farm_blocks').select('*').eq('id', blockId).single();
        if (error || !data)
            throw new NotFoundError('Block not found');
        return mapBlock(data);
    },
    async createBlock(farmerId, input) {
        const cropName = input.cropName?.trim();
        const cropType = cropName ? cropName.toLowerCase().replace(/\s+/g, '_') : null;
        const { data, error } = await supabase
            .from('farm_blocks')
            .insert({
            farmer_id: farmerId,
            name: input.name,
            plot_label: input.name,
            area: input.area,
            crop_id: input.cropId,
            crop_name: cropName,
            crop_type: cropType,
            variety_id: input.varietyId,
            variety_name: input.varietyName,
            irrigation_type_id: input.irrigationTypeId,
            soil_type_id: input.soilTypeId,
            planting_date: input.plantingDate,
            spacing: input.spacing,
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not create block');
        return mapBlock(data);
    },
    async updateBlock(blockId, patch) {
        const allowed = [
            'name',
            'plot_label',
            'area',
            'crop_id',
            'crop_name',
            'crop_type',
            'variety_id',
            'variety_name',
            'irrigation_type_id',
            'soil_type_id',
            'growth_stage_id',
            'block_status_id',
            'planting_date',
            'spacing',
            'soil_health',
            'growth_percent',
            'last_visit_at',
            'latitude',
            'longitude',
            'location_captured_at',
            'location_source',
        ];
        const updates = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
            if (patch[k] !== undefined)
                updates[k] = patch[k];
        }
        if (patch.archived === true)
            updates.archived_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('farm_blocks')
            .update(updates)
            .eq('id', blockId)
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not update block');
        return mapBlock(data);
    },
    async getBlockWorkspace(farmerId, blockId) {
        const block = await this.getBlock(blockId);
        if (block.farmerId !== farmerId)
            throw new NotFoundError('Block not found');
        const [soilRes, findingsRes, recsRes, soilList, visits, blockRecs, followUps] = await Promise.all([
            supabase
                .from('crm_soil_reports')
                .select('*')
                .eq('block_id', blockId)
                .order('reported_at', { ascending: false })
                .limit(1),
            supabase
                .from('crm_field_findings')
                .select('*')
                .eq('block_id', blockId)
                .is('archived_at', null)
                .order('visited_at', { ascending: false })
                .limit(1),
            supabase
                .from('crm_recommendations')
                .select('*')
                .eq('block_id', blockId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(3),
            this.listSoilReports(farmerId, blockId),
            this.listFieldFindingsForBlock(farmerId, blockId, 15),
            this.listRecommendationsForBlock(farmerId, blockId),
            this.listBlockFollowUps(farmerId, blockId),
        ]);
        const latestSoil = soilRes.data?.[0];
        const latestVisit = findingsRes.data?.[0];
        const recommendations = recsRes.data ?? [];
        return {
            block,
            soilReports: soilList.map((s) => ({
                id: s.id,
                reportedLabel: formatDateTime(s.reported_at),
                metrics: normalizeSoilMetrics(s.metrics),
                pdfUrl: s.pdf_url,
            })),
            visits,
            blockRecommendations: blockRecs,
            followUps,
            blockInfo: {
                blockName: block.name,
                area: block.area,
                crop: block.cropName,
                variety: block.varietyName,
                plantingDate: block.plantingDate,
                daysAfterPlanting: daysAfterPlanting(String(block.plantingDate ?? '')),
                irrigationType: block.irrigationTypeName,
                spacing: block.spacing,
                growthStage: block.growthStageName,
                growthPercent: block.growthPercent,
                nextStage: 'Flowering',
                latitude: block.latitude,
                longitude: block.longitude,
                locationCapturedAt: block.locationCapturedAt,
                locationSource: block.locationSource,
                hasPlotGps: block.latitude != null && block.longitude != null,
            },
            soilReport: latestSoil
                ? {
                    metrics: normalizeSoilMetrics(latestSoil.metrics),
                    pdfUrl: latestSoil.pdf_url,
                    reportedLabel: formatDateTime(latestSoil.reported_at),
                }
                : { metrics: emptySoilLabMetrics(), pdfUrl: null, reportedLabel: null },
            latestVisit: latestVisit ? mapFinding(latestVisit) : null,
            recommendations: recommendations.map(mapRecommendation),
            nextFollowUp: followUps[0]
                ? {
                    title: String(followUps[0].title ?? 'Follow-up'),
                    dueLabel: String(followUps[0].dueLabel ?? '—'),
                    notes: followUps[0].notes ? String(followUps[0].notes) : undefined,
                }
                : null,
            timeline: await this.blockTimeline(farmerId, blockId),
        };
    },
    async blockTimeline(farmerId, blockId) {
        const items = [];
        const { data: sessions } = await supabase
            .from('interaction_logs')
            .select('interaction_at, created_at, interaction_type, summary, outcome, field_activity_label')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .eq('is_operational_session', true)
            .or('status.is.null,status.neq.archived')
            .order('interaction_at', { ascending: false, nullsFirst: false })
            .limit(8);
        for (const s of sessions ?? []) {
            const at = String(s.interaction_at ?? s.created_at);
            const type = String(s.interaction_type ?? 'Interaction');
            const detail = [s.summary, s.field_activity_label ? `Activity: ${s.field_activity_label}` : null, s.outcome]
                .filter(Boolean)
                .join(' · ');
            items.push({
                title: type,
                at,
                atLabel: formatDateShort(at) ?? formatDateTime(at) ?? '',
                kind: 'interaction',
                detail: detail.slice(0, 160) || undefined,
            });
        }
        const { data: activities } = await supabase
            .from('cultivation_activities')
            .select('applied_at, activity_label, activity_type, added_from')
            .eq('farm_block_id', blockId)
            .order('applied_at', { ascending: false })
            .limit(6);
        for (const a of activities ?? []) {
            const label = String(a.activity_label ?? a.activity_type ?? 'Field activity');
            const from = String(a.added_from ?? '') === 'interaction' ? ' (from interaction)' : '';
            items.push({
                title: label,
                at: `${a.applied_at}T12:00:00.000Z`,
                atLabel: formatDateShort(String(a.applied_at)) ?? '',
                kind: 'field_activity',
                detail: from ? `Logged${from}` : undefined,
            });
        }
        const recEvents = await recommendationFollowUpService.buildBlockTimelineEvents(blockId, farmerId);
        for (const e of recEvents) {
            items.push({
                title: e.title,
                at: e.at,
                atLabel: formatDateTime(e.at) ?? '',
                kind: e.kind,
                detail: e.detail,
            });
        }
        const { data: findings } = await supabase
            .from('crm_field_findings')
            .select('visited_at, observations')
            .eq('block_id', blockId)
            .order('visited_at', { ascending: false })
            .limit(5);
        for (const f of findings ?? []) {
            items.push({
                title: 'Field visit completed',
                at: String(f.visited_at),
                atLabel: formatDateTime(f.visited_at) ?? '',
            });
        }
        const { data: recs } = await supabase
            .from('crm_recommendations')
            .select('created_at, recommendation')
            .eq('block_id', blockId)
            .order('created_at', { ascending: false })
            .limit(3);
        for (const r of recs ?? []) {
            items.push({
                title: 'Recommendation given',
                at: String(r.created_at),
                atLabel: formatDateTime(r.created_at) ?? '',
            });
        }
        items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        return items.slice(0, 8);
    },
    async listSoilReports(farmerId, blockId) {
        let q = supabase
            .from('crm_soil_reports')
            .select('*')
            .eq('farmer_id', farmerId)
            .order('reported_at', { ascending: false });
        if (blockId)
            q = q.eq('block_id', blockId);
        const { data, error } = await q.limit(20);
        throwIfSupabaseError(error, 'Could not load soil reports');
        return data ?? [];
    },
    async createSoilReport(farmerId, input) {
        const { data, error } = await supabase
            .from('crm_soil_reports')
            .insert({
            farmer_id: farmerId,
            block_id: input.blockId,
            metrics: (input.metrics
                ? normalizeSoilMetrics(input.metrics)
                : emptySoilLabMetrics()),
            pdf_url: input.pdfUrl,
            uploaded_by: input.uploadedBy,
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not save soil report');
        const reportId = data?.id ? String(data.id) : '';
        if (reportId) {
            const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
            void farmerEventCaptureService.trackSoilTestUploaded({
                farmerId,
                soilReportId: reportId,
                blockId: input.blockId ?? null,
                employeeEmail: input.uploadedBy ?? null,
            });
        }
        return data;
    },
    async listRecommendations(farmerId, page = 1, limit = 10) {
        const from = (page - 1) * limit;
        const { data, error, count } = await supabase
            .from('crm_recommendations')
            .select('*, farm_blocks(name, crop_name)', { count: 'exact' })
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        throwIfSupabaseError(error, 'Could not load recommendations');
        return {
            recommendations: (data ?? []).map((r) => mapRecommendation(r)),
            pagination: { page, limit, total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / limit)) },
        };
    },
    async createRecommendation(farmerId, leadId, input) {
        const { data, error } = await supabase
            .from('crm_recommendations')
            .insert({
            farmer_id: farmerId,
            lead_id: leadId,
            block_id: input.blockId,
            rec_type: input.recType ?? 'agronomist',
            problem: input.problem,
            recommendation: input.recommendation,
            products: input.products ?? [],
            dosage: input.dosage,
            application_method: input.applicationMethod,
            follow_up_at: input.followUpAt,
            recommended_by: input.recommendedBy,
            status: 'active',
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not create recommendation');
        return mapRecommendation(data);
    },
    async listInteractions(farmerId, page = 1, limit = 10) {
        const from = (page - 1) * limit;
        const { data, error, count } = await supabase
            .from('interaction_logs')
            .select('*', { count: 'exact' })
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        throwIfSupabaseError(error, 'Could not load interactions');
        return {
            interactions: (data ?? []).map(mapInteraction),
            pagination: { page, limit, total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / limit)) },
        };
    },
    /** Telecaller CRM tab — operational workflow sessions only (no merged micro-events). */
    async listHumanCrmInteractions(farmerId, leadId, page = 1, limit = 40) {
        const isDueToday = (iso) => {
            if (!iso)
                return false;
            const due = new Date(iso);
            const now = new Date();
            return (due.getFullYear() === now.getFullYear() &&
                due.getMonth() === now.getMonth() &&
                due.getDate() === now.getDate());
        };
        const from = (page - 1) * limit;
        let query = supabase
            .from('interaction_logs')
            .select('*, farm_blocks(name, crop_name)', { count: 'exact' })
            .eq('farmer_id', farmerId)
            .eq('is_operational_session', true)
            .or('status.is.null,status.neq.archived')
            .order('interaction_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        if (leadId) {
            query = query.or(`lead_id.eq.${leadId},lead_id.is.null`);
        }
        const { data, error, count } = await query.range(from, from + limit - 1);
        throwIfSupabaseError(error, 'Could not load interactions');
        const items = (data ?? []).map((r) => mapOperationalSessionRow(r, isDueToday));
        return {
            interactions: items,
            pagination: {
                page,
                limit,
                total: count ?? 0,
                pages: Math.max(1, Math.ceil((count ?? 0) / limit)),
            },
        };
    },
    /** Full detail for one timeline row (id encodes source — see listHumanCrmInteractions). */
    async getHumanCrmInteractionDetail(farmerId, _leadId, interactionId) {
        const empty = {
            id: interactionId,
            source: 'unknown',
            interactionType: 'Interaction',
            summary: '',
            status: '—',
            by: '—',
            role: '—',
            createdLabel: '—',
            at: new Date().toISOString(),
            fields: [],
            sections: [],
            followUpTimeline: [],
            products: [],
        };
        function parseProducts(raw) {
            if (!Array.isArray(raw))
                return [];
            return raw.map((p) => {
                if (typeof p === 'string')
                    return { name: p };
                if (p && typeof p === 'object') {
                    const o = p;
                    const name = String(o.tradeName ?? o.productTitle ?? o.title ?? o.technicalName ?? o.brand ?? 'Product');
                    const detail = [
                        o.technicalName ? `Technical: ${o.technicalName}` : '',
                        o.dosageSchedule ? `Dosage: ${JSON.stringify(o.dosageSchedule)}` : '',
                        o.reason ? String(o.reason) : '',
                    ]
                        .filter(Boolean)
                        .join(' · ');
                    return { name, detail: detail || undefined };
                }
                return { name: 'Product' };
            });
        }
        function field(label, value) {
            if (value == null || value === '')
                return null;
            return { label, value: String(value) };
        }
        if (interactionId.startsWith('rec-wa-')) {
            const recId = interactionId.slice('rec-wa-'.length);
            const { data: rec, error } = await supabase
                .from('recommendation_records')
                .select('*, farm_blocks(name, crop_name)')
                .eq('id', recId)
                .eq('farmer_id', farmerId)
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not load recommendation');
            if (!rec)
                return empty;
            const { data: followRows } = await supabase
                .from('recommendation_follow_ups')
                .select('id, phase, status, farmer_response, scheduled_at, sent_at, responded_at, created_at')
                .eq('recommendation_record_id', recId)
                .order('created_at', { ascending: false });
            const block = rec.farm_blocks;
            const products = parseProducts(rec.products);
            const followUps = (followRows ?? [])
                .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
                .map((f) => ({
                label: followUpPhaseLabel(String(f.phase ?? ''), f.farmer_response ? String(f.farmer_response) : null),
                status: String(f.status ?? '—'),
                atLabel: formatDateTime((f.responded_at ?? f.sent_at ?? f.scheduled_at ?? f.created_at)) ?? '—',
                detail: f.farmer_response ? `Farmer: ${String(f.farmer_response).replace(/_/g, ' ')}` : undefined,
            }));
            const at = String(rec.communicated_at ?? rec.created_at);
            return {
                id: interactionId,
                source: 'rec_record',
                interactionType: 'Recommendation given via WhatsApp',
                summary: String(rec.issue_detected ?? rec.trade_name ?? 'Crop advisory'),
                status: String(rec.application_status ?? rec.status ?? 'communicated'),
                by: 'Crop Doctor',
                role: 'System',
                createdLabel: formatDateTime(at) ?? '—',
                at,
                fields: [
                    field('Issue detected', rec.issue_detected),
                    field('Technical', rec.technical_name),
                    field('Product', rec.trade_name),
                    field('Application', rec.application_type),
                    field('Dosage', rec.dosage),
                    field('DAP at recommendation', rec.dap_at_recommendation),
                    field('Block', block?.name ?? block?.crop_name),
                    field('Language', rec.language),
                    field('Source', rec.source),
                    field('Outcome', rec.outcome),
                    field('Weather note', rec.weather_warning),
                ].filter(Boolean),
                sections: rec.recommendation_text
                    ? [{ title: 'Recommendation text', content: String(rec.recommendation_text) }]
                    : [],
                followUpTimeline: followUps,
                products,
            };
        }
        if (interactionId.startsWith('follow-')) {
            const followId = interactionId.slice('follow-'.length);
            const { data: f, error } = await supabase
                .from('recommendation_follow_ups')
                .select('*, recommendation_records(*)')
                .eq('id', followId)
                .eq('farmer_id', farmerId)
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not load follow-up');
            if (!f)
                return empty;
            const rec = f.recommendation_records;
            const at = String(f.responded_at ?? f.sent_at ?? f.scheduled_at ?? f.created_at);
            const response = f.farmer_response ? String(f.farmer_response) : null;
            return {
                id: interactionId,
                source: 'follow_up',
                interactionType: followUpPhaseLabel(String(f.phase), response),
                summary: String(rec?.issue_detected ?? rec?.trade_name ?? 'Follow-up'),
                status: String(f.status ?? '—'),
                by: response ? 'Farmer' : 'System',
                role: response ? 'Farmer' : 'WhatsApp',
                createdLabel: formatDateTime(at) ?? '—',
                at,
                fields: [
                    field('Phase', f.phase),
                    field('Farmer response', response?.replace(/_/g, ' ')),
                    field('Scheduled', formatDateTime(f.scheduled_at)),
                    field('Sent', formatDateTime(f.sent_at)),
                    field('Issue', rec?.issue_detected),
                    field('Product', rec?.trade_name ?? rec?.technical_name),
                ].filter(Boolean),
                sections: [],
                followUpTimeline: [],
                products: parseProducts(rec?.products),
            };
        }
        if (interactionId.startsWith('call-')) {
            const callId = interactionId.slice('call-'.length);
            const { data: c, error } = await supabase
                .from('crm_call_logs')
                .select('*')
                .eq('id', callId)
                .eq('farmer_id', farmerId)
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not load call');
            if (!c)
                return empty;
            const at = String(c.created_at);
            return {
                id: interactionId,
                source: 'call',
                interactionType: 'Telecaller conversation done',
                summary: `Phone call — ${c.outcome ?? 'completed'}`,
                status: String(c.outcome ?? 'completed'),
                by: String(c.agent_email ?? 'Telecaller'),
                role: 'Telecaller',
                createdLabel: formatDateTime(at) ?? '—',
                at,
                fields: [
                    field('Outcome', c.outcome),
                    field('Duration (sec)', c.duration_seconds),
                    field('Direction', c.direction),
                ].filter(Boolean),
                sections: c.notes ? [{ title: 'Call notes', content: String(c.notes) }] : [],
                followUpTimeline: [],
                products: [],
            };
        }
        if (interactionId.startsWith('task-')) {
            const rest = interactionId.slice('task-'.length);
            let taskId = rest;
            if (rest.endsWith('-done') || rest.endsWith('-created')) {
                const parts = rest.split('-');
                taskId = parts.slice(0, -1).join('-');
            }
            const { data: t, error } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('id', taskId)
                .eq('farmer_id', farmerId)
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not load task');
            if (!t)
                return empty;
            const isDone = String(t.status ?? '') === 'done';
            const at = isDone && t.updated_at ? String(t.updated_at) : String(t.created_at);
            const dueIso = t.due_at ? String(t.due_at) : '';
            return {
                id: interactionId,
                source: 'task',
                interactionType: isDone ? 'Follow-up completed' : 'Follow-up scheduled',
                summary: String(t.notes ? `${t.title} — ${t.notes}` : t.title ?? 'Follow-up task'),
                status: isDone ? 'Completed' : 'Pending',
                completionStatus: isDone ? 'completed' : 'pending',
                canEdit: !isDone && String(t.status ?? '') !== 'cancelled',
                taskId: String(t.id),
                by: String(t.assigned_to ?? 'Telecaller'),
                role: 'Telecaller',
                createdLabel: formatDateTime(at) ?? '—',
                at,
                fields: [
                    field('Task type', t.task_type),
                    field('Due', formatDateTime(t.due_at)),
                    field('Priority', t.priority),
                ].filter(Boolean),
                sections: t.notes ? [{ title: 'Task notes', content: String(t.notes) }] : [],
                followUpTimeline: [],
                products: [],
                editForm: {
                    kind: 'task',
                    title: String(t.title ?? ''),
                    notes: t.notes ? String(t.notes) : '',
                    dueAt: dueIso,
                },
            };
        }
        if (interactionId.startsWith('crm-rec-')) {
            const recId = interactionId.slice('crm-rec-'.length);
            const { data: r, error } = await supabase
                .from('crm_recommendations')
                .select('*, farm_blocks(name, crop_name)')
                .eq('id', recId)
                .eq('farmer_id', farmerId)
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not load recommendation');
            if (!r)
                return empty;
            const block = r.farm_blocks;
            const at = String(r.created_at);
            return {
                id: interactionId,
                source: 'recommendation',
                interactionType: 'Recommendation given',
                summary: String(r.recommendation ?? r.problem ?? '—').slice(0, 200),
                status: String(r.status ?? 'active'),
                by: String(r.recommended_by ?? 'Agronomist'),
                role: 'Agronomist',
                createdLabel: formatDateTime(at) ?? '—',
                at,
                fields: [
                    field('Problem', r.problem),
                    field('Dosage', r.dosage),
                    field('Application', r.application_method),
                    field('Follow-up', formatDateTime(r.follow_up_at)),
                    field('Block', block?.name ?? block?.crop_name),
                ].filter(Boolean),
                sections: [
                    { title: 'Recommendation', content: String(r.recommendation ?? '—') },
                ],
                followUpTimeline: [],
                products: parseProducts(r.products),
            };
        }
        if (interactionId.startsWith('visit-')) {
            const visitId = interactionId.slice('visit-'.length);
            const { data: v, error } = await supabase
                .from('crm_field_findings')
                .select('*')
                .eq('id', visitId)
                .eq('farmer_id', farmerId)
                .maybeSingle();
            throwIfSupabaseError(error, 'Could not load field visit');
            if (!v)
                return empty;
            const at = String(v.visited_at ?? v.created_at);
            return {
                id: interactionId,
                source: 'visit',
                interactionType: 'Agronomist field visit arranged',
                summary: String(v.observations ?? v.disease_pest ?? 'Field visit'),
                status: 'Completed',
                by: String(v.agronomist_name ?? 'Agronomist'),
                role: 'Agronomist',
                createdLabel: formatDateTime(at) ?? '—',
                at,
                fields: [
                    field('Crop', v.crop_type),
                    field('Disease / pest', v.disease_pest),
                    field('Action taken', v.action_taken),
                    field('Follow-up', formatDateTime(v.follow_up_at)),
                ].filter(Boolean),
                sections: v.observations
                    ? [{ title: 'Observations', content: String(v.observations) }]
                    : [],
                followUpTimeline: [],
                products: [],
            };
        }
        const { data: log, error } = await supabase
            .from('interaction_logs')
            .select('*, farm_blocks(name, crop_name)')
            .eq('id', interactionId)
            .eq('farmer_id', farmerId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load interaction log');
        if (!log) {
            throw new NotFoundError('Interaction not found');
        }
        const mapped = mapInteraction(log);
        const at = String(log.interaction_at ?? log.created_at);
        const archived = String(log.status ?? '') === 'archived';
        const workflowStatus = String(log.workflow_status ?? 'Closed');
        const isActive = workflowStatus === 'Active';
        return {
            id: interactionId,
            source: 'log',
            interactionType: mapped.typeLabel,
            summary: String(log.summary || log.content || ''),
            status: workflowStatus,
            completionStatus: isActive && log.next_action ? 'pending' : 'completed',
            canEdit: !archived,
            taskId: null,
            by: String(mapped.by),
            role: String(mapped.role),
            createdLabel: formatDateShort(at) ?? mapped.atLabel ?? formatDateTime(at) ?? '—',
            at,
            fields: [
                field('Interaction date', formatDateShort(at)),
                field('Field finding', log.field_finding_text),
                field('Field activity', log.field_activity_label),
                field('Activity date', formatDateShort(log.field_activity_date)),
                field('Recommendation', log.recommendation_summary),
                field('Outcome', log.outcome),
                field('Next action', log.next_action),
                field('Next action at', formatDateTime(log.next_action_at)),
                field('Workflow status', workflowStatus),
                field('Escalation', log.escalation_id ? 'Agronomist case review opened' : null),
                field('Block', log.farm_blocks?.name),
            ].filter(Boolean),
            sections: [
                ...(log.summary ? [{ title: 'Summary', content: String(log.summary) }] : []),
                ...(log.recommendation_summary
                    ? [{ title: 'Recommendation', content: String(log.recommendation_summary) }]
                    : []),
                ...(log.content && log.content !== log.summary
                    ? [{ title: 'Notes', content: String(log.content) }]
                    : []),
            ],
            followUpTimeline: [],
            products: [],
            editForm: {
                kind: 'log',
                summary: String(log.summary ?? ''),
                content: String(log.content ?? log.summary ?? ''),
            },
        };
    },
    async createInteraction(farmerId, leadId, input) {
        const summary = (input.summary ?? input.notes ?? '').trim();
        if (!summary) {
            throw new ValidationError('Summary is required');
        }
        const workflowStatus = input.escalate
            ? 'Escalated'
            : input.workflowStatus ?? (input.nextAction?.trim() ? 'Active' : 'Closed');
        const interactionAt = input.interactionAt ?? new Date().toISOString();
        const resolvedDueAt = resolveNextActionDueAt({
            nextAction: input.nextAction,
            nextActionAt: input.nextActionAt,
            interactionAt,
        });
        const fieldFindingText = input.fieldFindingText?.trim() || null;
        const fieldActivityLabel = input.fieldActivityLabel?.trim() || null;
        const fieldActivityDate = input.fieldActivityDate ?? null;
        const recommendationSummary = input.recommendationSummary?.trim() || null;
        let blockName = 'Block';
        let cropType = 'Crop';
        if (input.blockId) {
            const { data: blockRow } = await supabase
                .from('farm_blocks')
                .select('name, crop_name, crop_type')
                .eq('id', input.blockId)
                .maybeSingle();
            if (blockRow) {
                blockName = String(blockRow.name ?? blockName);
                cropType = String(blockRow.crop_name ?? blockRow.crop_type ?? cropType);
            }
        }
        const { data, error } = await supabase
            .from('interaction_logs')
            .insert({
            farmer_id: farmerId,
            lead_id: leadId,
            block_id: input.blockId,
            channel: input.channel ?? 'crm',
            direction: 'outbound',
            interaction_type: input.interactionType,
            done_by: input.doneBy,
            done_by_role: input.doneByRole,
            summary,
            content: input.notes?.trim() || summary,
            interaction_at: interactionAt,
            outcome: input.outcome ?? null,
            next_action: input.nextAction?.trim() || null,
            next_action_at: resolvedDueAt ?? input.nextActionAt ?? null,
            workflow_status: workflowStatus,
            field_finding_text: fieldFindingText,
            field_activity_label: fieldActivityLabel,
            field_activity_date: fieldActivityDate,
            field_activity_type_id: input.fieldActivityTypeId ?? null,
            recommendation_summary: recommendationSummary,
            escalated: input.escalate ?? false,
            is_operational_session: true,
            status: input.status ?? 'completed',
        })
            .select('*, farm_blocks(name, crop_name)')
            .single();
        throwIfSupabaseError(error, 'Could not create interaction');
        let fieldFindingId = null;
        let fieldActivityId = null;
        let recommendationId = null;
        const sessionPatch = {};
        if (input.addFieldFinding && fieldFindingText && input.blockId && leadId) {
            const { telecallerAdminService } = await import('./telecaller-admin.service.js');
            const finding = await telecallerAdminService.createFieldFinding(farmerId, leadId, {
                blockId: input.blockId,
                blockName,
                cropType,
                observations: fieldFindingText,
                diseasePest: fieldFindingText.slice(0, 120),
                agentEmail: input.doneBy,
            });
            fieldFindingId = String(finding.id);
            sessionPatch.field_finding_id = fieldFindingId;
        }
        if (input.addFieldActivity && input.blockId && fieldActivityDate) {
            const { whatsappOsAdminService } = await import('./whatsapp-os-admin.service.js');
            const activity = await whatsappOsAdminService.createFieldActivity({
                blockId: input.blockId,
                activityType: 'other',
                activityTypeId: input.fieldActivityTypeId,
                activityLabel: fieldActivityLabel ?? undefined,
                activityDate: fieldActivityDate,
                notes: summary,
                source: 'telecaller',
            });
            fieldActivityId = String(activity.id);
            await supabase
                .from('cultivation_activities')
                .update({
                interaction_log_id: data.id,
                added_from: 'interaction',
                updated_at: new Date().toISOString(),
            })
                .eq('id', fieldActivityId);
            sessionPatch.field_activity_id = fieldActivityId;
            if (!fieldActivityLabel && activity.activity_label) {
                sessionPatch.field_activity_label = activity.activity_label;
            }
        }
        if (input.recommendationCompleted && recommendationSummary && leadId) {
            const rec = await this.createRecommendation(farmerId, leadId, {
                blockId: input.blockId,
                recommendation: recommendationSummary,
                recommendedBy: input.doneBy ?? 'Telecaller',
                recType: 'agronomist',
            });
            recommendationId = String(rec.id);
            sessionPatch.recommendation_id = recommendationId;
        }
        if (Object.keys(sessionPatch).length > 0) {
            await supabase.from('interaction_logs').update(sessionPatch).eq('id', data.id);
            Object.assign(data, sessionPatch);
        }
        if (input.escalate) {
            const { telecallerEscalationService } = await import('./telecaller-escalation.service.js');
            const esc = await telecallerEscalationService.escalateFromInteraction({
                farmerId,
                leadId,
                interactionLogId: String(data.id),
                summary,
                interactionType: input.interactionType,
                blockId: input.blockId,
                cropType,
                agentEmail: input.doneBy ?? 'Telecaller',
            });
            await supabase
                .from('interaction_logs')
                .update({ escalation_id: esc.escalationId })
                .eq('id', data.id);
            Object.assign(data, { escalation_id: esc.escalationId });
        }
        if (leadId && input.nextAction?.trim() && workflowStatus === 'Active') {
            const { telecallerAdminService } = await import('./telecaller-admin.service.js');
            await telecallerAdminService.createTask(leadId, {
                title: input.nextAction.trim(),
                dueAt: resolvedDueAt ?? undefined,
                notes: summary,
                taskType: 'follow_up',
                blockId: input.blockId,
                interactionLogId: String(data.id),
            }, input.doneBy ?? 'Telecaller');
        }
        const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
        void farmerEventCaptureService.trackInteractionSession({
            farmerId,
            interactionLogId: String(data.id),
            interactionType: input.interactionType,
            workflowStatus,
            escalated: Boolean(input.escalate),
            outcome: input.outcome ?? null,
            nextAction: input.nextAction ?? null,
            blockId: input.blockId,
            employeeEmail: input.doneBy,
            occurredAt: interactionAt,
        });
        return mapOperationalSessionRow(data, () => false);
    },
    async getAgronomist(farmerId) {
        const { data } = await supabase
            .from('farmer_agronomist_assignments')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('status', 'active')
            .maybeSingle();
        const base = data ? mapAgronomist(data, farmerId) : defaultAgronomist(farmerId);
        const blocks = await this.listBlocks(farmerId).catch(() => []);
        const { data: findings } = await supabase
            .from('crm_field_findings')
            .select('visited_at, observations, block_name')
            .eq('farmer_id', farmerId)
            .order('visited_at', { ascending: false })
            .limit(6);
        base.blocks = blocks.map((b) => ({
            block: String(b.name),
            crop: String(b.cropName),
            area: String(b.area),
            status: b.soilHealth === 'good' ? 'Healthy' : 'Under Monitoring',
            statusTone: String(b.soilTone),
        }));
        base.activities = (findings ?? []).map((f) => ({
            date: formatDateTime(f.visited_at)?.split(',')[0] ?? '—',
            activity: 'Field Visit',
            activityTone: 'success',
            block: f.block_name ?? '—',
            notes: String(f.observations ?? '').slice(0, 80),
        }));
        base.assignedBlocks = blocks.map((b) => b.name).join(', ') || '—';
        return base;
    },
    async upsertAgronomist(farmerId, input) {
        const existing = await supabase
            .from('farmer_agronomist_assignments')
            .select('id')
            .eq('farmer_id', farmerId)
            .eq('status', 'active')
            .maybeSingle();
        const payload = {
            farmer_id: farmerId,
            agronomist_name: input.agronomistName ?? 'Arjun Nair',
            employee_id: input.employeeId ?? 'AGRO-1001',
            mobile: input.mobile,
            email: input.email,
            specialization: input.specialization ?? 'Soil Nutrition',
            next_visit_at: input.nextVisitAt,
            status: 'active',
            updated_at: new Date().toISOString(),
        };
        if (existing.data?.id) {
            const { data, error } = await supabase
                .from('farmer_agronomist_assignments')
                .update(payload)
                .eq('id', existing.data.id)
                .select()
                .single();
            throwIfSupabaseError(error, 'Could not update agronomist');
            return mapAgronomist(data, farmerId);
        }
        const { data, error } = await supabase
            .from('farmer_agronomist_assignments')
            .insert({ ...payload, assigned_since: new Date().toISOString().slice(0, 10) })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not assign agronomist');
        return mapAgronomist(data, farmerId);
    },
    async ensureDemoCrmData(farmerId, leadId, agentEmail) {
        const blocks = await this.ensureDemoBlocks(farmerId);
        const blockId = blocks[0]?.id;
        const { count: recCount } = await supabase
            .from('crm_recommendations')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', farmerId);
        if (!recCount && typeof blockId === 'string') {
            await this.createRecommendation(farmerId, leadId, {
                blockId: blockId,
                problem: 'Nutrient deficiency on lower leaves',
                recommendation: 'Potassium Nitrate foliar spray — 5g/L',
                applicationMethod: 'Foliar Spray',
                recommendedBy: agentEmail ?? 'Agronomist',
                recType: 'agronomist',
            });
        }
        const ix = await this.listInteractions(farmerId, 1, 1);
        if (!ix.pagination.total) {
            await this.createInteraction(farmerId, leadId, {
                interactionType: 'Call',
                summary: 'Initial outreach — farmer interested in nutrition schedule.',
                doneBy: agentEmail ?? 'Telecaller',
                doneByRole: 'Telecaller',
                status: 'completed',
            });
        }
        if (typeof blockId === 'string') {
            const { count: soilCount } = await supabase
                .from('crm_soil_reports')
                .select('id', { count: 'exact', head: true })
                .eq('block_id', blockId);
            if (!soilCount) {
                await this.createSoilReport(farmerId, { blockId: blockId, uploadedBy: agentEmail });
            }
        }
        return blocks;
    },
    async getFarmerCrmBundle(farmerId, leadId, agentEmail) {
        await this.ensureDemoCrmData(farmerId, leadId, agentEmail);
        const [blocks, agronomist, interactions, recommendations, orders, internalNotes] = await Promise.all([
            this.listBlocks(farmerId),
            this.getAgronomist(farmerId),
            this.listInteractions(farmerId, 1, 10),
            this.listRecommendations(farmerId, 1, 10),
            this.listFarmerOrders(farmerId),
            crmInternalNotesService.list(farmerId),
        ]);
        return { blocks, agronomist, interactions, recommendations, orders, internalNotes };
    },
    async listFarmerOrders(farmerId) {
        const { telecallerFarmerOrdersService } = await import('./telecaller-farmer-orders.service.js');
        return telecallerFarmerOrdersService.listForFarmer(farmerId);
    },
    async getFarmerOrderDetail(farmerId, orderId) {
        const { telecallerFarmerOrdersService } = await import('./telecaller-farmer-orders.service.js');
        return telecallerFarmerOrdersService.getDetail(farmerId, orderId);
    },
    async ensureDemoBlocks(farmerId) {
        const existing = await this.listBlocks(farmerId);
        if (existing.length)
            return existing;
        const crops = await this.listMasters('crop');
        const banana = crops.find((c) => c.name === 'Banana') ?? crops[0];
        const pepper = crops.find((c) => c.name === 'Pepper') ?? crops[1];
        await this.createBlock(farmerId, {
            name: 'Block A',
            area: '2.1 Acre',
            cropId: banana?.id,
            cropName: banana?.name ?? 'Banana',
            varietyName: 'Nendran',
            plantingDate: '2024-01-12',
        });
        if (pepper) {
            await this.createBlock(farmerId, {
                name: 'Block B',
                area: '1.5 Acre',
                cropId: pepper.id,
                cropName: pepper.name,
                varietyName: 'Panniyur-1',
                plantingDate: '2024-02-01',
            });
        }
        return this.listBlocks(farmerId);
    },
    async listInteractionsFiltered(farmerId, filters, page = 1, limit = 10) {
        const from = (page - 1) * limit;
        let q = supabase
            .from('interaction_logs')
            .select('*', { count: 'exact' })
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false });
        if (filters.type)
            q = q.ilike('interaction_type', `%${filters.type}%`);
        if (filters.status)
            q = q.eq('status', filters.status);
        if (filters.blockId)
            q = q.eq('block_id', filters.blockId);
        q = q.or('status.is.null,status.neq.archived');
        const { data, error, count } = await q.range(from, from + limit - 1);
        throwIfSupabaseError(error, 'Could not load interactions');
        return {
            interactions: (data ?? []).map(mapInteraction),
            pagination: { page, limit, total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / limit)) },
        };
    },
    async updateInteraction(id, patch) {
        const allowed = [
            'interaction_type',
            'summary',
            'content',
            'next_action',
            'next_action_at',
            'status',
            'block_id',
            'outcome',
            'workflow_status',
            'field_finding_text',
            'field_activity_label',
            'field_activity_date',
            'recommendation_summary',
            'interaction_at',
        ];
        const updates = {};
        for (const k of allowed) {
            if (patch[k] !== undefined)
                updates[k] = patch[k];
        }
        const { data, error } = await supabase.from('interaction_logs').update(updates).eq('id', id).select().single();
        throwIfSupabaseError(error, 'Could not update interaction');
        return mapInteraction(data);
    },
    async archiveInteraction(id) {
        return this.updateInteraction(id, { status: 'archived' });
    },
    async updateRecommendation(id, patch) {
        const allowed = ['problem', 'recommendation', 'dosage', 'application_method', 'follow_up_at', 'status', 'products'];
        const updates = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
            if (patch[k] !== undefined)
                updates[k] = patch[k];
        }
        const { data, error } = await supabase.from('crm_recommendations').update(updates).eq('id', id).select('*, farm_blocks(name, crop_name)').single();
        throwIfSupabaseError(error, 'Could not update recommendation');
        return mapRecommendation(data);
    },
    async archiveRecommendation(id) {
        return this.updateRecommendation(id, { status: 'archived' });
    },
    async listFieldFindingsForBlock(farmerId, blockId, limit = 20) {
        const { data, error } = await supabase
            .from('crm_field_findings')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .is('archived_at', null)
            .order('visited_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not load visits');
        return (data ?? []).map((r) => mapFinding(r));
    },
    async archiveFieldFinding(id) {
        const { error } = await supabase
            .from('crm_field_findings')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', id);
        throwIfSupabaseError(error, 'Could not archive field finding');
        return { ok: true };
    },
    async listRecommendationsForBlock(farmerId, blockId) {
        const { data, error } = await supabase
            .from('crm_recommendations')
            .select('*, farm_blocks(name, crop_name)')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(20);
        throwIfSupabaseError(error, 'Could not load recommendations');
        return (data ?? []).map(mapRecommendation);
    },
    async listBlockFollowUps(farmerId, blockId) {
        let q = supabase
            .from('crm_tasks')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('status', 'pending')
            .order('due_at', { ascending: true })
            .limit(20);
        if (blockId)
            q = q.eq('block_id', blockId);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load follow-ups');
        return (data ?? []).map((t) => ({
            id: t.id,
            title: t.title,
            dueLabel: formatDateTime(t.due_at),
            taskType: t.task_type,
            notes: t.notes,
        }));
    },
    async scheduleVisit(farmerId, leadId, input) {
        const due = new Date(input.dueAt);
        if (Number.isNaN(due.getTime()))
            throw new ValidationError('Invalid visit date');
        const title = input.title?.trim() || 'Field visit';
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert({
            farmer_id: farmerId,
            lead_id: leadId,
            block_id: input.blockId ?? null,
            assigned_to: input.assignedTo,
            task_type: 'visit',
            title,
            notes: input.notes,
            due_at: due.toISOString(),
            status: 'pending',
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not schedule visit');
        const taskId = data?.id ? String(data.id) : '';
        if (taskId && input.assignedTo) {
            const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
            void farmerEventCaptureService.trackSiteVisitScheduled({
                farmerId,
                taskId,
                employeeEmail: input.assignedTo,
                dueAt: due.toISOString(),
                blockId: input.blockId ?? null,
            });
        }
        const ics = buildIcsEvent({
            uid: String(data.id),
            title,
            start: due,
            description: input.notes ?? 'Scheduled from Morbeez CRM',
        });
        return { task: data, icsContent: ics, icsFilename: 'morbeez-visit.ics' };
    },
    async createManualOrder(farmerId, leadId, input) {
        if (!input.lineItems?.length)
            throw new ValidationError('Add at least one product');
        const total = input.lineItems.reduce((s, li) => s + li.price * li.quantity, 0);
        const orderRef = `CRM-${Date.now().toString(36).toUpperCase()}`;
        const { data, error } = await supabase
            .from('crm_manual_orders')
            .insert({
            farmer_id: farmerId,
            lead_id: leadId,
            block_id: input.blockId,
            recommendation_id: input.recommendationId,
            order_ref: orderRef,
            line_items: input.lineItems,
            payment_mode: input.paymentMode,
            delivery_address: input.deliveryAddress,
            total_amount: total,
            notes: input.notes,
            created_by: input.createdBy,
            status: 'pending',
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not create order');
        const { telecallerFarmerOrdersService } = await import('./telecaller-farmer-orders.service.js');
        return telecallerFarmerOrdersService.getDetail(farmerId, String(data.id));
    },
    async convertRecommendationToOrder(recommendationId, farmerId, leadId, createdBy) {
        const { data: rec, error } = await supabase
            .from('crm_recommendations')
            .select('*')
            .eq('id', recommendationId)
            .eq('farmer_id', farmerId)
            .single();
        if (error || !rec)
            throw new NotFoundError('Recommendation not found');
        const products = rec.products ?? [];
        const lineItems = products.length > 0
            ? products.map((p) => ({
                title: p.title ?? 'Product',
                quantity: p.quantity ?? 1,
                price: p.price ?? 0,
            }))
            : [{ title: String(rec.recommendation).slice(0, 120), quantity: 1, price: 0 }];
        const order = await this.createManualOrder(farmerId, leadId, {
            blockId: rec.block_id,
            recommendationId,
            lineItems,
            notes: `Converted from recommendation: ${rec.problem ?? ''}`,
            createdBy,
        });
        await this.updateRecommendation(recommendationId, { status: 'converted' });
        return order;
    },
    async listManualOrders(farmerId) {
        const { data, error } = await supabase
            .from('crm_manual_orders')
            .select('*')
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(30);
        throwIfSupabaseError(error, 'Could not load CRM orders');
        return (data ?? []).map(mapManualOrder);
    },
    async getOrderCatalog(search) {
        const catalog = await shopifyProductsService.getInventoryCatalog(search);
        return catalog.slice(0, 80).flatMap((p) => (p.variants ?? []).map((v) => ({
            productId: p.id,
            variantId: v.id,
            title: `${p.title} — ${v.title}`,
            sku: v.sku,
            price: Number(v.price) || 0,
            stock: v.inventory,
        })));
    },
    buildExportHtml(_type, payload) {
        const title = String(payload.title ?? 'Morbeez CRM Export');
        const rows = payload.rows ?? [];
        const tableRows = payload.table?.rows
            ?.map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #ddd;padding:6px">${escapeHtmlExport(c)}</td>`).join('')}</tr>`)
            .join('') ?? '';
        const tableHead = payload.table?.cols
            ?.map((c) => `<th style="border:1px solid #ddd;padding:6px;text-align:left">${escapeHtmlExport(c)}</th>`)
            .join('') ?? '';
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlExport(title)}</title>
<style>body{font-family:Inter,sans-serif;padding:24px;color:#1a1a1a}h1{font-size:20px}dl{display:grid;grid-template-columns:160px 1fr;gap:8px}dt{font-weight:600;color:#555}table{border-collapse:collapse;width:100%;margin-top:16px}@media print{.no-print{display:none}}</style></head>
<body><h1>${escapeHtmlExport(title)}</h1><p class="no-print"><button onclick="window.print()">Print / Save as PDF</button></p>
<dl>${rows.map((r) => `<dt>${escapeHtmlExport(r.label)}</dt><dd>${escapeHtmlExport(r.value)}</dd>`).join('')}</dl>
${tableHead ? `<table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>` : ''}
<p style="margin-top:24px;color:#888;font-size:12px">Generated ${new Date().toLocaleString('en-IN')}</p></body></html>`;
    },
    buildWhatsAppMessage(type, payload, phone) {
        let text = '';
        if (type === 'recommendation') {
            text = `🌾 *Morbeez Recommendation*\n\n*Problem:* ${payload.problem ?? '—'}\n*Advice:* ${payload.recommendation ?? '—'}\n*Dosage:* ${payload.dosage ?? '—'}\n\nContact your agronomist for details.`;
        }
        else if (type === 'lead') {
            text = `🌾 *Farmer profile — ${payload.name ?? 'Farmer'}*\nPhone: ${payload.phone ?? '—'}\nCrop: ${payload.crop ?? '—'}\nTerritory: ${payload.territory ?? '—'}`;
        }
        else {
            text = String(payload.text ?? 'Shared from Morbeez CRM');
        }
        const digits = String(phone ?? '').replace(/\D/g, '').slice(-10);
        const url = digits ? `https://wa.me/91${digits}?text=${encodeURIComponent(text)}` : null;
        return { text, url };
    },
};
function escapeHtmlExport(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function buildIcsEvent(input) {
    const fmt = (d) => d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    const end = new Date(input.start.getTime() + 60 * 60 * 1000);
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Morbeez CRM//EN',
        'BEGIN:VEVENT',
        `UID:${input.uid}@morbeez.com`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(input.start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${input.title.replace(/\n/g, ' ')}`,
        `DESCRIPTION:${(input.description ?? '').replace(/\n/g, '\\n')}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}
function mapManualOrder(r) {
    const items = r.line_items ?? [];
    return {
        id: r.order_ref ?? r.id,
        orderRef: r.order_ref,
        dateLabel: formatDateTime(r.created_at),
        product: items.map((i) => i.title).join(', ') || 'Order',
        qty: items.reduce((s, i) => s + (i.quantity || 1), 0),
        amount: Number(r.total_amount) || 0,
        status: r.status === 'fulfilled' ? 'Delivered' : r.status === 'confirmed' ? 'Confirmed' : 'Pending',
        statusTone: r.status === 'fulfilled' ? 'success' : 'info',
        payment: String(r.payment_mode ?? 'CRM'),
        deliveryDate: '—',
        deliveryBy: 'CRM',
        block: '—',
        source: 'crm_manual',
    };
}
function mapBlock(r) {
    const soilHealth = String(r.soil_health ?? 'good');
    return {
        id: r.id,
        farmerId: r.farmer_id,
        name: r.name,
        area: r.area ?? '—',
        cropName: r.crop_name ?? '—',
        varietyName: r.variety_name ?? '—',
        cropId: r.crop_id,
        varietyId: r.variety_id,
        irrigationTypeId: r.irrigation_type_id,
        soilTypeId: r.soil_type_id,
        growthStageId: r.growth_stage_id,
        growthStageName: 'Vegetative',
        irrigationTypeName: 'Drip',
        plantingDate: r.planting_date ?? null,
        spacing: r.spacing,
        soilHealth,
        soilTone: soilHealth === 'good' ? 'success' : soilHealth === 'medium' ? 'warning' : 'danger',
        lastVisit: formatDateTime(r.last_visit_at) ?? '—',
        growthPercent: r.growth_percent ?? 65,
        status: 'Active',
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        locationCapturedAt: r.location_captured_at ? String(r.location_captured_at) : null,
        locationSource: r.location_source ? String(r.location_source) : null,
    };
}
function mapFinding(r) {
    const params = (r.parameters ?? []).map((p) => ({
        label: String(p.label ?? ''),
        value: String(p.value ?? ''),
    }));
    const param = (needle) => params.find((p) => p.label.toLowerCase().includes(needle.toLowerCase()))?.value;
    const photos = Array.isArray(r.photo_urls) ? r.photo_urls.filter(Boolean) : [];
    return {
        id: r.id ? String(r.id) : undefined,
        agronomistName: r.agronomist_name,
        diseasePest: r.disease_pest,
        observations: r.observations,
        parameters: params,
        visitedLabel: formatDateTime(r.visited_at),
        spad: param('spad'),
        shootCount: param('shoot'),
        leafCount: param('leaf'),
        moisture: param('moisture'),
        pestPressure: param('pest'),
        photoUrls: photos,
    };
}
function mapRecommendation(r) {
    const block = r.farm_blocks;
    return {
        id: r.id,
        recId: `REC-${String(r.id).slice(0, 8).toUpperCase()}`,
        dateLabel: formatDateTime(r.created_at),
        blockName: block?.name ?? '—',
        cropType: block?.crop_name ?? '—',
        problem: r.problem,
        recommendation: r.recommendation,
        products: r.products,
        dosage: r.dosage,
        applicationMethod: r.application_method,
        recommendedBy: r.recommended_by ?? 'Agronomist',
        status: r.status,
        statusTone: r.status === 'active' ? 'info' : r.status === 'completed' ? 'success' : 'warning',
        followUpLabel: formatDateTime(r.follow_up_at),
        recType: r.rec_type,
    };
}
function interactionTypeMeta(source, interactionType) {
    const t = interactionType.toLowerCase();
    if (source === 'call')
        return { typeKey: 'call', typeIcon: '📞', typeCategory: 'Call' };
    if (source === 'task')
        return { typeKey: 'follow_up', typeIcon: '🔔', typeCategory: 'Follow-up' };
    if (source === 'visit')
        return { typeKey: 'field_visit', typeIcon: '🌾', typeCategory: 'Field visit' };
    if (source === 'recommendation') {
        return { typeKey: 'recommendation', typeIcon: '📋', typeCategory: 'Recommendation' };
    }
    if (source === 'rec_record') {
        return { typeKey: 'whatsapp', typeIcon: '💬', typeCategory: 'WhatsApp' };
    }
    if (source === 'follow_up') {
        return { typeKey: 'whatsapp', typeIcon: '💬', typeCategory: 'WhatsApp' };
    }
    if (t.includes('whatsapp'))
        return { typeKey: 'whatsapp', typeIcon: '💬', typeCategory: 'WhatsApp' };
    if (t.includes('roi'))
        return { typeKey: 'roi', typeIcon: '📊', typeCategory: 'ROI' };
    if (t.includes('follow'))
        return { typeKey: 'follow_up', typeIcon: '📞', typeCategory: 'Follow-up' };
    if (t.includes('soil'))
        return { typeKey: 'soil_report', typeIcon: '🧪', typeCategory: 'Soil report' };
    if (t.includes('lead'))
        return { typeKey: 'lead_created', typeIcon: '✨', typeCategory: 'Lead created' };
    if (t.includes('ai') || t.includes('diagnosis')) {
        return { typeKey: 'ai_diagnosis', typeIcon: '🤖', typeCategory: 'AI diagnosis' };
    }
    if (t.includes('reminder'))
        return { typeKey: 'reminder', typeIcon: '⏰', typeCategory: 'Reminder' };
    if (t.includes('visit'))
        return { typeKey: 'field_visit', typeIcon: '🌾', typeCategory: 'Field visit' };
    return { typeKey: 'note', typeIcon: '📝', typeCategory: 'Note' };
}
function interactionStatusMeta(status, completionStatus, source) {
    if (completionStatus === 'pending') {
        return { displayStatus: 'Pending', statusTone: 'warning' };
    }
    const s = status.toLowerCase();
    if (s.includes('review'))
        return { displayStatus: 'Under Review', statusTone: 'review' };
    if (s === 'sent')
        return { displayStatus: 'Sent', statusTone: 'info' };
    if (s === 'active')
        return { displayStatus: 'Active', statusTone: 'purple' };
    if (s === 'delivered')
        return { displayStatus: 'Delivered', statusTone: 'success' };
    if (s === 'completed' || s === 'done' || s === 'resolved') {
        return { displayStatus: 'Completed', statusTone: 'success' };
    }
    if (source === 'rec_record' || source === 'follow_up') {
        return { displayStatus: status.charAt(0).toUpperCase() + status.slice(1), statusTone: 'info' };
    }
    return { displayStatus: 'Completed', statusTone: 'success' };
}
function buildNextActionLabel(nextAction, nextActionAt, dueLabel, completionStatus) {
    if (nextAction && nextAction !== '—') {
        const atLabel = nextActionAt ? formatDateTime(nextActionAt) : null;
        return atLabel ? `${nextAction} — ${atLabel}` : nextAction;
    }
    if (dueLabel && completionStatus === 'pending') {
        return `Follow-up — ${dueLabel}`;
    }
    return null;
}
function sessionTypeIcon(type) {
    const t = type.toLowerCase();
    if (t.includes('whatsapp'))
        return '💬';
    if (t.includes('follow'))
        return '📞';
    if (t.includes('agronomist') || t.includes('visit'))
        return '👨‍🌾';
    if (t.includes('roi'))
        return '📊';
    if (t.includes('recommendation') || t.includes('issue'))
        return '📋';
    return '📝';
}
function workflowStatusMeta(status) {
    const s = String(status ?? 'Closed');
    if (s === 'Active')
        return { displayStatus: 'Active', statusTone: 'purple' };
    if (s === 'Escalated')
        return { displayStatus: 'Escalated', statusTone: 'review' };
    return { displayStatus: 'Closed', statusTone: 'success' };
}
function mapOperationalSessionRow(r, isDueToday) {
    const interactionType = String(r.interaction_type ?? 'Interaction');
    const at = String(r.interaction_at ?? r.created_at);
    const workflowStatus = String(r.workflow_status ?? 'Closed');
    const wfMeta = workflowStatusMeta(workflowStatus);
    const isActive = workflowStatus === 'Active';
    const nextAction = r.next_action ? String(r.next_action) : null;
    const nextActionAt = r.next_action_at ? String(r.next_action_at) : null;
    const completionStatus = isActive && nextAction ? 'pending' : 'completed';
    const logBlock = r.farm_blocks;
    const typeMeta = interactionTypeMeta('log', interactionType);
    return enrichTimelineRow({
        id: String(r.id),
        at,
        interactionType,
        summary: String(r.summary ?? r.content ?? '').slice(0, 240),
        status: wfMeta.displayStatus,
        completionStatus,
        by: String(r.done_by ?? 'Staff'),
        role: String(r.done_by_role ?? 'Telecaller'),
        createdLabel: formatDateShort(at) ?? formatDateTime(at) ?? '',
        dueLabel: nextActionAt ? formatDateTime(nextActionAt) : null,
        isDueToday: completionStatus === 'pending' && isDueToday(nextActionAt),
        taskId: null,
        source: 'log',
        canArchive: true,
        canEdit: true,
        nextAction,
        nextActionAt,
        blockName: logBlock?.name ?? logBlock?.crop_name ?? null,
        blockId: r.block_id ? String(r.block_id) : null,
        fieldFinding: r.field_finding_text ? String(r.field_finding_text) : null,
        fieldActivity: r.field_activity_label ? String(r.field_activity_label) : null,
        activityDateLabel: formatDateShort(r.field_activity_date),
        recommendation: r.recommendation_summary ? String(r.recommendation_summary) : null,
        outcome: r.outcome ? String(r.outcome) : null,
        workflowStatus,
        typeIcon: sessionTypeIcon(interactionType),
        typeKey: typeMeta.typeKey,
        typeCategory: interactionType,
    });
}
function enrichTimelineRow(row) {
    const typeMeta = interactionTypeMeta(row.source, row.interactionType);
    const statusMeta = row.displayStatus && row.statusTone
        ? { displayStatus: row.displayStatus, statusTone: row.statusTone }
        : row.workflowStatus
            ? workflowStatusMeta(String(row.workflowStatus))
            : interactionStatusMeta(row.status, row.completionStatus, row.source);
    return {
        ...row,
        typeKey: row.typeKey ?? typeMeta.typeKey,
        typeIcon: row.typeIcon ?? typeMeta.typeIcon,
        typeCategory: row.typeCategory ?? typeMeta.typeCategory,
        displayStatus: statusMeta.displayStatus,
        statusTone: statusMeta.statusTone,
        nextActionLabel: buildNextActionLabel(row.nextAction, row.nextActionAt, row.dueLabel, row.completionStatus),
        blockName: row.blockName ?? null,
        blockId: row.blockId ?? null,
    };
}
function followUpPhaseLabel(phase, response) {
    const p = phase.toLowerCase();
    if (response === 'yes_applied')
        return 'Farmer applied fertigation / spray';
    if (p === 'application_check')
        return 'Application check (WhatsApp)';
    if (p === 'application_reminder')
        return 'Application reminder (WhatsApp)';
    if (p === 'outcome_check')
        return 'Outcome check (WhatsApp)';
    return 'Recommendation follow-up';
}
function mapInteraction(r) {
    const type = String(r.interaction_type ?? r.channel ?? 'Note');
    const toneMap = {
        completed: 'success',
        delivered: 'success',
        sent: 'info',
        active: 'info',
        pending: 'warning',
        'under review': 'review',
    };
    const status = String(r.status ?? 'completed');
    return {
        id: r.id,
        atLabel: formatDateTime(r.created_at),
        type: type.toLowerCase(),
        typeLabel: type,
        icon: type.toLowerCase().includes('whatsapp') ? 'whatsapp' : type.toLowerCase().includes('call') ? 'phone' : 'ai',
        by: r.done_by ?? 'Staff',
        role: r.done_by_role ?? 'Telecaller',
        summary: r.summary ?? r.content ?? '',
        nextAction: r.next_action ?? '—',
        nextDate: formatDateTime(r.next_action_at) ?? '',
        status: status.charAt(0).toUpperCase() + status.slice(1),
        statusTone: toneMap[status.toLowerCase()] ?? 'success',
        block: '—',
    };
}
function mapAgronomist(r, farmerId) {
    return {
        name: r.agronomist_name,
        employeeId: r.employee_id,
        mobile: String(r.mobile ?? '+91 98765 43211'),
        email: String(r.email ?? 'arjun.nair@morbeez.com'),
        specialization: r.specialization,
        assignedSince: r.assigned_since,
        assignedBlocks: 'Block A, Block B',
        lastReview: formatDateTime(r.last_review_at),
        nextVisit: formatDateTime(r.next_visit_at)?.split(',')[0] ?? '—',
        activities: [],
        blocks: [],
        performance: [
            { label: 'Total Visits', value: '12', icon: '📅' },
            { label: 'Recommendations Given', value: '18', icon: '📋' },
            { label: 'Active Follow-ups', value: '5', icon: '✓' },
            { label: 'Recovery Success Rate', value: '92%', icon: '📈' },
        ],
        farmerId,
    };
}
function defaultAgronomist(farmerId) {
    return mapAgronomist({
        agronomist_name: 'Arjun Nair',
        employee_id: 'AGRO-1001',
        specialization: 'Soil Nutrition, Banana, Pepper',
        assigned_since: '2024-05-10',
        last_review_at: new Date().toISOString(),
        next_visit_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    }, farmerId);
}
//# sourceMappingURL=crm-farmer.service.js.map