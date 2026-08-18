import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  DEFAULT_DIAGNOSIS_QA_RULE,
  diagnosisAccuracyPct,
  diagnosisQaSampleSize,
  pickSample,
} from '../../domain/remuneration/diagnosis-qa.js';
import { monthLastDay } from '../../domain/remuneration/rule-workflow.js';
import { earningRulesService } from './earning-rules.service.js';

export const diagnosisQaService = {
  async list(month: string) {
    const { data } = await supabase
      .from('diagnosis_qa_samples')
      .select('*')
      .eq('period_month', month)
      .order('created_at', { ascending: false })
      .limit(200);
    return data ?? [];
  },

  async summary(month: string, agronomistEmail?: string) {
    let q = supabase
      .from('diagnosis_qa_samples')
      .select('status, agronomist_email')
      .eq('period_month', month);
    if (agronomistEmail) q = q.eq('agronomist_email', agronomistEmail.toLowerCase());
    const { data } = await q;
    const rows = data ?? [];
    const accurate = rows.filter((r) => r.status === 'accurate').length;
    const inaccurate = rows.filter((r) => r.status === 'inaccurate').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const skipped = rows.filter((r) => r.status === 'skipped').length;
    return {
      sampled: rows.length,
      pending,
      skipped,
      accurate,
      inaccurate,
      accuracyPct: diagnosisAccuracyPct(accurate, inaccurate),
    };
  },

  async draw(month: string, force = false) {
    const rule = await earningRulesService.diagnosisQaRule(monthLastDay(month));
    if (!force) {
      const { count } = await supabase
        .from('diagnosis_qa_samples')
        .select('id', { count: 'exact', head: true })
        .eq('period_month', month);
      if ((count ?? 0) > 0) {
        return { drawn: 0, existing: count ?? 0, month };
      }
    } else {
      await supabase.from('diagnosis_qa_samples').delete().eq('period_month', month).eq('status', 'pending');
    }

    const { data: qualified } = await supabase
      .from('qualified_cases')
      .select('id, source_type, source_id, agronomist_email')
      .eq('period_month', month)
      .eq('qualified', true);
    const pool = qualified ?? [];
    const size = diagnosisQaSampleSize(pool.length, {
      sampleRatePct: rule.sampleRatePct ?? DEFAULT_DIAGNOSIS_QA_RULE.sampleRatePct,
      sampleCap: rule.sampleCap ?? DEFAULT_DIAGNOSIS_QA_RULE.sampleCap,
    });
    const picked = pickSample(pool, size, `diagnosis-qa:${month}`);
    if (!picked.length) return { drawn: 0, existing: 0, month, sampleSize: size };

    const { error } = await supabase.from('diagnosis_qa_samples').insert(
      picked.map((row) => ({
        period_month: month,
        qualified_case_id: row.id,
        source_type: row.source_type,
        source_id: row.source_id,
        agronomist_email: row.agronomist_email,
        status: 'pending',
        rule_version_id: rule.versionId,
      }))
    );
    throwIfSupabaseError(error, 'Could not draw diagnosis QA sample');
    return { drawn: picked.length, existing: 0, month, sampleSize: size, ruleVersionId: rule.versionId };
  },

  async ensureSample(month: string) {
    return this.draw(month, false);
  },

  async audit(id: string, input: { status: 'accurate' | 'inaccurate' | 'skipped'; notes?: string; auditor?: string }) {
    if (!['accurate', 'inaccurate', 'skipped'].includes(input.status)) {
      throw new ValidationError('QA status must be accurate, inaccurate, or skipped');
    }
    const { data: row } = await supabase.from('diagnosis_qa_samples').select('*').eq('id', id).maybeSingle();
    if (!row) throw new NotFoundError('QA sample not found');
    if (row.status !== 'pending') throw new ConflictError('This sample was already audited');
    const { data, error } = await supabase
      .from('diagnosis_qa_samples')
      .update({
        status: input.status,
        notes: input.notes ?? null,
        audited_by: input.auditor ?? null,
        audited_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not save QA audit');
    if (!data) throw new ConflictError('This sample was already audited');
    return data;
  },
};
