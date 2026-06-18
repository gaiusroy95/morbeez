import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export type MonitoringSeverity = 'low' | 'medium' | 'high';

export type MonitoringPlanItemRow = {
  id: string;
  recommendationRecordId: string;
  intervalDays: number;
  checkType: string;
  severity: MonitoringSeverity;
  nextCheckAt: string;
  createdAt: string;
};

export type MonitoringPlanMaterialHint = {
  category?: string | null;
  technicalName?: string | null;
};

const SEVERITY_INTERVAL_DAYS: Record<MonitoringSeverity, number> = {
  high: 3,
  medium: 7,
  low: 14,
};

const FUNGICIDE_INTERVAL_DAYS = 7;

function normalizeSeverity(severity: string | null | undefined): MonitoringSeverity {
  if (severity === 'high' || severity === 'medium' || severity === 'low') return severity;
  return 'medium';
}

function isFungicideMaterial(material: MonitoringPlanMaterialHint): boolean {
  const haystack = `${material.category ?? ''} ${material.technicalName ?? ''}`.toLowerCase();
  return /fungicid|fungal|fungus/.test(haystack);
}

function addDaysIso(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function mapRow(row: Record<string, unknown>): MonitoringPlanItemRow {
  return {
    id: String(row.id),
    recommendationRecordId: String(row.recommendation_record_id),
    intervalDays: Number(row.interval_days),
    checkType: String(row.check_type),
    severity: normalizeSeverity(String(row.severity)),
    nextCheckAt: String(row.next_check_at),
    createdAt: String(row.created_at),
  };
}

export const monitoringPlanService = {
  resolveIntervalDays(
    severity: string | null | undefined,
    materials: MonitoringPlanMaterialHint[] = []
  ): number {
    if (materials.some(isFungicideMaterial)) return FUNGICIDE_INTERVAL_DAYS;
    return SEVERITY_INTERVAL_DAYS[normalizeSeverity(severity)];
  },

  resolveCheckType(materials: MonitoringPlanMaterialHint[] = []): string {
    if (materials.some(isFungicideMaterial)) return 'fungicide_follow_up';
    return 'field_monitoring';
  },

  async createForRecommendation(
    recommendationRecordId: string,
    opts: {
      severity?: string | null;
      checkType?: string;
      materials?: MonitoringPlanMaterialHint[];
      intervalDays?: number;
      from?: Date;
    } = {}
  ): Promise<MonitoringPlanItemRow> {
    const materials = opts.materials ?? [];
    const severity = normalizeSeverity(opts.severity);
    const intervalDays =
      opts.intervalDays ?? this.resolveIntervalDays(severity, materials);
    const checkType = opts.checkType ?? this.resolveCheckType(materials);
    const nextCheckAt = addDaysIso(intervalDays, opts.from ?? new Date());

    const { data, error } = await supabase
      .from('monitoring_plan_items')
      .insert({
        recommendation_record_id: recommendationRecordId,
        interval_days: intervalDays,
        check_type: checkType,
        severity,
        next_check_at: nextCheckAt,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create monitoring plan item');
    return mapRow(data as Record<string, unknown>);
  },

  async listByRecommendation(recommendationRecordId: string): Promise<MonitoringPlanItemRow[]> {
    const { data, error } = await supabase
      .from('monitoring_plan_items')
      .select('*')
      .eq('recommendation_record_id', recommendationRecordId)
      .order('next_check_at', { ascending: true });
    throwIfSupabaseError(error, 'Could not load monitoring plan items');
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  },

  async deleteForRecommendation(recommendationRecordId: string): Promise<void> {
    const { error } = await supabase
      .from('monitoring_plan_items')
      .delete()
      .eq('recommendation_record_id', recommendationRecordId);
    throwIfSupabaseError(error, 'Could not delete monitoring plan items');
  },

  previewForVisit(input: {
    issues: Array<{ localId: string; issueName: string; severity: string }>;
    recommendationGroups?: Array<{
      applicationType: string;
      applicationDay?: number;
      materials: Array<{ technicalName: string; category?: string }>;
    }>;
  }) {
    return input.issues.map((issue, index) => {
      const linkedGroup = input.recommendationGroups?.find((g) =>
        g.materials.some((m) => m.technicalName.toLowerCase().includes(issue.issueName.split(' ')[0]!.toLowerCase()))
      ) ?? input.recommendationGroups?.[index];
      const materials = linkedGroup?.materials ?? [];
      const intervalDays = this.resolveIntervalDays(issue.severity, materials);
      return {
        localId: `mon-${issue.localId}`,
        issueLocalId: issue.localId,
        issueLabel: issue.issueName,
        intervalDays,
        checkType: this.resolveCheckType(materials),
        severity: normalizeSeverity(issue.severity),
      };
    });
  },

  async scheduleProgressionJob(params: {
    farmerId: string;
    fieldFindingId: string;
    visitIssueId: string;
    severity: string;
    sessionId?: string | null;
    intervalDays?: number;
  }): Promise<void> {
    const days = params.intervalDays ?? SEVERITY_INTERVAL_DAYS[normalizeSeverity(params.severity)];
    const scheduledAt = addDaysIso(days);
    await supabase.from('advisory_automation_jobs').insert({
      farmer_id: params.farmerId,
      session_id: params.sessionId ?? null,
      job_type: 'visit_monitoring_progression',
      scheduled_at: scheduledAt,
      payload: {
        fieldFindingId: params.fieldFindingId,
        visitIssueId: params.visitIssueId,
        severity: params.severity,
      },
    });
  },
};
