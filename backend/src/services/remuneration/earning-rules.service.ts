import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  DEFAULT_AGRONOMIST_SLABS,
  DEFAULT_KPI_FACTOR_BANDS,
  type AgronomistSlab,
  type KpiFactorBand,
} from '../../domain/remuneration/kpi-factor.js';
import {
  DEFAULT_SETTLEMENT_RULE,
  type SettlementRule,
} from '../../domain/remuneration/settlement-split.js';

import {
  DEFAULT_INTRODUCTION_RULE,
  type FarmerIntroductionRule,
} from '../../domain/remuneration/introduction-eligibility.js';
import {
  DEFAULT_AGRONOMIST_KPI_WEIGHTS,
  DEFAULT_PARTNER_KPI_WEIGHTS,
  validateWeights,
  type KpiParameter,
} from '../../domain/remuneration/weighted-kpi.js';
import {
  DEFAULT_QUALIFIED_CASE_RULE,
  type QualifiedCaseRule,
} from '../../domain/remuneration/qualified-case.js';
import {
  DEFAULT_DIAGNOSIS_QA_RULE,
  type DiagnosisQaRule,
} from '../../domain/remuneration/diagnosis-qa.js';
import {
  RULE_TYPES,
  assertTransition,
  isMutableStatus,
  monthKey,
  monthLastDay,
  previousMonth,
  shouldActivateNow,
  type RuleType,
} from '../../domain/remuneration/rule-workflow.js';

export type { RuleType };

type RuleRow = {
  id: string;
  rule_type: string;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  status: string;
  payload: Record<string, unknown>;
  change_reason: string;
  created_by: string | null;
  approved_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  activated_at: string | null;
  created_at: string;
};

async function lookupEffective(ruleType: RuleType, asOf = new Date()): Promise<RuleRow | null> {
  const day = asOf.toISOString().slice(0, 10);
  const { data } = await supabase
    .from('earning_rule_versions')
    .select('*')
    .eq('rule_type', ruleType)
    .in('status', ['active', 'approved', 'scheduled'])
    .lte('effective_from', day)
    .or(`effective_to.is.null,effective_to.gte.${day}`)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RuleRow | null) ?? null;
}

async function loadLocked(ruleType: RuleType, month: string): Promise<RuleRow | null> {
  const { data: lock } = await supabase
    .from('kpi_period_locks')
    .select('rule_version_id')
    .eq('period_month', month)
    .eq('rule_type', ruleType)
    .maybeSingle();
  if (!lock?.rule_version_id) return null;
  const { data } = await supabase
    .from('earning_rule_versions')
    .select('*')
    .eq('id', lock.rule_version_id)
    .maybeSingle();
  return (data as RuleRow | null) ?? null;
}

async function loadActive(ruleType: RuleType, asOf = new Date()) {
  const locked = await loadLocked(ruleType, monthKey(asOf));
  if (locked) return locked;
  return lookupEffective(ruleType, asOf);
}

async function getRow(id: string): Promise<RuleRow> {
  const { data, error } = await supabase
    .from('earning_rule_versions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfSupabaseError(error, 'Could not load earning rule');
  if (!data) throw new NotFoundError('Earning rule version not found');
  return data as RuleRow;
}

function asParameters(payload: unknown, fallback: KpiParameter[]): KpiParameter[] {
  const raw = (payload as { parameters?: KpiParameter[] } | null)?.parameters;
  return raw?.length ? raw : fallback;
}

export const earningRulesService = {
  async partnerKpiBands(asOf?: Date): Promise<KpiFactorBand[]> {
    const row = await loadActive('partner_kpi_factor', asOf);
    const bands = (row?.payload as { bands?: KpiFactorBand[] } | null)?.bands;
    return bands?.length ? bands : DEFAULT_KPI_FACTOR_BANDS;
  },

  async agronomistSlabs(asOf?: Date): Promise<AgronomistSlab[]> {
    const row = await loadActive('agronomist_sales_slab', asOf);
    const slabs = (row?.payload as { slabs?: AgronomistSlab[] } | null)?.slabs;
    return slabs?.length ? slabs : DEFAULT_AGRONOMIST_SLABS;
  },

  async settlementRule(asOf?: Date): Promise<SettlementRule> {
    const row = await loadActive('settlement_80_20', asOf);
    const payload = (row?.payload ?? {}) as Partial<SettlementRule>;
    return {
      firstPct: payload.firstPct ?? DEFAULT_SETTLEMENT_RULE.firstPct,
      holdPct: payload.holdPct ?? DEFAULT_SETTLEMENT_RULE.holdPct,
      firstDelayMonths: payload.firstDelayMonths ?? DEFAULT_SETTLEMENT_RULE.firstDelayMonths,
      holdDelayMonths: payload.holdDelayMonths ?? DEFAULT_SETTLEMENT_RULE.holdDelayMonths,
    };
  },

  async returnWindowDays(asOf?: Date): Promise<number> {
    const row = await loadActive('eligible_sale', asOf);
    const days = Number((row?.payload as { returnWindowDays?: number } | null)?.returnWindowDays);
    return Number.isFinite(days) && days >= 0 ? days : 7;
  },

  async introductionRule(asOf?: Date): Promise<FarmerIntroductionRule & { versionId: string | null }> {
    const row = await loadActive('farmer_introduction', asOf);
    const payload = (row?.payload ?? {}) as Partial<FarmerIntroductionRule>;
    return {
      minAcreage: Number(payload.minAcreage ?? DEFAULT_INTRODUCTION_RULE.minAcreage),
      cashRewardInr: Number(payload.cashRewardInr ?? DEFAULT_INTRODUCTION_RULE.cashRewardInr),
      productRewardInr: Number(payload.productRewardInr ?? DEFAULT_INTRODUCTION_RULE.productRewardInr),
      requireNewFarmer: payload.requireNewFarmer !== false,
      requireFarmerVerified: payload.requireFarmerVerified !== false,
      requireFieldVerified: payload.requireFieldVerified !== false,
      requireEvidence: payload.requireEvidence !== false,
      requireAgronomistEngagement: payload.requireAgronomistEngagement !== false,
      existingFarmerHours: Number(
        payload.existingFarmerHours ?? DEFAULT_INTRODUCTION_RULE.existingFarmerHours
      ),
      versionId: row?.id ? String(row.id) : null,
    };
  },

  async partnerKpiWeights(asOf?: Date): Promise<{ versionId: string | null; parameters: KpiParameter[] }> {
    const row = await loadActive('partner_kpi_weights', asOf);
    return {
      versionId: row?.id ? String(row.id) : null,
      parameters: asParameters(row?.payload, DEFAULT_PARTNER_KPI_WEIGHTS),
    };
  },

  async agronomistKpiWeights(asOf?: Date): Promise<{
    versionId: string | null;
    qualifiedCaseTarget: number;
    parameters: KpiParameter[];
  }> {
    const row = await loadActive('agronomist_kpi', asOf);
    const payload = (row?.payload ?? {}) as { qualifiedCaseTarget?: number; parameters?: KpiParameter[] };
    return {
      versionId: row?.id ? String(row.id) : null,
      qualifiedCaseTarget: Number(payload.qualifiedCaseTarget ?? 300),
      parameters: asParameters(payload, DEFAULT_AGRONOMIST_KPI_WEIGHTS),
    };
  },

  async qualifiedCaseRule(asOf?: Date): Promise<QualifiedCaseRule & { versionId: string | null }> {
    const row = await loadActive('qualified_case', asOf);
    const payload = (row?.payload ?? {}) as Partial<QualifiedCaseRule>;
    return {
      ...DEFAULT_QUALIFIED_CASE_RULE,
      ...payload,
      versionId: row?.id ? String(row.id) : null,
    };
  },

  async diagnosisQaRule(asOf?: Date): Promise<DiagnosisQaRule & { versionId: string | null }> {
    const row = await loadActive('diagnosis_qa', asOf);
    const payload = (row?.payload ?? {}) as Partial<DiagnosisQaRule>;
    return {
      sampleRatePct: Number(payload.sampleRatePct ?? DEFAULT_DIAGNOSIS_QA_RULE.sampleRatePct),
      sampleCap: Number(payload.sampleCap ?? DEFAULT_DIAGNOSIS_QA_RULE.sampleCap),
      versionId: row?.id ? String(row.id) : null,
    };
  },

  async list() {
    const { data } = await supabase
      .from('earning_rule_versions')
      .select('*')
      .order('rule_type')
      .order('version_number', { ascending: false });
    return data ?? [];
  },

  async get(id: string) {
    return getRow(id);
  },

  async createVersion(input: {
    ruleType: RuleType;
    payload: Record<string, unknown>;
    effectiveFrom: string;
    changeReason: string;
    createdBy?: string | null;
  }) {
    if (!(RULE_TYPES as readonly string[]).includes(input.ruleType)) {
      throw new ValidationError(`Unknown rule type ${input.ruleType}`);
    }
    if (input.ruleType === 'partner_kpi_weights' || input.ruleType === 'agronomist_kpi') {
      validateWeights(asParameters(input.payload, []));
    }
    const { data: latest } = await supabase
      .from('earning_rule_versions')
      .select('version_number')
      .eq('rule_type', input.ruleType)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const versionNumber = Number(latest?.version_number ?? 0) + 1;
    const { data, error } = await supabase
      .from('earning_rule_versions')
      .insert({
        rule_type: input.ruleType,
        version_number: versionNumber,
        effective_from: input.effectiveFrom,
        status: 'draft',
        payload: input.payload,
        change_reason: input.changeReason,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create earning rule version');
    return data as RuleRow;
  },

  async updateDraft(
    id: string,
    patch: { payload?: Record<string, unknown>; effectiveFrom?: string; changeReason?: string }
  ) {
    const row = await getRow(id);
    if (!isMutableStatus(row.status)) {
      throw new ConflictError('Only draft versions can be edited. Create a new version instead.');
    }
    if (patch.payload && (row.rule_type === 'partner_kpi_weights' || row.rule_type === 'agronomist_kpi')) {
      validateWeights(asParameters(patch.payload, []));
    }
    const { data, error } = await supabase
      .from('earning_rule_versions')
      .update({
        payload: patch.payload ?? row.payload,
        effective_from: patch.effectiveFrom ?? row.effective_from,
        change_reason: patch.changeReason ?? row.change_reason,
      })
      .eq('id', id)
      .eq('status', 'draft')
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not update draft rule');
    if (!data) throw new ConflictError('Draft was already submitted');
    return data as RuleRow;
  },

  async transition(id: string, to: 'submitted' | 'approved' | 'scheduled' | 'active' | 'draft', actor?: string) {
    const row = await getRow(id);
    try {
      assertTransition(row.status, to);
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Invalid rule transition');
    }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: to };
    if (to === 'submitted') patch.submitted_at = now;
    if (to === 'approved') {
      patch.approved_at = now;
      patch.approved_by = actor ?? null;
    }
    if (to === 'active') {
      if (!shouldActivateNow(row.effective_from)) {
        throw new ValidationError('effective_from is in the future — schedule it instead of activating');
      }
      await expireOverlapping(row.rule_type as RuleType, row.effective_from, row.id);
      patch.activated_at = now;
      patch.approved_by = row.approved_by ?? actor ?? null;
    }
    const { data, error } = await supabase
      .from('earning_rule_versions')
      .update(patch)
      .eq('id', id)
      .eq('status', row.status)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not transition earning rule');
    if (!data) throw new ConflictError('Rule status already changed');
    return data as RuleRow;
  },

  async listLocks(month?: string) {
    let q = supabase.from('kpi_period_locks').select('*').order('period_month', { ascending: false });
    if (month) q = q.eq('period_month', month);
    const { data } = await q.limit(200);
    return data ?? [];
  },

  async freezeMonth(month: string, frozenBy?: string | null) {
    const asOf = monthLastDay(month);
    const frozen: Array<Record<string, unknown>> = [];
    for (const ruleType of RULE_TYPES) {
      const { data: existing } = await supabase
        .from('kpi_period_locks')
        .select('*')
        .eq('period_month', month)
        .eq('rule_type', ruleType)
        .maybeSingle();
      if (existing) {
        frozen.push(existing);
        continue;
      }
      const row = await lookupEffective(ruleType, asOf);
      if (!row) continue;
      const { data, error } = await supabase
        .from('kpi_period_locks')
        .insert({
          period_month: month,
          rule_type: ruleType,
          rule_version_id: row.id,
          frozen_by: frozenBy ?? 'system',
        })
        .select('*')
        .single();
      if (error && error.code === '23505') {
        const { data: again } = await supabase
          .from('kpi_period_locks')
          .select('*')
          .eq('period_month', month)
          .eq('rule_type', ruleType)
          .maybeSingle();
        if (again) frozen.push(again);
        continue;
      }
      throwIfSupabaseError(error, 'Could not freeze KPI period');
      if (data) frozen.push(data);
    }
    return frozen;
  },

  async freezePreviousMonth(asOf = new Date(), frozenBy?: string | null) {
    return this.freezeMonth(previousMonth(asOf), frozenBy ?? 'system');
  },
};

async function expireOverlapping(ruleType: RuleType, effectiveFrom: string, keepId: string) {
  const { data: actives } = await supabase
    .from('earning_rule_versions')
    .select('id, effective_from, effective_to')
    .eq('rule_type', ruleType)
    .eq('status', 'active')
    .neq('id', keepId);
  for (const row of actives ?? []) {
    const closeOn = new Date(`${effectiveFrom}T00:00:00Z`);
    closeOn.setUTCDate(closeOn.getUTCDate() - 1);
    const effectiveTo = closeOn.toISOString().slice(0, 10);
    await supabase
      .from('earning_rule_versions')
      .update({
        status: 'expired',
        effective_to: row.effective_to && String(row.effective_to) < effectiveTo ? row.effective_to : effectiveTo,
      })
      .eq('id', row.id)
      .eq('status', 'active');
  }
}
