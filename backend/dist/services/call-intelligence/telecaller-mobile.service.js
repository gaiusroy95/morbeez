import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { telecallerAdminService } from '../admin/telecaller-admin.service.js';
import { telecallerLeadQueueService } from '../admin/telecaller-lead-queue.service.js';
import { telecallerFarmerProfileService } from '../admin/telecaller-farmer-profile.service.js';
import { opportunityIntelligenceDashboardService } from '../intelligence/opportunity-intelligence-dashboard.service.js';
import { callQcService } from './call-qc.service.js';
import { marketingPerformanceService, dateRangeFromDays } from '../admin/marketing-performance.service.js';
import { blockService } from '../core/block.service.js';
import { farmerOwnershipService } from '../partner/farmer-ownership.service.js';
const MONTHLY_TARGET_DEFAULT = 500_000;
function displayFarmerName(farmer) {
    const first = String(farmer.first_name ?? '').trim();
    const last = String(farmer.last_name ?? '').trim();
    const combined = [first, last].filter(Boolean).join(' ');
    if (combined)
        return combined;
    return String(farmer.name ?? 'Farmer').trim() || 'Farmer';
}
function formatDateTime(iso) {
    if (!iso)
        return undefined;
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
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
    const due = new Date(iso);
    const now = new Date();
    return (due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate());
}
function isOverdue(iso) {
    if (!iso)
        return false;
    const due = new Date(iso);
    return due.getTime() < Date.now() && !isDueToday(iso);
}
function categorizeTask(row) {
    const taskType = String(row.task_type ?? '').toLowerCase();
    const title = String(row.title ?? '').toLowerCase();
    if (taskType.includes('recommendation') || title.includes('recommendation'))
        return 'recommendationReviews';
    if (taskType.includes('visit') || title.includes('visit'))
        return 'visitFollowUps';
    if (taskType.includes('order') || title.includes('order'))
        return 'orderFollowUps';
    return 'general';
}
function mapTaskRow(t) {
    const farmer = t.farmers;
    const dueAt = t.due_at ? String(t.due_at) : null;
    return {
        id: String(t.id),
        title: String(t.title ?? 'Task'),
        dueLabel: formatDateTime(dueAt),
        isDueToday: isDueToday(dueAt),
        status: String(t.status ?? 'pending'),
        farmerName: farmer ? displayFarmerName(farmer) : 'Farmer',
        leadId: t.lead_id ? String(t.lead_id) : undefined,
        dueAt,
        taskType: t.task_type ? String(t.task_type) : undefined,
        category: categorizeTask(t),
    };
}
function mapOperationalLead(row) {
    return {
        id: String(row.id),
        farmerId: String(row.farmerId),
        farmerName: String(row.farmerName ?? 'Farmer'),
        phone: row.phone ? String(row.phone) : null,
        district: row.district ? String(row.district) : null,
        village: row.village
            ? String(row.village)
            : null,
        stageLabel: String(row.stageLabel ?? row.stage ?? ''),
        stage: String(row.stage ?? ''),
        primaryCrop: row.cropSummary ? String(row.cropSummary) : null,
        healthStatus: row.healthStatus ? String(row.healthStatus) : null,
        openTaskCount: row.pendingTasksCount ?? 0,
        pendingTasksCount: row.pendingTasksCount ?? 0,
        escalationCount: row.escalationCount ?? 0,
        opportunityScore: row.opportunityScore ?? null,
        priorityLabel: row.priorityLabel ? String(row.priorityLabel) : undefined,
        lastInteractionLabel: row.lastInteractionLabel ? String(row.lastInteractionLabel) : null,
        followUpLabel: row.followUpDueAt ? formatDateTime(row.followUpDueAt) : null,
        isOverdue: row.isOverdue ?? false,
        isDueToday: row.isDueToday ?? false,
        acreage: row.acreage ?? null,
    };
}
export const telecallerMobileService = {
    async getDashboard(agentEmail) {
        const [overview, qc, queueHealth, actionQueue, todaysTasks, escalations] = await Promise.all([
            telecallerAdminService.getOverview(agentEmail),
            callQcService.getOverview(7, agentEmail),
            marketingPerformanceService
                .getOverview(dateRangeFromDays(7))
                .then((r) => r.queueHealth)
                .catch(() => null),
            this.buildActionQueue(agentEmail),
            this.listTodaysTasks(agentEmail),
            this.countOpenEscalations(agentEmail),
        ]);
        return {
            overview: {
                ...overview,
                monthlyTarget: MONTHLY_TARGET_DEFAULT,
                openEscalations: escalations,
            },
            qc,
            queueHealth,
            actionQueue,
            todaysTasks,
            escalations,
        };
    },
    async listLeads(agentEmail, query) {
        const result = await telecallerAdminService.listLeads({
            scope: query.scope ?? 'mine',
            page: 1,
            limit: query.limit ?? 40,
        }, agentEmail);
        return result.leads;
    },
    async listOperationalLeads(agentEmail, query) {
        const result = await telecallerLeadQueueService.listOperationalLeads({
            scope: query.scope === 'all' ? 'all' : 'mine',
            search: query.search,
            smartFilter: query.smartFilter,
            sort: query.sort ?? 'priority',
            limit: query.limit ?? 50,
        }, agentEmail);
        return result.leads.map(mapOperationalLead);
    },
    async getQueueSummary(agentEmail, scope = 'mine') {
        return telecallerLeadQueueService.getQueueSummary(agentEmail, scope);
    },
    async listFollowUps(agentEmail, status = 'pending') {
        return telecallerAdminService.listTasks(agentEmail, status);
    },
    async listFollowUpSections(agentEmail) {
        const { data, error } = await supabase
            .from('crm_tasks')
            .select('*, farmers(name, first_name, last_name, phone), leads(stage)')
            .or(`assigned_to.eq.${agentEmail},assigned_to.is.null`)
            .eq('status', 'pending')
            .order('due_at', { ascending: true })
            .limit(200);
        throwIfSupabaseError(error, 'Could not load follow-ups');
        const rows = (data ?? []).map(mapTaskRow);
        const sections = {
            today: [],
            overdue: [],
            upcoming: [],
            recommendationReviews: [],
            visitFollowUps: [],
            orderFollowUps: [],
            general: [],
        };
        for (const task of rows) {
            if (task.isDueToday)
                sections.today.push(task);
            else if (task.dueAt && isOverdue(task.dueAt))
                sections.overdue.push(task);
            else
                sections.upcoming.push(task);
            const cat = task.category ?? 'general';
            if (cat === 'recommendationReviews')
                sections.recommendationReviews.push(task);
            else if (cat === 'visitFollowUps')
                sections.visitFollowUps.push(task);
            else if (cat === 'orderFollowUps')
                sections.orderFollowUps.push(task);
            else
                sections.general.push(task);
        }
        return sections;
    },
    async listTodaysTasks(agentEmail) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const { data, error } = await supabase
            .from('crm_tasks')
            .select('*, farmers(name, first_name, last_name, phone)')
            .or(`assigned_to.eq.${agentEmail},assigned_to.is.null`)
            .eq('status', 'pending')
            .gte('due_at', todayStart.toISOString())
            .lt('due_at', tomorrowStart.toISOString())
            .order('due_at', { ascending: true })
            .limit(20);
        throwIfSupabaseError(error, 'Could not load today tasks');
        return (data ?? []).map(mapTaskRow);
    },
    async countOpenEscalations(agentEmail) {
        const { count, error } = await supabase
            .from('agronomist_escalations')
            .select('id', { count: 'exact', head: true })
            .in('status', ['pending', 'assigned', 'in_review']);
        throwIfSupabaseError(error, 'Could not load escalations');
        void agentEmail;
        return count ?? 0;
    },
    async buildActionQueue(agentEmail) {
        const [overdue, dueToday, hot, escalated] = await Promise.all([
            telecallerLeadQueueService.listOperationalLeads({ scope: 'mine', smartFilter: 'overdue', limit: 3 }, agentEmail),
            telecallerLeadQueueService.listOperationalLeads({ scope: 'mine', smartFilter: 'due_today', limit: 3 }, agentEmail),
            telecallerLeadQueueService.listOperationalLeads({ scope: 'mine', smartFilter: 'hot_leads', limit: 3 }, agentEmail),
            telecallerLeadQueueService.listOperationalLeads({ scope: 'mine', smartFilter: 'escalated', limit: 3 }, agentEmail),
        ]);
        const items = [];
        if (overdue.leads.length) {
            const lead = overdue.leads[0];
            items.push({
                id: 'overdue',
                category: 'overdue',
                label: 'Overdue follow-ups',
                count: overdue.leads.length,
                leadId: String(lead.id),
                farmerName: String(lead.farmerName ?? 'Farmer'),
            });
        }
        if (dueToday.leads.length) {
            const lead = dueToday.leads[0];
            items.push({
                id: 'due_today',
                category: 'due_today',
                label: 'Due today',
                count: dueToday.leads.length,
                leadId: String(lead.id),
                farmerName: String(lead.farmerName ?? 'Farmer'),
            });
        }
        if (hot.leads.length) {
            const lead = hot.leads[0];
            items.push({
                id: 'hot_leads',
                category: 'hot_leads',
                label: 'High opportunity farmers',
                count: hot.leads.length,
                leadId: String(lead.id),
                farmerName: String(lead.farmerName ?? 'Farmer'),
            });
        }
        if (escalated.leads.length) {
            const lead = escalated.leads[0];
            items.push({
                id: 'escalated',
                category: 'escalated',
                label: 'Open escalations',
                count: escalated.leads.length,
                leadId: String(lead.id),
                farmerName: String(lead.farmerName ?? 'Farmer'),
            });
        }
        try {
            const { salesOpportunityService } = await import('../partner/sales-opportunity.service.js');
            const opps = await salesOpportunityService.listForTelecaller(agentEmail);
            if (opps.length) {
                const opp = opps[0];
                const farmers = opp.farmers;
                const farmerName = farmers?.name ??
                    [farmers?.first_name, farmers?.last_name].filter(Boolean).join(' ') ??
                    'Farmer';
                items.push({
                    id: 'sales_opportunities',
                    category: 'sales_opportunity',
                    label: 'Sales opportunities',
                    count: opps.length,
                    leadId: opp.lead_id ? String(opp.lead_id) : undefined,
                    farmerName: String(farmerName),
                });
            }
        }
        catch {
            /* sales_opportunities table may not exist yet */
        }
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: partnerVisits } = await supabase
            .from('crm_field_findings')
            .select('id, farmer_id, visited_at, farmers(name, first_name, last_name)')
            .not('partner_id', 'is', null)
            .gte('visited_at', weekAgo)
            .order('visited_at', { ascending: false })
            .limit(5);
        if (partnerVisits?.length) {
            const v = partnerVisits[0];
            const f = v.farmers;
            const farmerName = f?.name ?? [f?.first_name, f?.last_name].filter(Boolean).join(' ') ?? 'Farmer';
            const { data: leadRow } = await supabase
                .from('leads')
                .select('id')
                .eq('farmer_id', String(v.farmer_id))
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            items.push({
                id: 'partner_visits',
                category: 'partner_visit',
                label: 'Recent partner visits',
                count: partnerVisits.length,
                leadId: leadRow?.id ? String(leadRow.id) : undefined,
                farmerName: String(farmerName),
            });
        }
        return items;
    },
    async getWorkspaceSummary(leadId) {
        const detail = await telecallerAdminService.getLeadDetail(leadId);
        const farmerId = String(detail.lead.farmerId);
        const farmerRow = detail.farmer;
        const [profile, intelligence, blocks, lastVisitRes, openRecsRes, lastOrderRes, ownership] = await Promise.all([
            telecallerFarmerProfileService.getProfile(farmerId).catch(() => null),
            opportunityIntelligenceDashboardService.getFarmerProfile(farmerId).catch(() => null),
            blockService.listByFarmer(farmerId).catch(() => []),
            supabase
                .from('crm_field_findings')
                .select('visited_at')
                .eq('farmer_id', farmerId)
                .is('archived_at', null)
                .order('visited_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('crm_recommendations')
                .select('id', { count: 'exact', head: true })
                .eq('farmer_id', farmerId)
                .in('status', ['open', 'monitoring', 'pending']),
            supabase
                .from('commerce_orders')
                .select('created_at')
                .eq('farmer_id', farmerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            farmerOwnershipService.getOwnership(farmerId),
        ]);
        let partnerName = null;
        if (ownership?.assignedPartnerId) {
            const { data: partnerRow } = await supabase
                .from('partners')
                .select('full_name')
                .eq('id', ownership.assignedPartnerId)
                .maybeSingle();
            partnerName = partnerRow?.full_name ? String(partnerRow.full_name) : null;
        }
        const name = displayFarmerName(farmerRow);
        const acreage = blocks.reduce((s, b) => s + (b.acreage_decimal ?? 0), 0) ||
            Number(farmerRow.total_acreage ?? 0) ||
            null;
        const { count: openEscalations } = await supabase
            .from('agronomist_escalations')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', farmerId)
            .in('status', ['pending', 'assigned', 'in_review']);
        const pendingTasks = (detail.tasks ?? []).filter((t) => ['pending', 'open', 'in_progress'].includes(String(t.status ?? ''))).length;
        const profileData = profile;
        const intel = intelligence;
        return {
            leadId,
            farmerId,
            farmer: {
                id: farmerId,
                name,
                phone: farmerRow.phone ? String(farmerRow.phone) : null,
                district: farmerRow.district ? String(farmerRow.district) : null,
                village: farmerRow.village ? String(farmerRow.village) : null,
                language: farmerRow.preferred_language ? String(farmerRow.preferred_language) : null,
                acreage,
            },
            lead: {
                stage: String(detail.lead.stage ?? ''),
                stageLabel: telecallerAdminService.stageLabels[String(detail.lead.stage ?? '')] ?? String(detail.lead.stage ?? ''),
                assignedTelecaller: detail.lead.assignedTo ? String(detail.lead.assignedTo) : null,
                assignedAgronomist: farmerRow.assigned_crop_advisor ? String(farmerRow.assigned_crop_advisor) : null,
                leadSource: detail.lead.leadChannel ? String(detail.lead.leadChannel) : null,
                campaign: detail.lead.campaignSource ? String(detail.lead.campaignSource) : null,
                tags: [],
                customerSince: farmerRow.created_at ? String(farmerRow.created_at) : null,
                ownership: ownership?.customerOwnerType
                    ? `${ownership.customerOwnerType}${ownership.customerOwnerPartnerId ? ' (partner)' : ''}`
                    : null,
                serviceModel: ownership?.serviceModel ?? null,
                assignedPartnerId: ownership?.assignedPartnerId ?? null,
                assignedPartnerName: partnerName,
                enrollmentSource: ownership?.enrollmentSource ?? null,
            },
            ownership,
            intelligence: {
                opportunityScore: intel?.opportunityScore != null ? Number(intel.opportunityScore) : null,
                relationshipScore: intel?.relationshipScore != null ? Number(intel.relationshipScore) : null,
                revenueGenerated: intel?.lifetimeRevenue != null ? Number(intel.lifetimeRevenue) : null,
            },
            healthStatus: (openEscalations ?? 0) > 0 ? 'alert' : 'stable',
            activeCrops: [...new Set(blocks.map((b) => b.crop_type).filter(Boolean))],
            dap: blocks[0]?.dap ?? null,
            lastVisitAt: lastVisitRes.data?.visited_at ? String(lastVisitRes.data.visited_at) : null,
            lastInteractionAt: detail.lead.lastInteractionAt ? String(detail.lead.lastInteractionAt) : null,
            pendingTaskCount: pendingTasks,
            openEscalationCount: openEscalations ?? 0,
            openRecommendationsCount: openRecsRes.count ?? 0,
            lastOrderAt: lastOrderRes.data?.created_at ? String(lastOrderRes.data.created_at) : null,
            blockCount: blocks.length,
            profile: profileData,
        };
    },
    async listNotifications(agentEmail) {
        const notifications = [];
        const [tasksRes, escalationsRes, ordersRes, partnerTasksRes] = await Promise.all([
            supabase
                .from('crm_tasks')
                .select('id, title, due_at, lead_id, farmers(name, first_name, last_name)')
                .or(`assigned_to.eq.${agentEmail},assigned_to.is.null`)
                .eq('status', 'pending')
                .order('due_at', { ascending: true })
                .limit(30),
            supabase
                .from('agronomist_escalations')
                .select('id, title, created_at, farmer_id, farmers(name, first_name, last_name)')
                .in('status', ['pending', 'assigned', 'in_review'])
                .order('created_at', { ascending: false })
                .limit(15),
            supabase
                .from('commerce_orders')
                .select('id, order_name, status, updated_at, farmer_id')
                .order('updated_at', { ascending: false })
                .limit(15),
            supabase
                .from('crm_tasks')
                .select('id, title, updated_at, lead_id, farmer_id, status')
                .not('assigned_partner_id', 'is', null)
                .eq('status', 'completed')
                .gte('updated_at', new Date(Date.now() - 7 * 86400000).toISOString())
                .order('updated_at', { ascending: false })
                .limit(10),
        ]);
        let oppsRes = {
            data: [],
            error: null,
        };
        try {
            oppsRes = await supabase
                .from('sales_opportunities')
                .select('id, product, status, created_at, lead_id, farmer_id')
                .eq('assigned_telecaller_email', agentEmail)
                .in('status', ['interested', 'hot_lead', 'ready_to_order', 'follow_up_required'])
                .order('created_at', { ascending: false })
                .limit(15);
        }
        catch {
            oppsRes = { data: [], error: null };
        }
        throwIfSupabaseError(tasksRes.error, 'Could not load task notifications');
        throwIfSupabaseError(escalationsRes.error, 'Could not load escalation notifications');
        for (const t of tasksRes.data ?? []) {
            const dueAt = t.due_at ? String(t.due_at) : new Date().toISOString();
            notifications.push({
                id: `task-${t.id}`,
                category: isOverdue(t.due_at) ? 'overdue_task' : isDueToday(t.due_at) ? 'due_today' : 'upcoming_task',
                title: String(t.title ?? 'Follow-up'),
                detail: isDueToday(t.due_at) ? 'Due today' : formatDateTime(t.due_at),
                at: dueAt,
                leadId: t.lead_id ? String(t.lead_id) : undefined,
                taskId: String(t.id),
            });
        }
        for (const e of escalationsRes.data ?? []) {
            notifications.push({
                id: `escalation-${e.id}`,
                category: 'escalation',
                title: String(e.title ?? 'Escalation'),
                detail: 'Needs review',
                at: String(e.created_at ?? new Date().toISOString()),
            });
        }
        for (const o of ordersRes.data ?? []) {
            notifications.push({
                id: `order-${o.id}`,
                category: 'order_update',
                title: `Order ${String(o.order_name ?? o.id).slice(0, 24)}`,
                detail: String(o.status ?? 'updated'),
                at: String(o.updated_at ?? new Date().toISOString()),
            });
        }
        for (const opp of oppsRes.data ?? []) {
            notifications.push({
                id: `opp-${opp.id}`,
                category: 'sales_opportunity',
                title: `Sales opportunity: ${String(opp.product ?? 'Product')}`,
                detail: String(opp.status ?? 'interested'),
                at: String(opp.created_at ?? new Date().toISOString()),
                leadId: opp.lead_id ? String(opp.lead_id) : undefined,
            });
        }
        for (const pt of partnerTasksRes.data ?? []) {
            notifications.push({
                id: `partner-task-${pt.id}`,
                category: 'visit_completed',
                title: String(pt.title ?? 'Partner task completed'),
                detail: 'Partner completed assigned task',
                at: String(pt.updated_at ?? new Date().toISOString()),
                leadId: pt.lead_id ? String(pt.lead_id) : undefined,
                taskId: String(pt.id),
            });
        }
        notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        return notifications.slice(0, 50);
    },
};
//# sourceMappingURL=telecaller-mobile.service.js.map