import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { monthLastDay, monthRange } from '../../domain/remuneration/rule-workflow.js';
import { scoreWeightedKpi } from '../../domain/remuneration/weighted-kpi.js';
import { earningRulesService } from './earning-rules.service.js';
import { diagnosisQaService } from './diagnosis-qa.service.js';

export const agronomistKpiService = {
  async list(month: string) {
    const { data } = await supabase
      .from('agronomist_kpi_snapshots')
      .select('*')
      .eq('period_month', month)
      .order('performance_score', { ascending: false })
      .limit(200);
    return data ?? [];
  },

  async recomputeMonth(month: string) {
    const asOf = monthLastDay(month);
    const rule = await earningRulesService.agronomistKpiWeights(asOf);
    const { startIso, endIso } = monthRange(month);

    const { data: cases } = await supabase
      .from('qualified_cases')
      .select('agronomist_email, qualified')
      .eq('period_month', month)
      .eq('qualified', true);
    const counts = new Map<string, number>();
    for (const row of cases ?? []) {
      const email = String(row.agronomist_email ?? '').trim().toLowerCase();
      if (!email) continue;
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }

    const { data: orders } = await supabase
      .from('commerce_orders')
      .select('attributed_agronomist_email, total_amount')
      .eq('incentive_eligibility', 'eligible')
      .gte('incentive_eligible_at', startIso)
      .lte('incentive_eligible_at', endIso);
    const sales = new Map<string, number>();
    for (const row of orders ?? []) {
      const email = String(row.attributed_agronomist_email ?? '').trim().toLowerCase();
      if (!email) continue;
      sales.set(email, (sales.get(email) ?? 0) + Number(row.total_amount ?? 0));
    }

    const emails = new Set([...counts.keys(), ...sales.keys()]);
    const saved = [];
    for (const email of emails) {
      const qa = await diagnosisQaService.summary(month, email);
      const actuals = {
        qualified_cases: counts.get(email) ?? 0,
        diagnosis_accuracy: qa.accuracyPct,
        eligible_sales: sales.get(email) ?? 0,
      };
      const scored = scoreWeightedKpi(rule.parameters, actuals);
      const row = {
        agronomist_email: email,
        period_month: month,
        qualified_case_count: actuals.qualified_cases,
        diagnosis_accuracy_pct: actuals.diagnosis_accuracy,
        eligible_sales_inr: actuals.eligible_sales,
        performance_score: scored.total,
        lines: scored.lines,
        rule_version_id: rule.versionId,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('agronomist_kpi_snapshots')
        .upsert(row, { onConflict: 'agronomist_email,period_month' })
        .select('*')
        .single();
      throwIfSupabaseError(error, 'Could not save agronomist KPI');
      saved.push(data);
    }
    return saved;
  },
};
