import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { leadService } from '../crm/lead.service.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { crmFarmerService } from './crm-farmer.service.js';
import { escalationAdminService } from './escalation-admin.service.js';
import { farmerOwnershipService } from '../partner/farmer-ownership.service.js';
const STAGE_LABELS = {
    new_lead: 'New Lead',
    interested: 'Interested',
    follow_up: 'Follow-up',
    recommendation: 'Recommendation',
    order_placed: 'Order Placed',
    repeat_customer: 'Repeat Customer',
};
function displayFarmerName(row) {
    const first = String(row.first_name ?? '').trim();
    const last = String(row.last_name ?? '').trim();
    const combined = [first, last].filter(Boolean).join(' ');
    if (combined)
        return combined;
    return String(row.name ?? '').trim() || 'Farmer';
}
function normalizeJoinRow(raw) {
    if (!raw)
        return null;
    if (Array.isArray(raw))
        return raw[0] ?? null;
    return raw;
}
function initials(name) {
    return (name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'F');
}
function taskIssueFromRow(row) {
    if (row.issue_description)
        return String(row.issue_description);
    const notes = row.notes ? String(row.notes) : '';
    if (!notes)
        return null;
    const match = notes.match(/^Issue:\s*(.+)$/m);
    return match?.[1]?.trim() || notes;
}
function mergeTaskNotes(notes, issueDescription) {
    const parts = [
        notes?.trim(),
        issueDescription?.trim() ? `Issue: ${issueDescription.trim()}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join('\n') : null;
}
function taskCategoryFromType(taskType) {
    if (taskType === 'visit')
        return 'visit_request';
    if (taskType === 'call')
        return 'call_farmer';
    return 'other';
}
function assignedAgronomistFromRow(row) {
    if (row.assigned_agronomist)
        return String(row.assigned_agronomist);
    return row.assigned_to ? String(row.assigned_to) : null;
}
const CRM_TASK_BASE_SELECT = `id, title, notes, task_type, status, due_at, assigned_to,
  farmer_id, lead_id, block_id, created_at, updated_at`;
function normalizePhone(phone) {
    if (!phone)
        return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10)
        return digits.slice(-10);
    return digits || null;
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
function isDueTodayIso(iso) {
    if (!iso)
        return false;
    const due = new Date(iso);
    const now = new Date();
    return (due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate());
}
function dueSortKey(iso) {
    if (!iso)
        return Number.MAX_SAFE_INTEGER;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}
function mapLeadRow(row) {
    const farmer = row.farmers;
    const name = farmer ? displayFarmerName(farmer) : 'Unknown';
    const stage = String(row.stage ?? 'new_lead');
    return {
        id: row.id,
        farmerId: row.farmer_id,
        intent: row.intent,
        source: row.source,
        status: row.status,
        stage,
        stageLabel: STAGE_LABELS[stage] ?? stage,
        priority: row.priority,
        assignedTo: row.assigned_to,
        notes: row.notes,
        followUpAt: row.follow_up_at,
        followUpLabel: formatDateTime(row.follow_up_at),
        lastInteractionAt: row.last_interaction_at,
        lastInteractionLabel: formatDateTime(row.last_interaction_at),
        leadScore: row.lead_score != null ? Number(row.lead_score) : 4.5,
        createdAt: row.created_at,
        campaignSource: row.campaign_source ?? null,
        leadChannel: row.lead_channel ?? null,
        marketingOwnerId: row.marketing_owner_id ?? null,
        marketingOwnerName: row.marketing_owner_name ?? null,
        utmCampaign: row.utm_campaign ?? null,
        utmSource: row.utm_source ?? null,
        utmMedium: row.utm_medium ?? null,
        attributionBadge: (() => {
            const ch = row.lead_channel ? String(row.lead_channel) : null;
            const camp = row.campaign_source ? String(row.campaign_source) : null;
            if (!ch && !camp)
                return null;
            const channelLabel = ch ? ch.charAt(0).toUpperCase() + ch.slice(1) : 'Unknown';
            return camp ? `${channelLabel} · ${camp}` : channelLabel;
        })(),
        farmerName: name,
        farmerInitials: initials(name),
        phone: farmer?.phone ?? null,
        district: farmer?.district ?? null,
        state: farmer?.state ?? null,
        farmerStatus: row.status === 'won' ? 'customer' : 'active',
    };
}
async function logInteraction(farmerId, channel, content, direction = 'outbound') {
    await supabase.from('interaction_logs').insert({
        farmer_id: farmerId,
        channel,
        direction,
        message_type: 'note',
        content,
    });
}
async function touchLead(leadId, _farmerId) {
    const now = new Date().toISOString();
    await supabase
        .from('leads')
        .update({ last_interaction_at: now, updated_at: now })
        .eq('id', leadId);
    return now;
}
export const telecallerAdminService = {
    stageLabels: STAGE_LABELS,
    async getOverview(agentEmail) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayIso = todayStart.toISOString();
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const tomorrowIso = tomorrowStart.toISOString();
        const [callsRes, tasksRes, dueTodayRes, leadsRes, ordersRes] = await Promise.all([
            supabase
                .from('crm_call_logs')
                .select('id', { count: 'exact', head: true })
                .eq('agent_email', agentEmail)
                .gte('created_at', todayIso),
            supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .or(`assigned_to.eq.${agentEmail},assigned_to.is.null`),
            supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .gte('due_at', todayIso)
                .lt('due_at', tomorrowIso)
                .or(`assigned_to.eq.${agentEmail},assigned_to.is.null`),
            supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('stage', 'interested'),
            supabase.from('commerce_orders').select('total_amount, phone, created_at').limit(5000),
        ]);
        throwIfSupabaseError(callsRes.error, 'Could not load overview');
        throwIfSupabaseError(tasksRes.error, 'Could not load overview');
        throwIfSupabaseError(dueTodayRes.error, 'Could not load overview');
        throwIfSupabaseError(leadsRes.error, 'Could not load overview');
        throwIfSupabaseError(ordersRes.error, 'Could not load overview');
        const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        let ordersGenerated = 0;
        let revenue = 0;
        for (const o of ordersRes.data ?? []) {
            const created = new Date(String(o.created_at));
            if (created >= monthStart) {
                ordersGenerated += 1;
                revenue += Number(o.total_amount) || 0;
            }
        }
        const { count: myLeads } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', agentEmail);
        const interested = leadsRes.count ?? 0;
        const conversionRate = (myLeads ?? 0) > 0 ? Math.round(((ordersGenerated / (myLeads ?? 1)) * 100) * 10) / 10 : 0;
        return {
            callsToday: callsRes.count ?? 0,
            pendingFollowUps: tasksRes.count ?? 0,
            followUpsDueToday: dueTodayRes.count ?? 0,
            interestedFarmers: interested,
            ordersGenerated,
            revenue: Math.round(revenue),
            conversionRate,
            myLeadsCount: myLeads ?? 0,
            allLeadsCount: 0,
        };
    },
    async listLeads(query, agentEmail) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(50, Math.max(1, query.limit ?? 20));
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let builder = supabase
            .from('leads')
            .select('*, farmers(phone, name, first_name, last_name, district, state, preferred_language)', {
            count: 'exact',
        })
            .order('updated_at', { ascending: false });
        if (query.scope === 'mine') {
            builder = builder.eq('assigned_to', agentEmail);
        }
        if (query.stage && query.stage !== 'all') {
            builder = builder.eq('stage', query.stage);
        }
        const { data, error, count } = await builder.range(from, to);
        throwIfSupabaseError(error, 'Could not load leads');
        let rows = (data ?? []).map((r) => mapLeadRow(r));
        if (query.search?.trim()) {
            const term = query.search.trim().toLowerCase();
            rows = rows.filter((l) => {
                const hay = [l.farmerName, l.phone, l.notes, l.stageLabel].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(term);
            });
        }
        const [{ count: myCount }, { count: allCount }] = await Promise.all([
            supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('assigned_to', agentEmail),
            supabase.from('leads').select('id', { count: 'exact', head: true }),
        ]);
        const { telecallerIntelligenceService } = await import('../intelligence/telecaller-intelligence.service.js');
        const enriched = await telecallerIntelligenceService.enrichLeadRows(rows);
        return {
            leads: enriched,
            counts: { mine: myCount ?? 0, all: allCount ?? 0 },
            pagination: {
                page,
                limit,
                total: count ?? rows.length,
                pages: Math.max(1, Math.ceil((count ?? rows.length) / limit)),
            },
        };
    },
    async getLeadDetail(leadId) {
        const { data, error } = await supabase
            .from('leads')
            .select(`*, farmers(
          id, phone, name, first_name, last_name, district, state, village,
          preferred_language, metadata, created_at, pincode_id,
          whatsapp_phone, whatsapp_same_as_phone, shipping_address, delivery_pincode,
          total_acreage, roi_enabled, farmer_notes, assigned_crop_advisor,
          pincode_master(pincode, district, state)
        )`)
            .eq('id', leadId)
            .single();
        if (error || !data)
            throw new NotFoundError('Lead not found');
        const lead = mapLeadRow(data);
        const farmer = data.farmers;
        const farmerId = String(data.farmer_id);
        const [cropsRes, tasksRes, callsRes, interactionsRes, ordersRes] = await Promise.all([
            supabase
                .from('farm_blocks')
                .select('id, crop_type, acreage, is_primary, name, plot_label, planting_date')
                .eq('farmer_id', farmerId)
                .order('is_primary', { ascending: false }),
            supabase
                .from('crm_tasks')
                .select('*')
                .eq('farmer_id', farmerId)
                .order('due_at', { ascending: true })
                .limit(20),
            supabase
                .from('crm_call_logs')
                .select('*')
                .eq('farmer_id', farmerId)
                .order('created_at', { ascending: false })
                .limit(20),
            supabase
                .from('interaction_logs')
                .select('*')
                .eq('farmer_id', farmerId)
                .order('created_at', { ascending: false })
                .limit(30),
            supabase
                .from('commerce_orders')
                .select('id, order_name, total_amount, created_at, phone')
                .not('phone', 'is', null)
                .order('created_at', { ascending: false })
                .limit(100),
        ]);
        const phoneKey = normalizePhone(String(farmer?.phone ?? ''));
        const orders = (ordersRes.data ?? []).filter((o) => normalizePhone(String(o.phone)) === phoneKey);
        const timeline = [];
        for (const c of callsRes.data ?? []) {
            timeline.push({
                id: String(c.id),
                type: 'call',
                title: `Call ${c.direction === 'inbound' ? 'received' : 'completed'}`,
                detail: String(c.outcome ?? c.notes ?? ''),
                at: String(c.created_at),
                atLabel: formatDateTime(c.created_at) ?? '',
            });
        }
        for (const i of interactionsRes.data ?? []) {
            timeline.push({
                id: String(i.id),
                type: String(i.channel),
                title: `${i.channel} ${i.direction}`,
                detail: String(i.content ?? '').slice(0, 200),
                at: String(i.created_at),
                atLabel: formatDateTime(i.created_at) ?? '',
            });
        }
        timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        const blocks = cropsRes.data ?? [];
        const crops = blocks.map((c) => String(c.crop_type));
        const primaryCrop = crops[0] ?? '—';
        const nextTask = (tasksRes.data ?? []).find((t) => t.status === 'pending');
        const metadata = farmer?.metadata ?? {};
        const pm = farmer?.pincode_master;
        const pincode = pm?.pincode ?? null;
        const totalAcre = farmer?.total_acreage != null
            ? String(farmer.total_acreage)
            : metadata.acreage
                ? String(metadata.acreage)
                : '—';
        return {
            lead: { ...lead, pincode },
            farmer: {
                id: farmerId,
                name: lead.farmerName,
                phone: lead.phone,
                email: null,
                district: lead.district ?? pm?.district ?? null,
                state: lead.state ?? pm?.state ?? null,
                pincode,
                village: farmer?.village ? String(farmer.village) : null,
                language: farmer?.preferred_language ?? 'Hindi',
                territory: [lead.district, lead.state].filter(Boolean).join(', ') || '—',
                crop: primaryCrop,
                acreage: totalAcre,
                whatsappSame: farmer?.whatsapp_same_as_phone !== false,
                whatsappPhone: farmer?.whatsapp_phone ? String(farmer.whatsapp_phone) : null,
                shippingAddress: farmer?.shipping_address ? String(farmer.shipping_address) : null,
                deliveryPincode: farmer?.delivery_pincode ? String(farmer.delivery_pincode) : null,
                roiEnabled: Boolean(farmer?.roi_enabled),
                farmerNotes: farmer?.farmer_notes ? String(farmer.farmer_notes) : null,
                assignedCropAdvisor: farmer?.assigned_crop_advisor
                    ? String(farmer.assigned_crop_advisor)
                    : null,
                farmSize: metadata.farmSize ? String(metadata.farmSize) : '—',
                irrigation: metadata.irrigation ? String(metadata.irrigation) : '—',
                soilType: metadata.soilType ? String(metadata.soilType) : 'Loamy',
                rating: lead.leadScore,
            },
            farmOverview: {
                totalBlocks: blocks.length || Number(metadata.totalBlocks) || 1,
                totalArea: metadata.totalArea ?? '—',
                primaryCrop,
                soilType: metadata.soilType ?? 'Loamy',
                blocks: blocks.map((b) => ({
                    id: String(b.id),
                    name: String(b.name ?? b.plot_label ?? 'Block'),
                    cropType: String(b.crop_type),
                    acreage: b.acreage,
                    isPrimary: Boolean(b.is_primary),
                })),
            },
            soilReport: {
                reportId: metadata.soilReportId ?? '—',
                date: metadata.soilReportDate ?? '—',
                health: metadata.soilHealth ?? 'Moderate',
                ph: metadata.soilPh ?? '6.8',
            },
            tasks: (tasksRes.data ?? []).map((t) => ({
                id: t.id,
                title: t.title,
                dueAt: t.due_at,
                dueLabel: formatDateTime(t.due_at),
                status: t.status,
                type: t.task_type,
            })),
            nextFollowUp: nextTask
                ? {
                    id: nextTask.id,
                    title: nextTask.title,
                    dueLabel: formatDateTime(nextTask.due_at),
                    notes: nextTask.notes,
                }
                : data.follow_up_at
                    ? {
                        id: null,
                        title: 'Scheduled follow-up',
                        dueLabel: formatDateTime(data.follow_up_at),
                        notes: data.notes,
                    }
                    : null,
            timeline: timeline.slice(0, 15),
            orders: orders.slice(0, 5).map((o) => ({
                id: o.id,
                label: o.order_name ?? 'Order',
                amount: Number(o.total_amount) || 0,
                date: formatDateTime(o.created_at),
            })),
            stages: Object.entries(STAGE_LABELS).map(([id, label]) => ({
                id,
                label,
                active: id === lead.stage,
                done: this.stageIndex(id) < this.stageIndex(lead.stage),
            })),
        };
    },
    stageIndex(stage) {
        const order = [
            'new_lead',
            'interested',
            'follow_up',
            'recommendation',
            'order_placed',
            'repeat_customer',
        ];
        return order.indexOf(stage);
    },
    async createLead(input, agentEmail) {
        const result = await leadService.createLead({
            phone: input.phone,
            name: input.name,
            intent: 'general',
            source: 'phone',
            notes: input.notes ?? input.farmerNotes,
            cropType: input.cropType ?? input.cropBlocks?.[0]?.cropName,
            district: input.district,
            leadChannel: input.leadChannel,
            campaignSource: input.campaignSource,
            marketingOwnerId: input.marketingOwnerId,
            marketingOwnerName: input.marketingOwnerName,
            utmCampaign: input.utmCampaign,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
        });
        const { telecallerFarmerProfileService } = await import('./telecaller-farmer-profile.service.js');
        await telecallerFarmerProfileService.applyProfileOnCreate(result.farmer.id, {
            name: input.name,
            whatsappSame: input.whatsappSame,
            whatsappPhone: input.whatsappPhone,
            language: input.language,
            pincode: input.pincode,
            village: input.village,
            totalAcreage: input.totalAcreage,
            shippingAddress: input.shippingAddress,
            deliveryPincode: input.deliveryPincode,
            assignedCropAdvisor: input.assignedCropAdvisor,
            roiEnabled: input.roiEnabled,
            farmerNotes: input.farmerNotes,
            cropBlocks: input.cropBlocks,
        });
        if (input.preferredMarkets?.length) {
            const { whatsappOsAdminService } = await import('./whatsapp-os-admin.service.js');
            await whatsappOsAdminService.saveFarmerMarketPreferences({
                farmerId: result.farmer.id,
                cropType: input.cropType || input.cropBlocks?.[0]?.cropName || undefined,
                markets: input.preferredMarkets
                    .map((m) => {
                    const [marketNameRaw, districtRaw] = m.marketKey.split('|');
                    const marketName = marketNameRaw?.trim();
                    if (!marketName)
                        return null;
                    return {
                        marketName,
                        district: districtRaw?.trim() || null,
                    };
                })
                    .filter((m) => Boolean(m)),
            });
        }
        await supabase
            .from('leads')
            .update({
            assigned_to: agentEmail,
            stage: 'new_lead',
            follow_up_at: new Date(Date.now() + 86400000).toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', String(result.lead.id));
        if (input.state) {
            await supabase.from('farmers').update({ state: input.state }).eq('id', result.farmer.id);
        }
        const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
        void farmerEventCaptureService.trackFarmerOnboarded({
            farmerId: result.farmer.id,
            leadId: String(result.lead.id),
            source: 'phone',
            intent: 'general',
            assignedTo: agentEmail,
        });
        return this.getLeadDetail(String(result.lead.id));
    },
    async updateLead(leadId, patch, agentEmail) {
        const updates = { updated_at: new Date().toISOString() };
        if (patch.stage)
            updates.stage = patch.stage;
        if (patch.notes !== undefined)
            updates.notes = patch.notes;
        if (patch.followUpAt !== undefined)
            updates.follow_up_at = patch.followUpAt;
        if (patch.assignedTo !== undefined)
            updates.assigned_to = patch.assignedTo;
        if (patch.priority)
            updates.priority = patch.priority;
        if (patch.leadChannel !== undefined)
            updates.lead_channel = patch.leadChannel;
        if (patch.campaignSource !== undefined)
            updates.campaign_source = patch.campaignSource;
        if (patch.marketingOwnerId !== undefined)
            updates.marketing_owner_id = patch.marketingOwnerId;
        if (patch.marketingOwnerName !== undefined)
            updates.marketing_owner_name = patch.marketingOwnerName;
        if (patch.utmCampaign !== undefined)
            updates.utm_campaign = patch.utmCampaign;
        if (patch.utmSource !== undefined)
            updates.utm_source = patch.utmSource;
        if (patch.utmMedium !== undefined)
            updates.utm_medium = patch.utmMedium;
        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', leadId)
            .select('farmer_id, stage')
            .single();
        if (error || !data)
            throw new NotFoundError('Lead not found');
        if (patch.stage) {
            await logInteraction(data.farmer_id, 'crm', `Lead stage updated to ${STAGE_LABELS[patch.stage] ?? patch.stage} by ${agentEmail}`);
        }
        if (patch.assignedTo !== undefined) {
            const { farmerOwnershipService } = await import('../partner/farmer-ownership.service.js');
            void farmerOwnershipService.syncTelecallerAssignment(data.farmer_id, patch.assignedTo ?? null);
        }
        if (patch.assignedTo) {
            const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
            void farmerEventCaptureService.trackLeadAssignment(data.farmer_id, patch.assignedTo);
        }
        await touchLead(leadId, data.farmer_id);
        return this.getLeadDetail(leadId);
    },
    async listLeadNotes(leadId) {
        const { data: lead } = await supabase.from('leads').select('farmer_id, notes').eq('id', leadId).single();
        if (!lead)
            throw new NotFoundError('Lead not found');
        const { data, error } = await supabase
            .from('telecaller_notes')
            .select('*')
            .eq('farmer_id', lead.farmer_id)
            .order('created_at', { ascending: false })
            .limit(80);
        throwIfSupabaseError(error, 'Could not load notes');
        const rows = (data ?? []).map((n) => {
            const body = String(n.note ?? '');
            return {
                id: String(n.id),
                summary: body.slice(0, 160),
                note: body,
                author: String(n.author ?? 'Telecaller'),
                createdLabel: formatDateTime(n.created_at) ?? '—',
                at: String(n.created_at),
                canEdit: true,
                isLegacy: false,
            };
        });
        if (rows.length === 0 && lead.notes) {
            const chunks = String(lead.notes)
                .split(/\n{2,}/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            const legacyChunks = chunks.length > 1
                ? chunks
                : String(lead.notes)
                    .split('\n')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 20);
            legacyChunks.forEach((chunk, i) => {
                rows.push({
                    id: `legacy-${i}`,
                    summary: chunk.slice(0, 160),
                    note: chunk,
                    author: 'Historical',
                    createdLabel: '—',
                    at: new Date(0).toISOString(),
                    canEdit: false,
                    isLegacy: true,
                });
            });
        }
        return { notes: rows };
    },
    async getLeadNote(leadId, noteId) {
        const { data: lead } = await supabase.from('leads').select('farmer_id, notes').eq('id', leadId).single();
        if (!lead)
            throw new NotFoundError('Lead not found');
        if (noteId.startsWith('legacy-')) {
            const index = Number(noteId.slice('legacy-'.length));
            const listed = await this.listLeadNotes(leadId);
            const row = listed.notes.find((n) => n.id === noteId);
            if (!row)
                throw new NotFoundError('Note not found');
            return {
                id: noteId,
                summary: row.summary,
                note: row.note,
                author: row.author,
                createdLabel: row.createdLabel,
                at: row.at,
                canEdit: false,
                isLegacy: true,
                legacyIndex: index,
            };
        }
        const { data: n, error } = await supabase
            .from('telecaller_notes')
            .select('*')
            .eq('id', noteId)
            .eq('farmer_id', lead.farmer_id)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load note');
        if (!n)
            throw new NotFoundError('Note not found');
        const body = String(n.note ?? '');
        return {
            id: String(n.id),
            summary: body.slice(0, 160),
            note: body,
            author: String(n.author ?? 'Telecaller'),
            createdLabel: formatDateTime(n.created_at) ?? '—',
            at: String(n.created_at),
            canEdit: true,
            isLegacy: false,
        };
    },
    async updateLeadNote(leadId, noteId, note, agentEmail) {
        if (noteId.startsWith('legacy-')) {
            throw new NotFoundError('Historical notes cannot be edited. Add a new note instead.');
        }
        const { data: lead } = await supabase.from('leads').select('farmer_id').eq('id', leadId).single();
        if (!lead)
            throw new NotFoundError('Lead not found');
        const { data, error } = await supabase
            .from('telecaller_notes')
            .update({ note: note.trim() })
            .eq('id', noteId)
            .eq('farmer_id', lead.farmer_id)
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not update note');
        await logInteraction(lead.farmer_id, 'note', `${agentEmail} updated note`);
        await touchLead(leadId, lead.farmer_id);
        return data;
    },
    async addNote(leadId, note, agentEmail) {
        const { data } = await supabase.from('leads').select('farmer_id, notes').eq('id', leadId).single();
        if (!data)
            throw new NotFoundError('Lead not found');
        const { error: noteError } = await supabase.from('telecaller_notes').insert({
            farmer_id: data.farmer_id,
            author: agentEmail,
            note,
        });
        throwIfSupabaseError(noteError, 'Could not save note');
        const merged = [data.notes, note].filter(Boolean).join('\n');
        await supabase
            .from('leads')
            .update({ notes: merged, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        await logInteraction(data.farmer_id, 'note', `${agentEmail}: ${note}`);
        await touchLead(leadId, data.farmer_id);
        return this.getLeadDetail(leadId);
    },
    async createTask(leadId, input, agentEmail) {
        const { data: lead } = await supabase.from('leads').select('farmer_id').eq('id', leadId).single();
        if (!lead)
            throw new NotFoundError('Lead not found');
        const ownership = await farmerOwnershipService.getOwnership(String(lead.farmer_id));
        const isPartnerVisit = (input.taskCategory === 'visit_request' || input.taskType === 'visit') &&
            ownership?.serviceModel === 'partner_assisted' &&
            ownership?.assignedPartnerId;
        const taskType = input.taskType ?? 'follow_up';
        const safeType = ['follow_up', 'call', 'whatsapp', 'visit', 'other'].includes(taskType)
            ? taskType
            : 'other';
        const agronomistEmail = input.assignedAgronomist?.trim().toLowerCase() || null;
        const notes = mergeTaskNotes(input.notes, input.issueDescription);
        const insertRow = {
            farmer_id: lead.farmer_id,
            lead_id: leadId,
            block_id: input.blockId ?? null,
            interaction_log_id: input.interactionLogId ?? null,
            assigned_to: isPartnerVisit ? null : agronomistEmail ?? agentEmail,
            assigned_partner_id: isPartnerVisit ? ownership.assignedPartnerId : null,
            assigned_to_role: isPartnerVisit ? 'partner' : agronomistEmail ? 'agronomist' : 'telecaller',
            title: input.title,
            notes,
            due_at: input.dueAt ?? new Date(Date.now() + 86400000).toISOString(),
            task_type: safeType,
        };
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert(insertRow)
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not create task');
        if (input.dueAt) {
            await supabase.from('leads').update({ follow_up_at: input.dueAt }).eq('id', leadId);
        }
        if (input.initialComment?.trim()) {
            await this.addTaskComment(String(data.id), {
                body: input.initialComment.trim(),
                authorEmail: agentEmail,
                authorRole: 'telecaller',
            });
        }
        return data;
    },
    async listLeadAgronomistTasks(leadId) {
        const { data: lead } = await supabase.from('leads').select('farmer_id').eq('id', leadId).single();
        if (!lead)
            throw new NotFoundError('Lead not found');
        const agronomists = await this.listAssignableAgronomists();
        const agronomistEmails = agronomists.map((a) => a.email);
        if (!agronomistEmails.length)
            return [];
        const { data, error } = await supabase
            .from('crm_tasks')
            .select(`${CRM_TASK_BASE_SELECT}, farm_blocks(name, crop_name)`)
            .eq('farmer_id', lead.farmer_id)
            .in('assigned_to', agronomistEmails)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })
            .limit(100);
        throwIfSupabaseError(error, 'Could not load agronomist tasks');
        return (data ?? []).map((row) => {
            const block = normalizeJoinRow(row.farm_blocks);
            const taskType = String(row.task_type ?? 'other');
            return {
                id: String(row.id),
                title: String(row.title ?? 'Task'),
                issue: taskIssueFromRow(row),
                priority: 'medium',
                taskCategory: taskCategoryFromType(taskType),
                taskType,
                status: String(row.status ?? 'pending'),
                dueAt: row.due_at ? String(row.due_at) : null,
                dueLabel: formatDateTime(row.due_at) ?? '—',
                assignedAgronomist: assignedAgronomistFromRow(row),
                createdBy: null,
                blockName: block?.name ? String(block.name) : null,
                cropName: block?.crop_name ? String(block.crop_name) : null,
                createdAt: row.created_at ? String(row.created_at) : null,
            };
        });
    },
    async listTasksForAgronomist(agronomistEmail, opts) {
        const email = agronomistEmail.trim().toLowerCase();
        let query = supabase
            .from('crm_tasks')
            .select(`${CRM_TASK_BASE_SELECT},
         farmers(name, first_name, last_name, district),
         farm_blocks(name, crop_name)`)
            .eq('assigned_to', email)
            .neq('status', 'cancelled')
            .order('due_at', { ascending: true, nullsFirst: false })
            .limit(opts?.limit ?? 80);
        if (opts?.status === 'pending')
            query = query.eq('status', 'pending');
        else if (opts?.status === 'done')
            query = query.eq('status', 'done');
        const { data, error } = await query;
        throwIfSupabaseError(error, 'Could not load agronomist tasks');
        return (data ?? []).map((row) => {
            const farmer = normalizeJoinRow(row.farmers);
            const block = normalizeJoinRow(row.farm_blocks);
            const taskType = String(row.task_type ?? 'other');
            return {
                id: String(row.id),
                title: String(row.title ?? 'Task'),
                issue: taskIssueFromRow(row),
                priority: 'medium',
                taskCategory: taskCategoryFromType(taskType),
                taskType,
                status: String(row.status ?? 'pending'),
                dueAt: row.due_at ? String(row.due_at) : null,
                dueLabel: formatDateTime(row.due_at) ?? '—',
                farmerId: row.farmer_id ? String(row.farmer_id) : null,
                leadId: row.lead_id ? String(row.lead_id) : null,
                farmerName: farmer ? displayFarmerName(farmer) : 'Farmer',
                blockName: block?.name ? String(block.name) : null,
                cropName: block?.crop_name ? String(block.crop_name) : null,
                createdBy: null,
            };
        });
    },
    async listScheduledVisitsForAgronomist(agronomistEmail, opts) {
        const email = agronomistEmail.trim().toLowerCase();
        const { data, error } = await supabase
            .from('crm_tasks')
            .select(`id, title, notes, status, due_at, farmer_id, lead_id, block_id,
         farmers(name, first_name, last_name, district, village),
         farm_blocks(name, crop_name)`)
            .eq('assigned_to', email)
            .eq('task_type', 'visit')
            .eq('status', 'pending')
            .order('due_at', { ascending: true })
            .limit(opts?.limit ?? 50);
        throwIfSupabaseError(error, 'Could not load scheduled visits');
        return (data ?? []).map((row) => {
            const farmer = normalizeJoinRow(row.farmers);
            const block = normalizeJoinRow(row.farm_blocks);
            return {
                id: String(row.id),
                title: String(row.title ?? 'Field visit'),
                dueAt: row.due_at ? String(row.due_at) : null,
                dueLabel: formatDateTime(row.due_at) ?? '—',
                farmerId: row.farmer_id ? String(row.farmer_id) : null,
                leadId: row.lead_id ? String(row.lead_id) : null,
                farmerName: farmer ? displayFarmerName(farmer) : 'Farmer',
                location: farmer?.district ? String(farmer.district) : null,
                blockName: block?.name ? String(block.name) : null,
                cropName: block?.crop_name ? String(block.crop_name) : null,
                notes: row.notes ? String(row.notes) : null,
            };
        });
    },
    async getTaskDetail(taskId) {
        const { data: task, error } = await supabase
            .from('crm_tasks')
            .select(`${CRM_TASK_BASE_SELECT},
         farmers(name, first_name, last_name, phone, district),
         farm_blocks(name, crop_name),
         leads(id, farmer_id)`)
            .eq('id', taskId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load task');
        if (!task)
            throw new NotFoundError('Task not found');
        let comments = [];
        const { data: commentRows, error: commentsErr } = await supabase
            .from('crm_task_comments')
            .select('id, author_email, author_role, author_name, body, created_at')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        if (!commentsErr)
            comments = commentRows ?? [];
        const farmer = normalizeJoinRow(task.farmers);
        const block = normalizeJoinRow(task.farm_blocks);
        const taskType = String(task.task_type ?? 'other');
        return {
            task: {
                id: String(task.id),
                title: String(task.title ?? 'Task'),
                issue: taskIssueFromRow(task),
                notes: task.notes ? String(task.notes) : null,
                priority: 'medium',
                taskCategory: taskCategoryFromType(taskType),
                taskType,
                status: String(task.status ?? 'pending'),
                dueAt: task.due_at ? String(task.due_at) : null,
                dueLabel: formatDateTime(task.due_at) ?? '—',
                assignedTo: task.assigned_to ? String(task.assigned_to) : null,
                assignedAgronomist: assignedAgronomistFromRow(task),
                createdBy: null,
                farmerId: task.farmer_id ? String(task.farmer_id) : null,
                leadId: task.lead_id ? String(task.lead_id) : null,
                blockId: task.block_id ? String(task.block_id) : null,
                farmerName: farmer ? displayFarmerName(farmer) : 'Farmer',
                farmerPhone: farmer?.phone ? String(farmer.phone) : null,
                blockName: block?.name ? String(block.name) : null,
                cropName: block?.crop_name ? String(block.crop_name) : null,
            },
            comments: (comments ?? []).map((c) => ({
                id: String(c.id),
                authorEmail: String(c.author_email),
                authorRole: String(c.author_role),
                authorName: c.author_name ? String(c.author_name) : null,
                body: String(c.body),
                createdAt: String(c.created_at),
                atLabel: formatDateTime(c.created_at) ?? '—',
            })),
        };
    },
    async addTaskComment(taskId, input) {
        const { data, error } = await supabase
            .from('crm_task_comments')
            .insert({
            task_id: taskId,
            author_email: input.authorEmail.trim().toLowerCase(),
            author_role: input.authorRole,
            author_name: input.authorName ?? null,
            body: input.body.trim(),
        })
            .select()
            .single();
        if (!error && data) {
            await supabase.from('crm_tasks').update({ updated_at: new Date().toISOString() }).eq('id', taskId);
            return {
                id: String(data.id),
                authorEmail: String(data.author_email),
                authorRole: String(data.author_role),
                authorName: data.author_name ? String(data.author_name) : null,
                body: String(data.body),
                createdAt: String(data.created_at),
                atLabel: formatDateTime(data.created_at) ?? '—',
            };
        }
        const { data: task } = await supabase.from('crm_tasks').select('notes').eq('id', taskId).maybeSingle();
        const prefix = input.authorRole === 'agronomist' ? 'Agronomist' : 'Telecaller';
        const line = `[${prefix}] ${input.body.trim()}`;
        const merged = [task?.notes ? String(task.notes) : null, line].filter(Boolean).join('\n');
        await supabase
            .from('crm_tasks')
            .update({ notes: merged, updated_at: new Date().toISOString() })
            .eq('id', taskId);
        const now = new Date().toISOString();
        return {
            id: taskId,
            authorEmail: input.authorEmail.trim().toLowerCase(),
            authorRole: input.authorRole,
            authorName: input.authorName ?? null,
            body: input.body.trim(),
            createdAt: now,
            atLabel: formatDateTime(now) ?? '—',
        };
    },
    async listAssignableAgronomists() {
        const { data, error } = await supabase
            .from('employee_profiles')
            .select('id, full_name, email, employee_code, status')
            .eq('role', 'agronomist')
            .eq('status', 'active')
            .order('full_name', { ascending: true });
        throwIfSupabaseError(error, 'Could not load agronomists');
        return (data ?? []).map((row) => ({
            id: String(row.id),
            name: String(row.full_name ?? row.email),
            email: String(row.email).trim().toLowerCase(),
            employeeCode: row.employee_code ? String(row.employee_code) : null,
        }));
    },
    async updateTask(taskId, input) {
        const updates = { updated_at: new Date().toISOString() };
        if (input.title !== undefined)
            updates.title = input.title;
        if (input.notes !== undefined)
            updates.notes = input.notes;
        if (input.dueAt !== undefined)
            updates.due_at = input.dueAt;
        if (input.markDone) {
            updates.status = 'done';
            updates.completed_at = new Date().toISOString();
        }
        else if (input.markPending) {
            updates.status = 'pending';
            updates.completed_at = null;
        }
        const { data: task, error } = await supabase
            .from('crm_tasks')
            .update(updates)
            .eq('id', taskId)
            .select('lead_id, due_at')
            .single();
        throwIfSupabaseError(error, 'Could not update task');
        if (task?.lead_id && input.dueAt !== undefined) {
            await supabase.from('leads').update({ follow_up_at: input.dueAt }).eq('id', task.lead_id);
        }
        return task;
    },
    async completeTask(taskId) {
        const { data: task } = await supabase
            .from('crm_tasks')
            .select('farmer_id, assigned_to')
            .eq('id', taskId)
            .maybeSingle();
        const { error } = await supabase
            .from('crm_tasks')
            .update({
            status: 'done',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', taskId);
        throwIfSupabaseError(error, 'Could not complete task');
        if (task?.farmer_id && task.assigned_to) {
            const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
            void farmerEventCaptureService.trackCrmFollowUpCompleted({
                farmerId: String(task.farmer_id),
                taskId,
                agentEmail: String(task.assigned_to),
            });
        }
    },
    async logCall(leadId, input, agentEmail) {
        const { data: lead } = await supabase.from('leads').select('farmer_id').eq('id', leadId).single();
        if (!lead)
            throw new NotFoundError('Lead not found');
        const outcome = input.outcome ?? 'connected';
        const summary = input.notes?.trim() || `Call: ${outcome}`;
        const { data: callRow, error } = await supabase
            .from('crm_call_logs')
            .insert({
            farmer_id: lead.farmer_id,
            lead_id: leadId,
            agent_email: agentEmail,
            direction: 'outbound',
            outcome,
            duration_seconds: input.durationSeconds ?? 0,
            notes: input.notes,
            processing_status: input.notes ? 'confirmed' : 'pending',
            recording_provider: 'manual',
        })
            .select('id')
            .single();
        throwIfSupabaseError(error, 'Could not log call');
        const interaction = await crmFarmerService.createInteraction(lead.farmer_id, leadId, {
            interactionType: 'Phone Call',
            channel: 'call',
            summary,
            outcome,
            doneBy: agentEmail,
            doneByRole: 'telecaller',
        });
        if (callRow?.id && interaction?.id) {
            await supabase
                .from('crm_call_logs')
                .update({ interaction_log_id: interaction.id, updated_at: new Date().toISOString() })
                .eq('id', callRow.id);
        }
        const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
        void farmerEventCaptureService.trackInteractionSession({
            farmerId: String(lead.farmer_id),
            interactionLogId: String(interaction.id),
            interactionType: 'Phone Call',
            workflowStatus: 'Closed',
            escalated: false,
            outcome,
            employeeEmail: agentEmail,
        });
        await touchLead(leadId, lead.farmer_id);
        return this.getLeadDetail(leadId);
    },
    /** All pending work for a lead: CRM tasks, interactions, field follow-ups, escalations, AI approval. */
    async listLeadPendingTasks(leadId) {
        const { data: lead, error: leadErr } = await supabase
            .from('leads')
            .select('farmer_id, farmers(name, first_name, last_name, phone)')
            .eq('id', leadId)
            .single();
        if (leadErr || !lead)
            throw new NotFoundError('Lead not found');
        const farmerId = String(lead.farmer_id);
        const farmersRel = lead.farmers;
        const farmer = Array.isArray(farmersRel) ? farmersRel[0] : farmersRel;
        const farmerName = farmer ? displayFarmerName(farmer) : 'Farmer';
        const [tasksRes, fieldRes, escRows, aiRes, crmRecRes, interactionsPack,] = await Promise.all([
            supabase
                .from('crm_tasks')
                .select('*')
                .eq('farmer_id', farmerId)
                .eq('status', 'pending')
                .order('due_at', { ascending: true })
                .limit(100),
            supabase
                .from('crm_field_findings')
                .select('id, block_name, follow_up_at, disease_pest, observations')
                .eq('farmer_id', farmerId)
                .is('archived_at', null)
                .not('follow_up_at', 'is', null)
                .order('follow_up_at', { ascending: true })
                .limit(50),
            escalationAdminService.listForFarmer(farmerId),
            supabase
                .from('recommendation_records')
                .select('id, issue_detected, recommendation_text, status, created_at, block_id')
                .eq('farmer_id', farmerId)
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false })
                .limit(30),
            supabase
                .from('crm_recommendations')
                .select('id, recommendation, problem, status, follow_up_at, created_at')
                .eq('farmer_id', farmerId)
                .eq('status', 'pending')
                .limit(30),
            crmFarmerService.listHumanCrmInteractions(farmerId, leadId, 1, 120),
        ]);
        throwIfSupabaseError(tasksRes.error, 'Could not load lead tasks');
        throwIfSupabaseError(fieldRes.error, 'Could not load field follow-ups');
        throwIfSupabaseError(aiRes.error, 'Could not load AI approvals');
        throwIfSupabaseError(crmRecRes.error, 'Could not load CRM recommendations');
        const items = [];
        const seenInteractionIds = new Set();
        const crmTaskIds = new Set((tasksRes.data ?? []).map((t) => String(t.id)));
        for (const t of tasksRes.data ?? []) {
            const taskType = String(t.task_type ?? 'follow_up');
            const dueAt = t.due_at ? String(t.due_at) : null;
            const isVisit = taskType === 'visit';
            items.push({
                id: `crm-task-${t.id}`,
                itemType: 'crm_task',
                category: isVisit ? 'Field visit' : 'CRM task',
                title: String(t.title ?? 'Follow-up'),
                subtitle: taskType.replace(/_/g, ' '),
                dueAt,
                dueLabel: formatDateTime(dueAt) ?? '—',
                isDueToday: isDueTodayIso(dueAt),
                farmerName,
                status: 'pending',
                statusLabel: isVisit ? 'Visit scheduled' : 'Pending',
                canComplete: true,
                taskId: String(t.id),
                navigateTab: null,
            });
        }
        for (const f of fieldRes.data ?? []) {
            const dueAt = f.follow_up_at ? String(f.follow_up_at) : null;
            const block = String(f.block_name ?? 'Block');
            const overdue = dueAt ? new Date(dueAt).getTime() < Date.now() : false;
            items.push({
                id: `field-${f.id}`,
                itemType: 'field_follow_up',
                category: 'Field follow-up',
                title: `Agronomist field follow-up — ${block}`,
                subtitle: String(f.disease_pest ?? f.observations ?? '').slice(0, 80) || null,
                dueAt,
                dueLabel: formatDateTime(dueAt) ?? '—',
                isDueToday: isDueTodayIso(dueAt),
                farmerName,
                status: overdue ? 'overdue' : 'pending',
                statusLabel: overdue ? 'Overdue' : 'Scheduled',
                canComplete: false,
                taskId: null,
                navigateTab: 'findings',
            });
        }
        for (const e of escRows) {
            if (e.workflowStatus === 'completed')
                continue;
            items.push({
                id: `esc-${e.id}`,
                itemType: 'escalation',
                category: 'Escalation',
                title: String(e.summary || e.reason || 'Escalation'),
                subtitle: e.priority ? `Priority: ${e.priority}` : null,
                dueAt: e.createdAt ? String(e.createdAt) : null,
                dueLabel: e.createdLabel ?? '—',
                isDueToday: false,
                farmerName,
                status: e.workflowStatus,
                statusLabel: e.statusLabel,
                canComplete: false,
                taskId: null,
                navigateTab: 'escalations',
            });
        }
        for (const r of aiRes.data ?? []) {
            items.push({
                id: `ai-${r.id}`,
                itemType: 'ai_approval',
                category: 'AI approval',
                title: String(r.issue_detected ?? r.recommendation_text ?? 'Recommendation').slice(0, 120),
                subtitle: 'Awaiting super admin approval',
                dueAt: r.created_at ? String(r.created_at) : null,
                dueLabel: formatDateTime(r.created_at) ?? '—',
                isDueToday: false,
                farmerName,
                status: 'pending_approval',
                statusLabel: 'Pending approval',
                canComplete: false,
                taskId: null,
                navigateTab: 'agronomist',
            });
        }
        for (const r of crmRecRes.data ?? []) {
            const dueAt = r.follow_up_at ? String(r.follow_up_at) : null;
            items.push({
                id: `crm-rec-${r.id}`,
                itemType: 'crm_recommendation',
                category: 'Recommendation',
                title: String(r.recommendation ?? r.problem ?? 'Product recommendation').slice(0, 120),
                subtitle: 'CRM recommendation pending',
                dueAt,
                dueLabel: formatDateTime(dueAt) ?? formatDateTime(r.created_at) ?? '—',
                isDueToday: isDueTodayIso(dueAt),
                farmerName,
                status: 'pending',
                statusLabel: 'Pending',
                canComplete: false,
                taskId: null,
                navigateTab: 'agronomist',
            });
        }
        for (const ix of interactionsPack.interactions ?? []) {
            if (ix.completionStatus !== 'pending')
                continue;
            const ixId = String(ix.id);
            if (seenInteractionIds.has(ixId))
                continue;
            seenInteractionIds.add(ixId);
            if (ix.taskId && crmTaskIds.has(String(ix.taskId)))
                continue;
            const dueAt = ix.nextActionAt ? String(ix.nextActionAt) : null;
            items.push({
                id: `ix-${ixId}`,
                itemType: 'interaction',
                category: 'Interaction',
                title: String(ix.summary ?? ix.typeCategory ?? ix.interactionType ?? 'Interaction').slice(0, 120),
                subtitle: String(ix.typeCategory ?? ix.interactionType ?? ''),
                dueAt,
                dueLabel: ix.dueLabel ?? formatDateTime(dueAt) ?? '—',
                isDueToday: Boolean(ix.isDueToday),
                farmerName,
                status: 'pending',
                statusLabel: String(ix.displayStatus ?? ix.status ?? 'Pending'),
                canComplete: Boolean(ix.taskId),
                taskId: ix.taskId ? String(ix.taskId) : null,
                navigateTab: 'interactions',
            });
        }
        items.sort((a, b) => dueSortKey(a.dueAt) - dueSortKey(b.dueAt));
        return items;
    },
    async listTasks(agentEmail, status = 'pending') {
        const { data, error } = await supabase
            .from('crm_tasks')
            .select('*, farmers(name, first_name, last_name, phone), leads(stage)')
            .or(`assigned_to.eq.${agentEmail},assigned_to.is.null`)
            .eq('status', status)
            .order('due_at', { ascending: true })
            .limit(100);
        throwIfSupabaseError(error, 'Could not load tasks');
        const now = new Date();
        const isDueToday = (iso) => {
            if (!iso)
                return false;
            const due = new Date(iso);
            return (due.getFullYear() === now.getFullYear() &&
                due.getMonth() === now.getMonth() &&
                due.getDate() === now.getDate());
        };
        return (data ?? []).map((t) => {
            const farmer = t.farmers;
            const name = farmer ? displayFarmerName(farmer) : 'Farmer';
            return {
                id: t.id,
                title: t.title,
                dueLabel: formatDateTime(t.due_at),
                isDueToday: isDueToday(t.due_at),
                status: t.status,
                farmerName: name,
                phone: farmer?.phone,
                leadId: t.lead_id,
                stage: t.leads?.stage,
            };
        });
    },
    async listCalls(agentEmail, limit = 50) {
        let q = supabase
            .from('crm_call_logs')
            .select('*, farmers(name, first_name, last_name, phone)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (agentEmail)
            q = q.eq('agent_email', agentEmail);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load calls');
        return (data ?? []).map((c) => {
            const farmer = c.farmers;
            return {
                id: c.id,
                farmerName: farmer ? displayFarmerName(farmer) : 'Farmer',
                phone: farmer?.phone,
                outcome: c.outcome,
                durationSeconds: c.duration_seconds,
                agentEmail: c.agent_email,
                atLabel: formatDateTime(c.created_at),
                notes: c.notes,
            };
        });
    },
    async listWhatsAppThreads(limit = 30) {
        const { data, error } = await supabase
            .from('interaction_logs')
            .select('farmer_id, channel, content, direction, created_at, farmers(name, first_name, last_name, phone)')
            .eq('channel', 'whatsapp')
            .order('created_at', { ascending: false })
            .limit(200);
        throwIfSupabaseError(error, 'Could not load WhatsApp threads');
        const byFarmer = new Map();
        for (const row of data ?? []) {
            const fid = String(row.farmer_id);
            if (!byFarmer.has(fid)) {
                const rawFarmer = row.farmers;
                const farmer = (Array.isArray(rawFarmer) ? rawFarmer[0] : rawFarmer);
                byFarmer.set(fid, {
                    farmerId: fid,
                    farmerName: farmer ? displayFarmerName(farmer) : 'Farmer',
                    phone: farmer?.phone,
                    lastMessage: String(row.content ?? '').slice(0, 120),
                    lastAt: formatDateTime(row.created_at),
                    direction: row.direction,
                });
            }
        }
        return [...byFarmer.values()].slice(0, limit);
    },
    async getWhatsAppMessages(farmerId) {
        const { data, error } = await supabase
            .from('interaction_logs')
            .select('id, channel, direction, content, message_type, created_at')
            .eq('farmer_id', farmerId)
            .eq('channel', 'whatsapp')
            .order('created_at', { ascending: true })
            .limit(100);
        throwIfSupabaseError(error, 'Could not load messages');
        return (data ?? []).map((m) => ({
            id: m.id,
            direction: m.direction,
            content: m.content,
            atLabel: formatDateTime(m.created_at),
            createdAt: m.created_at,
        }));
    },
    async sendWhatsAppMessage(farmerId, text, agentEmail) {
        const { data: farmer, error } = await supabase
            .from('farmers')
            .select('phone')
            .eq('id', farmerId)
            .single();
        if (error || !farmer?.phone)
            throw new NotFoundError('Farmer phone not found');
        const phone = String(farmer.phone).replace(/\D/g, '');
        const to = phone.length === 10 ? `91${phone}` : phone;
        let sent = false;
        let sendMode = 'session';
        try {
            const result = await whatsappService.sendToFarmer({
                phone: to,
                farmerId,
                text,
            });
            sendMode = result.mode;
            sent = true;
        }
        catch {
            /* CRM still logs outbound when WhatsApp provider is not configured */
        }
        await supabase.from('interaction_logs').insert({
            farmer_id: farmerId,
            channel: 'whatsapp',
            direction: 'outbound',
            message_type: sendMode === 'template' ? 'template' : 'text',
            content: text,
        });
        await logInteraction(farmerId, 'whatsapp', `${sent ? 'Sent' : 'Queued'} by ${agentEmail}: ${text.slice(0, 80)}`);
        return { messages: await this.getWhatsAppMessages(farmerId), sent };
    },
    async listFieldFindings(farmerId, page = 1, limit = 10) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const { data, error, count } = await supabase
            .from('crm_field_findings')
            .select('*, farm_blocks(name, crop_name)', { count: 'exact' })
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('visited_at', { ascending: false })
            .range(from, to);
        throwIfSupabaseError(error, 'Could not load field findings');
        const rows = data ?? [];
        const total = count ?? 0;
        const findings = rows.map((r) => this.mapFieldFinding(r));
        return {
            findings,
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    },
    mapFieldFinding(r) {
        const params = r.parameters ?? [];
        const photos = r.photo_urls ?? [];
        const block = r.farm_blocks;
        const blockName = String(r.block_name ?? block?.name ?? '—');
        const cropType = String(r.crop_type ?? block?.crop_name ?? '—');
        const diseaseTone = String(r.disease_tone ?? 'warning');
        const followUpAt = r.follow_up_at ? String(r.follow_up_at) : null;
        return {
            id: r.id,
            visitedAt: r.visited_at ? String(r.visited_at) : null,
            visitedLabel: formatDateTime(r.visited_at) ?? '—',
            blockId: r.block_id ? String(r.block_id) : null,
            blockName,
            cropType,
            agronomistName: r.agronomist_name,
            agronomistRole: r.agronomist_role ?? 'Agronomist',
            agronomistInitials: String(r.agronomist_name || 'A')
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase(),
            observations: r.observations ?? '',
            parameters: params,
            diseasePest: r.disease_pest ?? '—',
            diseaseTone,
            diseaseLabel: String(r.disease_pest ?? '—'),
            actionTaken: r.action_taken ?? '',
            followUpAt,
            followUpLabel: followUpAt ? formatDateTime(followUpAt) ?? '—' : '—',
            photoUrls: photos,
            photoCount: photos.length,
            extraPhotoCount: Math.max(0, photos.length - 2),
            findingType: r.finding_type ? String(r.finding_type) : null,
            severity: r.severity ? String(r.severity) : null,
            affectedAreaPct: r.affected_area_pct != null ? Number(r.affected_area_pct) : null,
            aiPrediction: r.ai_prediction ? String(r.ai_prediction) : null,
            finalConfirmedIssue: r.final_confirmed_issue ? String(r.final_confirmed_issue) : null,
            weatherContext: r.weather_context ?? {},
            weatherSnapshotId: r.weather_snapshot_id ? String(r.weather_snapshot_id) : null,
        };
    },
    async getFieldFinding(farmerId, findingId) {
        const { data, error } = await supabase
            .from('crm_field_findings')
            .select('*, farm_blocks(name, crop_name)')
            .eq('id', findingId)
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load field finding');
        if (!data)
            throw new NotFoundError('Field finding not found');
        return this.mapFieldFinding(data);
    },
    async createFieldFinding(farmerId, leadId, input) {
        const { weatherSnapshotService } = await import('../core/weather-snapshot.service.js');
        let weatherSnapshotId = null;
        let weatherContext = {};
        if (input.blockId || farmerId) {
            const captured = await weatherSnapshotService.capture({
                farmerId,
                blockId: input.blockId ?? null,
                eventType: 'field_finding',
            });
            if (captured) {
                weatherSnapshotId = captured.snapshotId;
                weatherContext = captured.context;
            }
        }
        const { data, error } = await supabase
            .from('crm_field_findings')
            .insert({
            farmer_id: farmerId,
            lead_id: leadId,
            block_id: input.blockId ?? null,
            block_name: input.blockName,
            crop_type: input.cropType,
            agronomist_name: input.agronomistName ?? 'Field Agronomist',
            agronomist_role: input.agronomistRole ?? 'Field Agronomist',
            observations: input.observations,
            disease_pest: input.diseasePest ?? input.finalConfirmedIssue ?? 'Pending review',
            disease_tone: input.diseaseTone ?? 'warning',
            action_taken: input.actionTaken,
            finding_type: input.findingType ?? null,
            severity: input.severity ?? null,
            affected_area_pct: input.affectedAreaPct ?? null,
            ai_prediction: input.aiPrediction ?? null,
            final_confirmed_issue: input.finalConfirmedIssue ?? null,
            weather_context: weatherContext,
            weather_snapshot_id: weatherSnapshotId,
            parameters: input.parameters && input.parameters.length > 0
                ? input.parameters
                : [{ label: 'Visit', value: 'Recorded from field PWA' }],
            follow_up_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            photo_urls: input.photoUrls ?? [],
        })
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not save field finding');
        if (weatherSnapshotId) {
            await supabase
                .from('weather_snapshots')
                .update({ event_id: data.id })
                .eq('id', weatherSnapshotId);
        }
        const photos = input.photoUrls ?? [];
        if (photos.length > 0) {
            const { cropImageReviewService } = await import('../core/crop-image-review.service.js');
            for (const url of photos) {
                if (!url?.trim())
                    continue;
                void cropImageReviewService.enqueue({
                    farmerId,
                    blockId: input.blockId ?? null,
                    fieldFindingId: String(data.id),
                    externalUrl: url.trim(),
                    source: 'field_visit',
                    crop: input.cropType,
                    symptoms: input.observations ? [input.observations.slice(0, 200)] : [],
                    aiPrediction: input.aiPrediction ?? input.diseasePest ?? null,
                });
            }
        }
        const { farmerEventCaptureService } = await import('../intelligence/farmer-event-capture.service.js');
        void farmerEventCaptureService.trackFieldFinding({
            farmerId,
            findingId: String(data.id),
            agentEmail: input.agentEmail ?? input.agronomistName ?? 'field',
        });
        return this.mapFieldFinding(data);
    },
    async updateFieldFinding(id, patch) {
        const allowed = [
            'observations',
            'disease_pest',
            'disease_tone',
            'action_taken',
            'follow_up_at',
            'parameters',
            'finding_type',
            'severity',
            'affected_area_pct',
            'ai_prediction',
            'final_confirmed_issue',
        ];
        const updates = {};
        for (const k of allowed) {
            if (patch[k] !== undefined)
                updates[k] = patch[k];
        }
        const { data, error } = await supabase
            .from('crm_field_findings')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        throwIfSupabaseError(error, 'Could not update field finding');
        return this.mapFieldFinding(data);
    },
    async getNavBadges() {
        const [tasksRes, escRes] = await Promise.all([
            supabase
                .from('crm_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending'),
            supabase
                .from('agronomist_escalations')
                .select('id', { count: 'exact', head: true })
                .in('status', ['pending', 'assigned', 'in_review']),
        ]);
        return {
            followUpTasks: tasksRes.count ?? 0,
            pendingEscalations: escRes.count ?? 0,
        };
    },
};
//# sourceMappingURL=telecaller-admin.service.js.map