import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';
import { opportunityScoreStoreService } from '../intelligence/opportunity-score-store.service.js';
import { incentiveCalculatorService } from './incentive-calculator.service.js';
import { MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD, performanceBreakdownFromComponents, performanceLabel, } from '../intelligence/employee-performance-scoring.util.js';
const STAFF_ROLES = [
    'super_admin',
    'admin',
    'operations',
    'agronomist',
    'telecaller',
    'manager',
    'viewer',
];
const WORKSPACE_CACHE_MS = 45_000;
let workspaceCache = null;
function monthBoundsUtc(d = new Date()) {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start: start.toISOString(), end: end.toISOString(), monthYear: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}` };
}
function todayStartIso() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}
function loginDaysAgo(lastLoginAt) {
    if (!lastLoginAt)
        return null;
    const ms = Date.now() - new Date(lastLoginAt).getTime();
    return Math.floor(ms / 86400000);
}
function scoreFromMetrics(leads, tasksDone, daysAgo) {
    let score = 62;
    score += Math.min(leads * 2, 24);
    score += Math.min(tasksDone * 3, 12);
    if (daysAgo != null) {
        if (daysAgo <= 1)
            score += 8;
        else if (daysAgo <= 7)
            score += 4;
        else if (daysAgo > 14)
            score -= 10;
    }
    return Math.max(40, Math.min(98, Math.round(score)));
}
function computeRoiPct(performanceScore, turnoverInr) {
    if (turnoverInr <= 0)
        return 0;
    const baseline = 50000;
    const productivity = Math.min(100, Math.round((turnoverInr / baseline) * 50));
    return Math.min(100, Math.round(performanceScore * 0.55 + productivity * 0.45));
}
function applyDerivedFields(member, interactionStats, incentiveInr = 0) {
    const days = loginDaysAgo(member.lastLoginAt);
    member.lateLoginDays = days;
    member.isLateLogin = member.active && (days == null || days > 2);
    member.interactionsToday = interactionStats?.today ?? 0;
    member.interactionsThisMonth = interactionStats?.month ?? 0;
    member.estimatedIncentiveInr = incentiveInr;
    member.roiPct = computeRoiPct(member.performanceScore, member.turnoverInr);
}
function buildStaffMember(params, metrics, turnoverInr) {
    const leads = metrics?.leads ?? 0;
    const pendingTasks = metrics?.pendingTasks ?? 0;
    const pendingFollowUpsToday = metrics?.followUps ?? 0;
    const days = loginDaysAgo(params.lastLoginAt);
    const performanceScore = scoreFromMetrics(leads, 0, days);
    const resolvedTurnover = turnoverInr ?? leads * 12500 + pendingTasks * 800;
    const loginMs = params.lastLoginAt ? new Date(params.lastLoginAt).getTime() : null;
    const statusOnline = params.active && loginMs != null && Date.now() - loginMs < 15 * 60 * 1000;
    const member = {
        id: params.id,
        adminUserId: params.adminUserId,
        hasProfile: params.hasProfile,
        email: params.email,
        fullName: params.fullName,
        role: params.role,
        active: params.active,
        lastLoginAt: params.lastLoginAt,
        createdAt: params.createdAt,
        employeeCode: params.employeeCode,
        agronomistTier: params.agronomistTier ?? null,
        totalLeads: leads,
        pendingTasks,
        pendingFollowUpsToday,
        turnoverInr: Math.round(resolvedTurnover),
        performanceScore,
        performanceLabel: performanceLabel(performanceScore),
        performanceSource: 'estimated',
        attributedFarmerCount: 0,
        leaderboardEligible: false,
        statusOnline,
        lateLoginDays: days,
        isLateLogin: params.active && (days == null || days > 2),
        interactionsToday: 0,
        interactionsThisMonth: 0,
        estimatedIncentiveInr: 0,
        roiPct: computeRoiPct(performanceScore, resolvedTurnover),
    };
    return member;
}
async function countForEmail(email) {
    const todayIso = todayStartIso();
    const tomorrowIso = new Date(new Date(todayIso).getTime() + 86400000).toISOString();
    const [leadsRes, tasksRes, followRes, newLeadsRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', email),
        supabase
            .from('crm_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', email)
            .eq('status', 'pending'),
        supabase
            .from('crm_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', email)
            .eq('status', 'pending')
            .gte('due_at', todayIso)
            .lt('due_at', tomorrowIso),
        supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', email)
            .gte('created_at', todayIso)
            .lt('created_at', tomorrowIso),
    ]);
    return {
        leads: leadsRes.count ?? 0,
        pendingTasks: tasksRes.count ?? 0,
        followUps: followRes.count ?? 0,
        newLeadsToday: newLeadsRes.count ?? 0,
    };
}
async function loadMetricsForEmails(emails) {
    const map = new Map();
    if (!emails.length)
        return map;
    await Promise.all(emails.map(async (email) => {
        map.set(email, await countForEmail(email));
    }));
    return map;
}
function emptyInteractionMap(emails) {
    const map = new Map();
    for (const email of emails) {
        map.set(email.toLowerCase(), { today: 0, month: 0 });
    }
    return map;
}
async function loadInteractionStatsBatch(emails) {
    const map = emptyInteractionMap(emails);
    if (!emails.length)
        return map;
    const { start, end } = monthBoundsUtc();
    const todayMs = new Date(todayStartIso()).getTime();
    const normalized = emails.map((e) => e.toLowerCase());
    const [ixRes, callRes] = await Promise.all([
        supabase
            .from('interaction_logs')
            .select('done_by, created_at')
            .gte('created_at', start)
            .lte('created_at', end)
            .in('done_by', normalized),
        supabase
            .from('crm_call_logs')
            .select('agent_email, created_at')
            .gte('created_at', start)
            .lte('created_at', end)
            .in('agent_email', normalized),
    ]);
    for (const row of ixRes.data ?? []) {
        const key = String(row.done_by ?? '').toLowerCase();
        const stats = map.get(key);
        if (!stats)
            continue;
        stats.month += 1;
        if (new Date(String(row.created_at)).getTime() >= todayMs)
            stats.today += 1;
    }
    for (const row of callRes.data ?? []) {
        const key = String(row.agent_email ?? '').toLowerCase();
        const stats = map.get(key);
        if (!stats)
            continue;
        stats.month += 1;
        if (new Date(String(row.created_at)).getTime() >= todayMs)
            stats.today += 1;
    }
    return map;
}
async function loadInteractionStats(email) {
    const map = await loadInteractionStatsBatch([email]);
    return map.get(email.toLowerCase()) ?? { today: 0, month: 0 };
}
async function loadLedgerTurnoverByProfile(profileIds, start, end) {
    const map = new Map();
    if (!profileIds.length)
        return map;
    const { data, error } = await supabase
        .from('employee_sales_ledger')
        .select('employee_profile_id, final_unit_price, qty')
        .in('employee_profile_id', profileIds)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .in('status', ['quoted', 'confirmed', 'paid']);
    if (error) {
        logger.warn({ err: error }, 'staff: ledger turnover unavailable');
        return map;
    }
    for (const row of data ?? []) {
        const id = String(row.employee_profile_id);
        const amt = Number(row.final_unit_price ?? 0) * Number(row.qty ?? 0);
        map.set(id, (map.get(id) ?? 0) + amt);
    }
    return map;
}
async function loadTurnoverTrend(profileId) {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        buckets.push({
            key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
            label: d.toLocaleString('en-IN', { month: 'short' }),
            startMs: d.getTime(),
            endMs: end.getTime(),
        });
    }
    const rangeStart = new Date(buckets[0].startMs).toISOString();
    const { data, error } = await supabase
        .from('employee_sales_ledger')
        .select('recorded_at, final_unit_price, qty')
        .eq('employee_profile_id', profileId)
        .gte('recorded_at', rangeStart)
        .in('status', ['quoted', 'confirmed', 'paid']);
    const totals = new Map(buckets.map((b) => [b.key, 0]));
    if (!error) {
        for (const row of data ?? []) {
            const ms = new Date(String(row.recorded_at)).getTime();
            const bucket = buckets.find((b) => ms >= b.startMs && ms <= b.endMs);
            if (!bucket)
                continue;
            const amt = Number(row.final_unit_price ?? 0) * Number(row.qty ?? 0);
            totals.set(bucket.key, (totals.get(bucket.key) ?? 0) + amt);
        }
    }
    const labels = buckets.map((b) => b.label);
    const values = buckets.map((b) => Math.round(totals.get(b.key) ?? 0));
    if (values.every((v) => v === 0)) {
        return { labels, values };
    }
    return { labels, values };
}
async function applyEngineScores(employees) {
    const profileIds = employees.filter((e) => e.hasProfile).map((e) => e.id);
    if (!profileIds.length)
        return;
    const { data, error } = await supabase
        .from('employee_scores')
        .select('employee_profile_id, performance_score, attributed_farmer_count')
        .in('employee_profile_id', profileIds);
    if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist'))
            return;
        throwIfSupabaseError(error, 'Could not load employee performance scores');
    }
    const byProfile = new Map((data ?? []).map((r) => [String(r.employee_profile_id), r]));
    for (const e of employees) {
        if (!e.hasProfile)
            continue;
        const row = byProfile.get(e.id);
        if (!row)
            continue;
        const attributed = Number(row.attributed_farmer_count ?? 0);
        e.performanceScore = Number(row.performance_score);
        e.performanceLabel = performanceLabel(e.performanceScore);
        e.performanceSource = 'engine';
        e.attributedFarmerCount = attributed;
        e.leaderboardEligible = attributed >= MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD;
        e.roiPct = computeRoiPct(e.performanceScore, e.turnoverInr);
    }
}
async function resolveEmployeeRecord(id) {
    const { data: profile } = await supabase
        .from('employee_profiles')
        .select('id, admin_user_id, employee_code, full_name, email, role, status, agronomist_tier, created_at')
        .eq('id', id)
        .maybeSingle();
    if (profile) {
        let admin = null;
        if (profile.admin_user_id) {
            const { data } = await supabase
                .from('admin_users')
                .select('id, email, full_name, role, active, last_login_at, created_at')
                .eq('id', profile.admin_user_id)
                .maybeSingle();
            admin = data ?? null;
        }
        const email = (admin?.email ?? profile.email ?? '').trim().toLowerCase();
        if (!email)
            return null;
        const active = profile.status === 'active' && (admin ? admin.active : true);
        const metrics = await countForEmail(email);
        const { start, end } = monthBoundsUtc();
        const ledgerMap = await loadLedgerTurnoverByProfile([profile.id], start, end);
        const turnover = ledgerMap.get(profile.id);
        const member = buildStaffMember({
            id: profile.id,
            adminUserId: profile.admin_user_id,
            hasProfile: true,
            email,
            fullName: profile.full_name || admin?.full_name || email,
            role: profile.role || admin?.role || 'viewer',
            active,
            lastLoginAt: admin?.last_login_at ?? null,
            createdAt: profile.created_at,
            employeeCode: profile.employee_code,
            agronomistTier: profile.role === 'agronomist'
                ? profile.agronomist_tier === 'experienced'
                    ? 'experienced'
                    : 'new'
                : null,
        }, metrics, turnover);
        await applyEngineScores([member]);
        const interactions = await loadInteractionStats(email);
        let incentive = 0;
        try {
            const bonus = await incentiveCalculatorService.estimateMonthlyIncentive(profile.id, member.turnoverInr, member.performanceScore);
            incentive = Math.round(bonus.totalBonus);
        }
        catch {
            /* compensation row optional */
        }
        applyDerivedFields(member, interactions, incentive);
        return member;
    }
    const { data: admin } = await supabase
        .from('admin_users')
        .select('id, email, full_name, role, active, last_login_at, created_at')
        .eq('id', id)
        .maybeSingle();
    if (!admin)
        return null;
    const email = String(admin.email).trim().toLowerCase();
    const metrics = await countForEmail(email);
    const member = buildStaffMember({
        id: admin.id,
        adminUserId: admin.id,
        hasProfile: false,
        email,
        fullName: admin.full_name ?? email,
        role: admin.role,
        active: admin.active,
        lastLoginAt: admin.last_login_at,
        createdAt: admin.created_at,
        employeeCode: `ADM-${admin.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        agronomistTier: admin.role === 'agronomist' ? 'new' : null,
    }, metrics);
    const interactions = await loadInteractionStats(email);
    applyDerivedFields(member, interactions, 0);
    return member;
}
async function buildWorkspace() {
    const { data: profiles, error: profileErr } = await supabase
        .from('employee_profiles')
        .select('id, admin_user_id, employee_code, full_name, email, role, status, agronomist_tier, created_at')
        .order('created_at', { ascending: false });
    throwIfSupabaseError(profileErr, 'Could not load employee profiles');
    const adminIds = [
        ...new Set((profiles ?? [])
            .map((p) => p.admin_user_id)
            .filter((id) => Boolean(id))),
    ];
    const adminById = new Map();
    if (adminIds.length) {
        const { data: admins, error: adminsErr } = await supabase
            .from('admin_users')
            .select('id, email, full_name, role, active, last_login_at, created_at')
            .in('id', adminIds);
        throwIfSupabaseError(adminsErr, 'Could not load linked admin accounts');
        for (const a of admins ?? []) {
            adminById.set(a.id, a);
        }
    }
    const linkedAdminIds = new Set();
    const employees = [];
    const profileIds = [];
    for (const row of (profiles ?? [])) {
        const admin = row.admin_user_id ? adminById.get(row.admin_user_id) ?? null : null;
        const email = (admin?.email ?? row.email ?? '').trim().toLowerCase();
        if (!email)
            continue;
        if (admin?.id)
            linkedAdminIds.add(admin.id);
        profileIds.push(row.id);
        const profileActive = row.status === 'active';
        const adminActive = admin ? admin.active : true;
        employees.push(buildStaffMember({
            id: row.id,
            adminUserId: row.admin_user_id,
            hasProfile: true,
            email,
            fullName: row.full_name || admin?.full_name || email,
            role: row.role || admin?.role || 'viewer',
            active: profileActive && adminActive,
            lastLoginAt: admin?.last_login_at ?? null,
            createdAt: row.created_at,
            employeeCode: row.employee_code,
            agronomistTier: row.role === 'agronomist'
                ? row.agronomist_tier === 'experienced'
                    ? 'experienced'
                    : 'new'
                : null,
        }));
    }
    const { data: orphanAdmins, error: adminErr } = await supabase
        .from('admin_users')
        .select('id, email, full_name, role, active, last_login_at, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
    throwIfSupabaseError(adminErr, 'Could not load admin users');
    for (const u of orphanAdmins ?? []) {
        if (linkedAdminIds.has(u.id))
            continue;
        const email = String(u.email).trim().toLowerCase();
        employees.push(buildStaffMember({
            id: u.id,
            adminUserId: u.id,
            hasProfile: false,
            email,
            fullName: u.full_name ?? email,
            role: u.role,
            active: u.active,
            lastLoginAt: u.last_login_at,
            createdAt: u.created_at,
            employeeCode: `ADM-${u.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
            agronomistTier: u.role === 'agronomist' ? 'new' : null,
        }));
    }
    const emails = [...new Set(employees.map((e) => e.email))];
    const metricsMap = await loadMetricsForEmails(emails);
    const { start, end } = monthBoundsUtc();
    const ledgerTurnover = await loadLedgerTurnoverByProfile(profileIds, start, end);
    const interactionMap = await loadInteractionStatsBatch(emails);
    for (const e of employees) {
        const m = metricsMap.get(e.email);
        if (m) {
            e.totalLeads = m.leads;
            e.pendingTasks = m.pendingTasks;
            e.pendingFollowUpsToday = m.followUps;
        }
        if (e.hasProfile) {
            const ledger = ledgerTurnover.get(e.id);
            if (ledger != null && ledger > 0)
                e.turnoverInr = Math.round(ledger);
        }
        else {
            e.turnoverInr = e.totalLeads * 12500 + e.pendingTasks * 800;
        }
        const days = loginDaysAgo(e.lastLoginAt);
        e.performanceScore = scoreFromMetrics(e.totalLeads, 0, days);
        e.performanceLabel = performanceLabel(e.performanceScore);
        const loginMs = e.lastLoginAt ? new Date(e.lastLoginAt).getTime() : null;
        e.statusOnline = e.active && loginMs != null && Date.now() - loginMs < 15 * 60 * 1000;
        applyDerivedFields(e, interactionMap.get(e.email.toLowerCase()), 0);
    }
    await applyEngineScores(employees);
    const active = employees.filter((e) => e.active);
    const inactive = employees.filter((e) => !e.active);
    const engineScored = employees.filter((e) => e.performanceSource === 'engine');
    const avgPerformance = engineScored.length > 0
        ? engineScored.reduce((s, e) => s + e.performanceScore, 0) / engineScored.length
        : employees.length > 0
            ? employees.reduce((s, e) => s + e.performanceScore, 0) / employees.length
            : 0;
    const avgTurnover = employees.length > 0
        ? employees.reduce((s, e) => s + e.turnoverInr, 0) / employees.length
        : 0;
    const avgRoi = employees.length > 0
        ? employees.reduce((s, e) => s + e.roiPct, 0) / employees.length
        : 0;
    const interactionsToday = employees.reduce((s, e) => s + e.interactionsToday, 0);
    return {
        summary: {
            totalEmployees: employees.length,
            activeCount: active.length,
            inactiveCount: inactive.length,
            avgPerformanceScore: Math.round(avgPerformance * 10) / 10,
            avgTurnoverInr: Math.round(avgTurnover),
            pendingTasks: employees.reduce((s, e) => s + e.pendingTasks, 0),
            interactionsToday,
            avgRoiPct: Math.round(avgRoi),
        },
        secondary: {
            onlineNow: employees.filter((e) => e.statusOnline).length,
            lateLogin: employees.filter((e) => e.isLateLogin).length,
            lowTurnover: employees.filter((e) => e.turnoverInr < 100000 && e.active).length,
            totalLeads: employees.reduce((s, e) => s + e.totalLeads, 0),
            interactionsToday,
        },
        employees,
    };
}
export const staffAdminService = {
    clearWorkspaceCache() {
        workspaceCache = null;
    },
    async getWorkspace(opts) {
        if (!opts?.skipCache &&
            workspaceCache &&
            Date.now() - workspaceCache.at < WORKSPACE_CACHE_MS) {
            return workspaceCache.data;
        }
        const data = await buildWorkspace();
        workspaceCache = { at: Date.now(), data };
        return data;
    },
    async getEmployeeDetail(id) {
        const employee = await resolveEmployeeRecord(id);
        if (!employee)
            return null;
        const metrics = await countForEmail(employee.email);
        const [recentLeadsRes, recentTasksRes, turnoverTrend] = await Promise.all([
            supabase
                .from('leads')
                .select('id, stage, updated_at, farmer_id')
                .eq('assigned_to', employee.email)
                .order('updated_at', { ascending: false })
                .limit(5),
            supabase
                .from('crm_tasks')
                .select('id, title, status, due_at')
                .eq('assigned_to', employee.email)
                .order('due_at', { ascending: true })
                .limit(5),
            employee.hasProfile ? loadTurnoverTrend(employee.id) : Promise.resolve({
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                values: [0, 0, 0, 0, 0, 0],
            }),
        ]);
        const recentLeads = recentLeadsRes.data ?? [];
        const farmerIds = [...new Set(recentLeads.map((l) => l.farmer_id).filter(Boolean))];
        const farmerById = new Map();
        if (farmerIds.length) {
            const { data: farmers } = await supabase
                .from('farmers')
                .select('id, name, district')
                .in('id', farmerIds);
            for (const f of farmers ?? []) {
                farmerById.set(String(f.id), { name: f.name ?? undefined, district: f.district ?? undefined });
            }
        }
        let performanceBreakdown = [
            { label: 'Conversion rate', pct: Math.min(95, employee.performanceScore - 5) },
            { label: 'Follow-up completion', pct: Math.min(92, employee.performanceScore) },
            { label: 'Customer satisfaction', pct: Math.min(90, employee.performanceScore - 8) },
            { label: 'Response time', pct: Math.min(88, employee.performanceScore - 3) },
        ];
        let performanceFactors = [];
        if (employee.hasProfile) {
            try {
                const engineScore = await opportunityScoreStoreService.getEmployeeScore(employee.id);
                if (engineScore) {
                    performanceBreakdown = performanceBreakdownFromComponents(engineScore.components);
                    performanceFactors = engineScore.factors;
                }
            }
            catch {
                /* optional */
            }
        }
        return {
            employee,
            overview: {
                pendingTasks: employee.pendingTasks,
                pendingFollowUps: employee.pendingFollowUpsToday,
                newLeadsToday: metrics.newLeadsToday,
                interactionsToday: employee.interactionsToday,
                interactionsThisMonth: employee.interactionsThisMonth,
                onlineStatus: employee.statusOnline ? 'Online' : 'Offline',
                lastLoginAt: employee.lastLoginAt,
                lateLoginDays: employee.lateLoginDays,
                isLateLogin: employee.isLateLogin,
                estimatedIncentiveInr: employee.estimatedIncentiveInr,
                roiPct: employee.roiPct,
                avgPerformanceScore: employee.performanceScore,
                attributedFarmerCount: employee.attributedFarmerCount,
                leaderboardEligible: employee.leaderboardEligible,
                performanceSource: employee.performanceSource,
            },
            turnoverTrend,
            performanceBreakdown,
            performanceFactors,
            recentLeads: recentLeads.map((l) => {
                const f = l.farmer_id ? farmerById.get(String(l.farmer_id)) : undefined;
                return {
                    id: l.id,
                    name: f?.name ?? 'Farmer',
                    crop: f?.district ?? '—',
                    when: l.updated_at,
                };
            }),
            recentTasks: (recentTasksRes.data ?? []).map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                dueAt: t.due_at,
            })),
        };
    },
};
//# sourceMappingURL=staff-admin.service.js.map