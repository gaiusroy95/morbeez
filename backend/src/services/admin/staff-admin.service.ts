import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';
import { opportunityScoreStoreService } from '../intelligence/opportunity-score-store.service.js';
import {
  MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
  performanceBreakdownFromComponents,
  performanceLabel,
} from '../intelligence/employee-performance-scoring.util.js';

const STAFF_ROLES = [
  'super_admin',
  'admin',
  'operations',
  'agronomist',
  'telecaller',
  'manager',
  'viewer',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffMember = {
  /** employee_profiles.id when HR profile exists; otherwise admin_users.id */
  id: string;
  adminUserId: string | null;
  hasProfile: boolean;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  employeeCode: string;
  agronomistTier: 'new' | 'experienced' | null;
  totalLeads: number;
  pendingTasks: number;
  pendingFollowUpsToday: number;
  turnoverInr: number;
  performanceScore: number;
  performanceLabel: string;
  performanceSource: 'engine' | 'estimated';
  attributedFarmerCount: number;
  leaderboardEligible: boolean;
  statusOnline: boolean;
};

export type StaffWorkspace = {
  summary: {
    totalEmployees: number;
    activeCount: number;
    inactiveCount: number;
    avgPerformanceScore: number;
    avgTurnoverInr: number;
    pendingTasks: number;
  };
  secondary: {
    onlineNow: number;
    lateLogin: number;
    lowTurnover: number;
    totalLeads: number;
  };
  employees: StaffMember[];
};

type AdminRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  admin_user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string | null;
  role: string;
  status: string;
  agronomist_tier: string | null;
  created_at: string;
};

function scoreFromMetrics(leads: number, tasksDone: number, loginDaysAgo: number | null): number {
  let score = 62;
  score += Math.min(leads * 2, 24);
  score += Math.min(tasksDone * 3, 12);
  if (loginDaysAgo != null) {
    if (loginDaysAgo <= 1) score += 8;
    else if (loginDaysAgo <= 7) score += 4;
    else if (loginDaysAgo > 14) score -= 10;
  }
  return Math.max(40, Math.min(98, Math.round(score)));
}

function buildStaffMember(
  params: {
    id: string;
    adminUserId: string | null;
    hasProfile: boolean;
    email: string;
    fullName: string;
    role: string;
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    employeeCode: string;
    agronomistTier?: 'new' | 'experienced' | null;
  },
  metrics?: { leads: number; pendingTasks: number; followUps: number }
): StaffMember {
  const leads = metrics?.leads ?? 0;
  const pendingTasks = metrics?.pendingTasks ?? 0;
  const pendingFollowUpsToday = metrics?.followUps ?? 0;
  const loginMs = params.lastLoginAt ? new Date(params.lastLoginAt).getTime() : null;
  const loginDaysAgo = loginMs != null ? Math.floor((Date.now() - loginMs) / 86400000) : null;
  const performanceScore = scoreFromMetrics(leads, 0, loginDaysAgo);
  const turnoverInr = leads * 12500 + pendingTasks * 800;
  const now = Date.now();
  const statusOnline = params.active && loginMs != null && now - loginMs < 15 * 60 * 1000;

  return {
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
    turnoverInr,
    performanceScore,
    performanceLabel: performanceLabel(performanceScore),
    performanceSource: 'estimated',
    attributedFarmerCount: 0,
    leaderboardEligible: false,
    statusOnline,
  };
}

async function applyEngineScores(employees: StaffMember[]): Promise<void> {
  const profileIds = employees.filter((e) => e.hasProfile).map((e) => e.id);
  if (!profileIds.length) return;

  const { data, error } = await supabase
    .from('employee_scores')
    .select(
      'employee_profile_id, performance_score, attributed_farmer_count, engagement_growth_score, relationship_quality_score, retention_quality_score, trust_building_score, delayed_conversion_score, farmer_reactivation_score, knowledge_contribution_score, farmer_satisfaction_score, factors, calculated_at'
    )
    .in('employee_profile_id', profileIds);

  throwIfSupabaseError(error, 'Could not load employee performance scores');

  const byProfile = new Map((data ?? []).map((r) => [String(r.employee_profile_id), r]));

  for (const e of employees) {
    if (!e.hasProfile) continue;
    const row = byProfile.get(e.id);
    if (!row) continue;

    const attributed = Number(row.attributed_farmer_count ?? 0);
    e.performanceScore = Number(row.performance_score);
    e.performanceLabel = performanceLabel(e.performanceScore);
    e.performanceSource = 'engine';
    e.attributedFarmerCount = attributed;
    e.leaderboardEligible = attributed >= MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD;
  }
}

async function loadAssignmentMetrics(emails: string[]) {
  const leadCounts = new Map<string, number>();
  const taskCounts = new Map<string, number>();
  const followUpCounts = new Map<string, number>();

  if (!emails.length) {
    return { leadCounts, taskCounts, followUpCounts };
  }

  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('assigned_to')
    .in('assigned_to', emails);
  throwIfSupabaseError(leadsErr, 'Could not load lead assignments');
  for (const row of leads ?? []) {
    if (!row.assigned_to) continue;
    leadCounts.set(row.assigned_to, (leadCounts.get(row.assigned_to) ?? 0) + 1);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: tasks, error: tasksErr } = await supabase
    .from('crm_tasks')
    .select('assigned_to, status, due_at')
    .in('assigned_to', emails);
  throwIfSupabaseError(tasksErr, 'Could not load task assignments');

  for (const row of tasks ?? []) {
    if (!row.assigned_to) continue;
    if (row.status === 'pending') {
      taskCounts.set(row.assigned_to, (taskCounts.get(row.assigned_to) ?? 0) + 1);
      if (row.due_at && new Date(row.due_at) <= new Date(todayStart.getTime() + 86400000)) {
        followUpCounts.set(row.assigned_to, (followUpCounts.get(row.assigned_to) ?? 0) + 1);
      }
    }
  }

  return { leadCounts, taskCounts, followUpCounts };
}

export const staffAdminService = {
  async getWorkspace(): Promise<StaffWorkspace> {
    const { data: profiles, error: profileErr } = await supabase
      .from('employee_profiles')
      .select(
        'id, admin_user_id, employee_code, full_name, email, role, status, agronomist_tier, created_at'
      )
      .order('created_at', { ascending: false });
    throwIfSupabaseError(profileErr, 'Could not load employee profiles');

    const adminIds = [
      ...new Set(
        (profiles ?? [])
          .map((p) => p.admin_user_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const adminById = new Map<string, AdminRow>();
    if (adminIds.length) {
      const { data: admins, error: adminsErr } = await supabase
        .from('admin_users')
        .select('id, email, full_name, role, active, last_login_at, created_at')
        .in('id', adminIds);
      throwIfSupabaseError(adminsErr, 'Could not load linked admin accounts');
      for (const a of admins ?? []) {
        adminById.set(a.id, a as AdminRow);
      }
    }

    const linkedAdminIds = new Set<string>();
    const employees: StaffMember[] = [];

    for (const row of (profiles ?? []) as ProfileRow[]) {
      const admin = row.admin_user_id ? adminById.get(row.admin_user_id) ?? null : null;
      const email = (admin?.email ?? row.email ?? '').trim().toLowerCase();
      if (!email) continue;
      if (admin?.id) linkedAdminIds.add(admin.id);

      const profileActive = row.status === 'active';
      const adminActive = admin ? admin.active : true;
      const active = profileActive && adminActive;

      employees.push(
        buildStaffMember(
          {
            id: row.id,
            adminUserId: row.admin_user_id,
            hasProfile: true,
            email,
            fullName: row.full_name || admin?.full_name || email,
            role: row.role || admin?.role || 'viewer',
            active,
            lastLoginAt: admin?.last_login_at ?? null,
            createdAt: row.created_at,
            employeeCode: row.employee_code,
            agronomistTier:
              row.role === 'agronomist'
                ? row.agronomist_tier === 'experienced'
                  ? 'experienced'
                  : 'new'
                : null,
          },
          undefined
        )
      );
    }

    const { data: orphanAdmins, error: adminErr } = await supabase
      .from('admin_users')
      .select('id, email, full_name, role, active, last_login_at, created_at')
      .order('created_at', { ascending: false });
    throwIfSupabaseError(adminErr, 'Could not load admin users');

    for (const u of orphanAdmins ?? []) {
      if (linkedAdminIds.has(u.id)) continue;
      const email = String(u.email).trim().toLowerCase();
      employees.push(
        buildStaffMember({
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
        })
      );
    }

    const emails = [...new Set(employees.map((e) => e.email))];
    const { leadCounts, taskCounts, followUpCounts } = await loadAssignmentMetrics(emails);
    for (const e of employees) {
      e.totalLeads = leadCounts.get(e.email) ?? 0;
      e.pendingTasks = taskCounts.get(e.email) ?? 0;
      e.pendingFollowUpsToday = followUpCounts.get(e.email) ?? 0;
      const loginMs = e.lastLoginAt ? new Date(e.lastLoginAt).getTime() : null;
      const loginDaysAgo = loginMs != null ? Math.floor((Date.now() - loginMs) / 86400000) : null;
      e.performanceScore = scoreFromMetrics(e.totalLeads, 0, loginDaysAgo);
      e.performanceLabel = performanceLabel(e.performanceScore);
      e.turnoverInr = e.totalLeads * 12500 + e.pendingTasks * 800;
      const now = Date.now();
      e.statusOnline = e.active && loginMs != null && now - loginMs < 15 * 60 * 1000;
    }

    await applyEngineScores(employees);

    const active = employees.filter((e) => e.active);
    const inactive = employees.filter((e) => !e.active);
    const engineScored = employees.filter((e) => e.performanceSource === 'engine');
    const avgPerformance =
      engineScored.length > 0
        ? engineScored.reduce((s, e) => s + e.performanceScore, 0) / engineScored.length
        : employees.length > 0
          ? employees.reduce((s, e) => s + e.performanceScore, 0) / employees.length
          : 0;
    const avgTurnover =
      employees.length > 0
        ? employees.reduce((s, e) => s + e.turnoverInr, 0) / employees.length
        : 0;
    const now = Date.now();

    return {
      summary: {
        totalEmployees: employees.length,
        activeCount: active.length,
        inactiveCount: inactive.length,
        avgPerformanceScore: Math.round(avgPerformance * 10) / 10,
        avgTurnoverInr: Math.round(avgTurnover),
        pendingTasks: employees.reduce((s, e) => s + e.pendingTasks, 0),
      },
      secondary: {
        onlineNow: employees.filter((e) => e.statusOnline).length,
        lateLogin: employees.filter((e) => {
          if (!e.lastLoginAt) return e.active;
          const days = Math.floor((now - new Date(e.lastLoginAt).getTime()) / 86400000);
          return days > 2 && e.active;
        }).length,
        lowTurnover: employees.filter((e) => e.turnoverInr < 100000 && e.active).length,
        totalLeads: employees.reduce((s, e) => s + e.totalLeads, 0),
      },
      employees,
    };
  },

  async getEmployeeDetail(id: string) {
    const workspace = await this.getWorkspace();
    const employee =
      workspace.employees.find((e) => e.id === id) ??
      workspace.employees.find((e) => e.adminUserId === id);
    if (!employee) return null;

    const { data: recentLeads, error: leadsErr } = await supabase
      .from('leads')
      .select('id, stage, updated_at, farmer_id')
      .eq('assigned_to', employee.email)
      .order('updated_at', { ascending: false })
      .limit(5);
    if (leadsErr) {
      logger.warn({ err: leadsErr, employeeId: id }, 'staff detail: could not load recent leads');
    }

    const farmerIds = [
      ...new Set((recentLeads ?? []).map((l) => l.farmer_id).filter(Boolean)),
    ] as string[];
    const farmerById = new Map<string, { name?: string; district?: string }>();
    if (farmerIds.length) {
      const { data: farmers } = await supabase
        .from('farmers')
        .select('id, name, district')
        .in('id', farmerIds);
      for (const f of farmers ?? []) {
        farmerById.set(String(f.id), { name: f.name ?? undefined, district: f.district ?? undefined });
      }
    }

    const { data: recentTasks, error: tasksErr } = await supabase
      .from('crm_tasks')
      .select('id, title, status, due_at')
      .eq('assigned_to', employee.email)
      .order('due_at', { ascending: true })
      .limit(5);
    if (tasksErr) {
      logger.warn({ err: tasksErr, employeeId: id }, 'staff detail: could not load recent tasks');
    }

    let performanceBreakdown = [
      { label: 'Conversion rate', pct: Math.min(95, employee.performanceScore - 5) },
      { label: 'Follow-up completion', pct: Math.min(92, employee.performanceScore) },
      { label: 'Customer satisfaction', pct: Math.min(90, employee.performanceScore - 8) },
      { label: 'Response time', pct: Math.min(88, employee.performanceScore - 3) },
    ];
    let performanceFactors: unknown[] = [];

    if (employee.hasProfile) {
      try {
        const engineScore = await opportunityScoreStoreService.getEmployeeScore(employee.id);
        if (engineScore) {
          performanceBreakdown = performanceBreakdownFromComponents(engineScore.components);
          performanceFactors = engineScore.factors;
        }
      } catch {
        /* score table optional — use estimated breakdown */
      }
    }

    return {
      employee,
      overview: {
        pendingTasks: employee.pendingTasks,
        pendingFollowUps: employee.pendingFollowUpsToday,
        newLeadsToday: 0,
        interactionsThisMonth: employee.totalLeads * 3,
        onlineStatus: employee.statusOnline ? 'Online' : 'Offline',
        lastLoginAt: employee.lastLoginAt,
        attributedFarmerCount: employee.attributedFarmerCount,
        leaderboardEligible: employee.leaderboardEligible,
        performanceSource: employee.performanceSource,
      },
      turnoverTrend: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        values: [0.6, 0.72, 0.85, 0.9, 0.95, 1].map((m) => Math.round(employee.turnoverInr * m)),
      },
      performanceBreakdown,
      performanceFactors,
      recentLeads: (recentLeads ?? []).map((l) => {
        const f = l.farmer_id ? farmerById.get(String(l.farmer_id)) : undefined;
        return {
          id: l.id,
          name: f?.name ?? 'Farmer',
          crop: f?.district ?? '—',
          when: l.updated_at,
        };
      }),
      recentTasks: (recentTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueAt: t.due_at,
      })),
    };
  },
};
