import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { DEFAULT_AGRONOMIST_SLABS, DEFAULT_KPI_FACTOR_BANDS, } from '../../domain/remuneration/kpi-factor.js';
import { DEFAULT_SETTLEMENT_RULE, } from '../../domain/remuneration/settlement-split.js';
import { DEFAULT_INTRODUCTION_RULE, } from '../../domain/remuneration/introduction-eligibility.js';
import { DEFAULT_AGRONOMIST_KPI_WEIGHTS, DEFAULT_PARTNER_KPI_WEIGHTS, validateWeights, } from '../../domain/remuneration/weighted-kpi.js';
import { DEFAULT_QUALIFIED_CASE_RULE, } from '../../domain/remuneration/qualified-case.js';
import { DEFAULT_DIAGNOSIS_QA_RULE, } from '../../domain/remuneration/diagnosis-qa.js';
import { RULE_TYPES, assertTransition, isMutableStatus, monthKey, monthLastDay, previousMonth, shouldActivateNow, } from '../../domain/remuneration/rule-workflow.js';
async function lookupEffective(ruleType, asOf = new Date()) {
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
    return data ?? null;
}
async function loadLocked(ruleType, month) {
    const { data: lock } = await supabase
        .from('kpi_period_locks')
        .select('rule_version_id')
        .eq('period_month', month)
        .eq('rule_type', ruleType)
        .maybeSingle();
    if (!lock?.rule_version_id)
        return null;
    const { data } = await supabase
        .from('earning_rule_versions')
        .select('*')
        .eq('id', lock.rule_version_id)
        .maybeSingle();
    return data ?? null;
}
async function loadActive(ruleType, asOf = new Date()) {
    const locked = await loadLocked(ruleType, monthKey(asOf));
    if (locked)
        return locked;
    return lookupEffective(ruleType, asOf);
}
async function getRow(id) {
    const { data, error } = await supabase
        .from('earning_rule_versions')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not load earning rule');
    if (!data)
        throw new NotFoundError('Earning rule version not found');
    return data;
}
function asParameters(payload, fallback) {
    const raw = payload?.parameters;
    return raw?.length ? raw : fallback;
}
export const earningRulesService = {
    async partnerKpiBands(asOf) {
        const row = await loadActive('partner_kpi_factor', asOf);
        const bands = row?.payload?.bands;
        return bands?.length ? bands : DEFAULT_KPI_FACTOR_BANDS;
    },
    async agronomistSlabs(asOf) {
        const row = await loadActive('agronomist_sales_slab', asOf);
        const slabs = row?.payload?.slabs;
        return slabs?.length ? slabs : DEFAULT_AGRONOMIST_SLABS;
    },
    async settlementRule(asOf) {
        const row = await loadActive('settlement_80_20', asOf);
        const payload = (row?.payload ?? {});
        return {
            firstPct: payload.firstPct ?? DEFAULT_SETTLEMENT_RULE.firstPct,
            holdPct: payload.holdPct ?? DEFAULT_SETTLEMENT_RULE.holdPct,
            firstDelayMonths: payload.firstDelayMonths ?? DEFAULT_SETTLEMENT_RULE.firstDelayMonths,
            holdDelayMonths: payload.holdDelayMonths ?? DEFAULT_SETTLEMENT_RULE.holdDelayMonths,
        };
    },
    async returnWindowDays(asOf) {
        const row = await loadActive('eligible_sale', asOf);
        const days = Number(row?.payload?.returnWindowDays);
        return Number.isFinite(days) && days >= 0 ? days : 7;
    },
    async introductionRule(asOf) {
        const row = await loadActive('farmer_introduction', asOf);
        const payload = (row?.payload ?? {});
        return {
            minAcreage: Number(payload.minAcreage ?? DEFAULT_INTRODUCTION_RULE.minAcreage),
            cashRewardInr: Number(payload.cashRewardInr ?? DEFAULT_INTRODUCTION_RULE.cashRewardInr),
            productRewardInr: Number(payload.productRewardInr ?? DEFAULT_INTRODUCTION_RULE.productRewardInr),
            requireNewFarmer: payload.requireNewFarmer !== false,
            requireFarmerVerified: payload.requireFarmerVerified !== false,
            requireFieldVerified: payload.requireFieldVerified !== false,
            requireEvidence: payload.requireEvidence !== false,
            requireAgronomistEngagement: payload.requireAgronomistEngagement !== false,
            existingFarmerHours: Number(payload.existingFarmerHours ?? DEFAULT_INTRODUCTION_RULE.existingFarmerHours),
            versionId: row?.id ? String(row.id) : null,
        };
    },
    async partnerKpiWeights(asOf) {
        const row = await loadActive('partner_kpi_weights', asOf);
        return {
            versionId: row?.id ? String(row.id) : null,
            parameters: asParameters(row?.payload, DEFAULT_PARTNER_KPI_WEIGHTS),
        };
    },
    async agronomistKpiWeights(asOf) {
        const row = await loadActive('agronomist_kpi', asOf);
        const payload = (row?.payload ?? {});
        return {
            versionId: row?.id ? String(row.id) : null,
            qualifiedCaseTarget: Number(payload.qualifiedCaseTarget ?? 300),
            parameters: asParameters(payload, DEFAULT_AGRONOMIST_KPI_WEIGHTS),
        };
    },
    async qualifiedCaseRule(asOf) {
        const row = await loadActive('qualified_case', asOf);
        const payload = (row?.payload ?? {});
        return {
            ...DEFAULT_QUALIFIED_CASE_RULE,
            ...payload,
            versionId: row?.id ? String(row.id) : null,
        };
    },
    async diagnosisQaRule(asOf) {
        const row = await loadActive('diagnosis_qa', asOf);
        const payload = (row?.payload ?? {});
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
    async get(id) {
        return getRow(id);
    },
    async createVersion(input) {
        if (!RULE_TYPES.includes(input.ruleType)) {
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
        return data;
    },
    async updateDraft(id, patch) {
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
        if (!data)
            throw new ConflictError('Draft was already submitted');
        return data;
    },
    async transition(id, to, actor) {
        const row = await getRow(id);
        try {
            assertTransition(row.status, to);
        }
        catch (err) {
            throw new ValidationError(err instanceof Error ? err.message : 'Invalid rule transition');
        }
        const now = new Date().toISOString();
        const patch = { status: to };
        if (to === 'submitted')
            patch.submitted_at = now;
        if (to === 'approved') {
            patch.approved_at = now;
            patch.approved_by = actor ?? null;
        }
        if (to === 'active') {
            if (!shouldActivateNow(row.effective_from)) {
                throw new ValidationError('effective_from is in the future — schedule it instead of activating');
            }
            await expireOverlapping(row.rule_type, row.effective_from, row.id);
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
        if (!data)
            throw new ConflictError('Rule status already changed');
        return data;
    },
    async listLocks(month) {
        let q = supabase.from('kpi_period_locks').select('*').order('period_month', { ascending: false });
        if (month)
            q = q.eq('period_month', month);
        const { data } = await q.limit(200);
        return data ?? [];
    },
    async freezeMonth(month, frozenBy) {
        const asOf = monthLastDay(month);
        const frozen = [];
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
            if (!row)
                continue;
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
                if (again)
                    frozen.push(again);
                continue;
            }
            throwIfSupabaseError(error, 'Could not freeze KPI period');
            if (data)
                frozen.push(data);
        }
        return frozen;
    },
    async freezePreviousMonth(asOf = new Date(), frozenBy) {
        return this.freezeMonth(previousMonth(asOf), frozenBy ?? 'system');
    },
};
async function expireOverlapping(ruleType, effectiveFrom, keepId) {
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
//# sourceMappingURL=earning-rules.service.js.map