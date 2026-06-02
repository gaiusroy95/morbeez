import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { telecallerAdminService, } from './telecaller-admin.service.js';
import { fetchOpportunityScoresByFarmerIds, fetchRetentionByFarmerIds, } from '../intelligence/intelligence-farmer-score-queries.util.js';
const PRIORITY_META = {
    escalated: { rank: 1, label: 'Escalated', color: 'red' },
    overdue: { rank: 2, label: 'Overdue', color: 'orange' },
    due_today: { rank: 3, label: 'Due Today', color: 'yellow' },
    follow_up: { rank: 4, label: 'Follow-up', color: 'yellow' },
    hot_lead: { rank: 5, label: 'Hot Lead', color: 'green' },
    high_opportunity: { rank: 6, label: 'High Opportunity', color: 'green' },
    new_lead: { rank: 7, label: 'New Lead', color: 'gray' },
    inactive: { rank: 8, label: 'Inactive', color: 'gray' },
};
const OPEN_ESCALATION_STATUSES = ['pending', 'assigned', 'in_review'];
function formatDateLabel(iso) {
    if (!iso)
        return '—';
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
function isDueToday(iso) {
    if (!iso)
        return false;
    const d = new Date(iso);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function isOverdueIso(iso) {
    if (!iso)
        return false;
    return new Date(iso).getTime() < Date.now() && !isDueToday(iso);
}
function daysAfterPlanting(date) {
    if (!date)
        return null;
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    return diff >= 0 ? diff : null;
}
function computePriority(input) {
    if (input.escalationCount > 0)
        return 'escalated';
    if (input.hasOverdueTask || isOverdueIso(input.followUpAt))
        return 'overdue';
    if (input.hasDueTodayTask || isDueToday(input.followUpAt))
        return 'due_today';
    if (input.stage === 'follow_up' || input.followUpAt)
        return 'follow_up';
    if ((input.opportunityScore ?? 0) >= 70 || input.stage === 'interested')
        return 'hot_lead';
    if ((input.opportunityScore ?? 0) >= 50)
        return 'high_opportunity';
    if (input.stage === 'new_lead')
        return 'new_lead';
    const last = input.lastInteractionAt ? new Date(input.lastInteractionAt).getTime() : 0;
    const inactiveDays = 30 * 86400000;
    if (!last || Date.now() - last > inactiveDays)
        return 'inactive';
    return 'new_lead';
}
async function loadFarmerMetrics(farmerIds) {
    const ids = [...new Set(farmerIds.filter(Boolean))];
    const pendingByFarmer = new Map();
    const escalationByFarmer = new Map();
    const cropByFarmer = new Map();
    const pincodeByFarmer = new Map();
    const languageByFarmer = new Map();
    if (!ids.length) {
        return {
            pendingByFarmer,
            escalationByFarmer,
            cropByFarmer,
            pincodeByFarmer,
            languageByFarmer,
            opportunityScores: new Map(),
            relationshipScores: new Map(),
            retentionByFarmer: new Map(),
        };
    }
    const chunk = 150;
    for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const [tasksRes, escRes, blocksRes, farmersRes] = await Promise.all([
            supabase
                .from('crm_tasks')
                .select('farmer_id, due_at, status')
                .in('farmer_id', slice)
                .eq('status', 'pending'),
            supabase
                .from('agronomist_escalations')
                .select('farmer_id, status')
                .in('farmer_id', slice)
                .in('status', OPEN_ESCALATION_STATUSES),
            supabase
                .from('farm_blocks')
                .select('farmer_id, crop_type, acreage_decimal, planting_date, is_primary')
                .in('farmer_id', slice)
                .is('archived_at', null),
            supabase
                .from('farmers')
                .select('id, preferred_language, pincode_id, pincode_master(pincode)')
                .in('id', slice),
        ]);
        throwIfSupabaseError(tasksRes.error, 'Could not load pending tasks');
        throwIfSupabaseError(escRes.error, 'Could not load escalations');
        throwIfSupabaseError(blocksRes.error, 'Could not load crop blocks');
        throwIfSupabaseError(farmersRes.error, 'Could not load farmers');
        for (const t of tasksRes.data ?? []) {
            const fid = String(t.farmer_id);
            const cur = pendingByFarmer.get(fid) ?? { count: 0, overdue: false, dueToday: false };
            cur.count += 1;
            const due = t.due_at;
            if (isOverdueIso(due))
                cur.overdue = true;
            if (isDueToday(due))
                cur.dueToday = true;
            pendingByFarmer.set(fid, cur);
        }
        for (const e of escRes.data ?? []) {
            const fid = String(e.farmer_id);
            escalationByFarmer.set(fid, (escalationByFarmer.get(fid) ?? 0) + 1);
        }
        for (const b of blocksRes.data ?? []) {
            const fid = String(b.farmer_id);
            if (cropByFarmer.has(fid) && !b.is_primary)
                continue;
            const crop = String(b.crop_type ?? '').replace(/_/g, ' ').trim();
            cropByFarmer.set(fid, {
                crop: crop || '—',
                acreage: b.acreage_decimal != null ? Number(b.acreage_decimal) : null,
                dap: daysAfterPlanting(b.planting_date),
            });
        }
        for (const f of farmersRes.data ?? []) {
            const fid = String(f.id);
            languageByFarmer.set(fid, String(f.preferred_language ?? 'en'));
            const pm = f.pincode_master;
            if (pm?.pincode)
                pincodeByFarmer.set(fid, String(pm.pincode));
        }
    }
    const [opportunityScores, retentionByFarmer] = await Promise.all([
        fetchOpportunityScoresByFarmerIds(ids),
        fetchRetentionByFarmerIds(ids),
    ]);
    const relationshipScores = new Map();
    for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const { data, error } = await supabase
            .from('farmer_scores')
            .select('farmer_id, relationship_score, opportunity_score')
            .in('farmer_id', slice);
        throwIfSupabaseError(error, 'Could not load farmer scores');
        for (const row of data ?? []) {
            const fid = String(row.farmer_id);
            if (row.relationship_score != null) {
                relationshipScores.set(fid, Number(row.relationship_score));
            }
            if (row.opportunity_score != null && !opportunityScores.has(fid)) {
                opportunityScores.set(fid, Number(row.opportunity_score));
            }
        }
    }
    return {
        pendingByFarmer,
        escalationByFarmer,
        cropByFarmer,
        pincodeByFarmer,
        languageByFarmer,
        opportunityScores,
        relationshipScores,
        retentionByFarmer,
    };
}
function matchesSmartFilter(row, filter) {
    switch (filter) {
        case 'pending':
            return row.hasPendingTasks;
        case 'escalated':
            return row.escalationCount > 0;
        case 'overdue':
            return row.isOverdue;
        case 'due_today':
            return row.isDueToday;
        case 'hot_leads':
            return (row.opportunityScore ?? 0) >= 70;
        case 'high_acreage':
            return (row.acreage ?? 0) >= 5;
        case 'no_engagement':
            return row.priorityBand === 'inactive';
        default:
            return true;
    }
}
function sortRows(rows, sort) {
    const copy = [...rows];
    copy.sort((a, b) => {
        if (sort === 'priority') {
            if (a.priorityRank !== b.priorityRank)
                return a.priorityRank - b.priorityRank;
            return (b.pendingTasksCount ?? 0) - (a.pendingTasksCount ?? 0);
        }
        const num = (key, dir = 'desc') => {
            const av = a[key];
            const bv = b[key];
            const an = typeof av === 'number' ? av : 0;
            const bn = typeof bv === 'number' ? bv : 0;
            return dir === 'desc' ? bn - an : an - bn;
        };
        switch (sort) {
            case 'pending_tasks':
                return num('pendingTasksCount');
            case 'escalations':
                return num('escalationCount');
            case 'opportunity_score':
                return num('opportunityScore');
            case 'relationship_score':
                return num('relationshipScore');
            case 'acreage':
                return num('acreage');
            case 'follow_up_due': {
                const at = a.followUpDueAt ? new Date(a.followUpDueAt).getTime() : Number.MAX_SAFE_INTEGER;
                const bt = b.followUpDueAt ? new Date(b.followUpDueAt).getTime() : Number.MAX_SAFE_INTEGER;
                return at - bt;
            }
            case 'recent_interaction': {
                const at = a.lastInteractionAt ? new Date(String(a.lastInteractionAt)).getTime() : 0;
                const bt = b.lastInteractionAt ? new Date(String(b.lastInteractionAt)).getTime() : 0;
                return bt - at;
            }
            case 'recently_added': {
                const at = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
                const bt = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
                return bt - at;
            }
            default:
                return a.priorityRank - b.priorityRank;
        }
    });
    return copy;
}
export const telecallerLeadQueueService = {
    priorityMeta: PRIORITY_META,
    async listOperationalLeads(query, agentEmail) {
        const base = await telecallerAdminService.listLeads({
            ...query,
            page: 1,
            limit: Math.min(200, Math.max(1, query.limit ?? 120)),
        }, agentEmail);
        const farmerIds = base.leads.map((l) => String(l.farmerId));
        const metrics = await loadFarmerMetrics(farmerIds);
        let rows = base.leads.map((lead) => {
            const fid = String(lead.farmerId);
            const pending = metrics.pendingByFarmer.get(fid) ?? { count: 0, overdue: false, dueToday: false };
            const escalationCount = metrics.escalationByFarmer.get(fid) ?? 0;
            const cropInfo = metrics.cropByFarmer.get(fid);
            const opportunityScore = metrics.opportunityScores.get(fid) ?? lead.opportunityScore ?? null;
            const relationshipScore = metrics.relationshipScores.get(fid) ?? null;
            const retention = metrics.retentionByFarmer.get(fid);
            const followUpDueAt = lead.followUpAt ?? null;
            const priorityBand = computePriority({
                escalationCount,
                pendingTasksCount: pending.count,
                hasOverdueTask: pending.overdue,
                hasDueTodayTask: pending.dueToday,
                stage: lead.stage,
                followUpAt: followUpDueAt,
                opportunityScore,
                lastInteractionAt: lead.lastInteractionAt ?? null,
            });
            const meta = PRIORITY_META[priorityBand];
            return {
                ...lead,
                pendingTasksCount: pending.count,
                escalationCount,
                priorityBand,
                priorityRank: meta.rank,
                priorityLabel: meta.label,
                cropSummary: cropInfo?.crop ?? null,
                acreage: cropInfo?.acreage ?? null,
                owner: lead.assignedTo ?? null,
                pincode: metrics.pincodeByFarmer.get(fid) ?? null,
                language: metrics.languageByFarmer.get(fid) ?? null,
                relationshipScore,
                opportunityScore,
                followUpDueAt,
                isOverdue: pending.overdue || isOverdueIso(followUpDueAt),
                isDueToday: pending.dueToday || isDueToday(followUpDueAt),
                hasPendingTasks: pending.count > 0,
                dap: cropInfo?.dap ?? null,
                healthStatus: retention?.riskBand ?? null,
                createdAtLabel: formatDateLabel(lead.createdAt),
            };
        });
        if (query.pendingTasks) {
            rows = rows.filter((r) => r.hasPendingTasks);
        }
        if (query.escalations) {
            rows = rows.filter((r) => r.escalationCount > 0);
        }
        if (query.district?.trim()) {
            const d = query.district.trim().toLowerCase();
            rows = rows.filter((r) => String(r.district ?? '').toLowerCase().includes(d));
        }
        if (query.pincode?.trim()) {
            const p = query.pincode.trim();
            rows = rows.filter((r) => String(r.pincode ?? '').includes(p));
        }
        if (query.language?.trim()) {
            const lang = query.language.trim().toLowerCase();
            rows = rows.filter((r) => String(r.language ?? '').toLowerCase() === lang);
        }
        if (query.crop?.trim()) {
            const c = query.crop.trim().toLowerCase();
            rows = rows.filter((r) => String(r.cropSummary ?? '').toLowerCase().includes(c));
        }
        if (query.owner?.trim()) {
            const o = query.owner.trim().toLowerCase();
            rows = rows.filter((r) => String(r.owner ?? '').toLowerCase().includes(o));
        }
        if (query.opportunityLevel) {
            rows = rows.filter((r) => {
                const score = r.opportunityScore ?? 0;
                if (query.opportunityLevel === 'high')
                    return score >= 70;
                if (query.opportunityLevel === 'medium')
                    return score >= 40 && score < 70;
                return score < 40;
            });
        }
        if (query.smartFilter && query.smartFilter !== 'all') {
            rows = rows.filter((r) => matchesSmartFilter(r, query.smartFilter));
        }
        rows = sortRows(rows, query.sort ?? 'priority');
        return {
            leads: rows,
            counts: base.counts,
            pagination: {
                ...base.pagination,
                total: rows.length,
            },
            priorityMeta: PRIORITY_META,
        };
    },
    async getQueueSummary(agentEmail, scope = 'mine') {
        const { leads } = await this.listOperationalLeads({ scope, limit: 200, smartFilter: 'all', sort: 'priority' }, agentEmail);
        return {
            pendingTasks: leads.filter((l) => l.hasPendingTasks).length,
            escalations: leads.filter((l) => l.escalationCount > 0).length,
            dueToday: leads.filter((l) => l.isDueToday).length,
            hotLeads: leads.filter((l) => l.priorityBand === 'hot_lead').length,
            highOpportunity: leads.filter((l) => l.priorityBand === 'high_opportunity').length,
            atRisk: leads.filter((l) => l.healthStatus === 'at_risk' || l.healthStatus === 'churned').length,
            overdue: leads.filter((l) => l.isOverdue).length,
        };
    },
    async listAssignableTeam() {
        const roles = ['telecaller', 'manager', 'operations', 'admin', 'super_admin', 'agronomist'];
        const { data, error } = await supabase
            .from('admin_users')
            .select('email, full_name, role')
            .eq('active', true)
            .in('role', roles)
            .order('full_name');
        throwIfSupabaseError(error, 'Could not load team');
        return (data ?? []).map((u) => ({
            email: String(u.email),
            fullName: u.full_name ? String(u.full_name) : String(u.email),
            role: String(u.role),
        }));
    },
    leadsToCsv(rows) {
        const headers = [
            'Farmer Name',
            'Phone',
            'District',
            'Pincode',
            'Language',
            'Crop',
            'Acreage',
            'Stage',
            'Owner',
            'Priority',
            'Pending Tasks',
            'Escalations',
            'Opportunity Score',
            'Relationship Score',
            'Last Interaction',
            'Follow-up Due',
        ];
        const escape = (v) => {
            const s = v == null ? '' : String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };
        const lines = [
            headers.join(','),
            ...rows.map((r) => {
                const cells = [
                    r.farmerName,
                    r.phone != null ? String(r.phone) : null,
                    r.district != null ? String(r.district) : null,
                    r.pincode,
                    r.language,
                    r.cropSummary,
                    r.acreage,
                    r.stageLabel,
                    r.owner,
                    r.priorityLabel,
                    r.pendingTasksCount,
                    r.escalationCount,
                    r.opportunityScore,
                    r.relationshipScore,
                    r.lastInteractionLabel,
                    r.followUpLabel ?? r.followUpDueAt,
                ];
                return cells.map(escape).join(',');
            }),
        ];
        return lines.join('\n');
    },
    async exportLeads(query, agentEmail, leadIds) {
        const { leads } = await this.listOperationalLeads(query, agentEmail);
        const idSet = leadIds?.length ? new Set(leadIds) : null;
        const rows = idSet ? leads.filter((l) => idSet.has(String(l.id))) : leads;
        return { csv: this.leadsToCsv(rows), count: rows.length };
    },
    async bulkUpdateLeads(leadIds, action, payload, agentEmail) {
        if (!leadIds.length)
            return { updated: 0 };
        if (action === 'delete') {
            const { error } = await supabase.from('leads').delete().in('id', leadIds);
            throwIfSupabaseError(error, 'Could not delete leads');
            return { updated: leadIds.length };
        }
        const ownerEmail = payload.owner?.trim().toLowerCase();
        if ((action === 'change_owner' || action === 'assign_employee') && ownerEmail) {
            const { error } = await supabase
                .from('leads')
                .update({ assigned_to: ownerEmail, updated_at: new Date().toISOString() })
                .in('id', leadIds);
            throwIfSupabaseError(error, 'Could not assign owner');
            return { updated: leadIds.length };
        }
        if (action === 'change_stage' && payload.stage) {
            for (const id of leadIds) {
                await telecallerAdminService.updateLead(id, { stage: payload.stage }, agentEmail);
            }
            return { updated: leadIds.length };
        }
        if (action === 'add_broadcast_tag' && payload.broadcastTag?.trim()) {
            const tag = payload.broadcastTag.trim().toLowerCase();
            const { data: leadRows, error: leadErr } = await supabase
                .from('leads')
                .select('farmer_id')
                .in('id', leadIds);
            throwIfSupabaseError(leadErr, 'Could not load leads for tagging');
            const farmerIds = [
                ...new Set((leadRows ?? [])
                    .map((r) => (r.farmer_id != null ? String(r.farmer_id) : ''))
                    .filter((id) => id.length > 0)),
            ];
            if (!farmerIds.length)
                return { updated: 0 };
            const { data: farmers, error: farmErr } = await supabase
                .from('farmers')
                .select('id, metadata')
                .in('id', farmerIds);
            throwIfSupabaseError(farmErr, 'Could not load farmers for tagging');
            let updated = 0;
            for (const f of farmers ?? []) {
                const meta = f.metadata && typeof f.metadata === 'object'
                    ? f.metadata
                    : {};
                const existing = Array.isArray(meta.broadcast_tags)
                    ? meta.broadcast_tags
                    : [];
                if (existing.includes(tag))
                    continue;
                const nextTags = [...existing, tag];
                const { error } = await supabase
                    .from('farmers')
                    .update({
                    metadata: { ...meta, broadcast_tags: nextTags },
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', f.id);
                throwIfSupabaseError(error, 'Could not add broadcast tag');
                updated += 1;
            }
            return { updated };
        }
        return { updated: 0 };
    },
};
//# sourceMappingURL=telecaller-lead-queue.service.js.map