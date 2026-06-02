import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import type { AdvisoryLanguage } from '../ai/types.js';

export const terminologyEscalationService = {
  /**
   * Stage 4 — create or bump priority for unknown regional word (does not guess meaning).
   */
  async escalateUnknown(params: {
    farmerId: string;
    unknownWord: string;
    rawMessage: string;
    language: AdvisoryLanguage;
    cropType?: string | null;
    district?: string | null;
    employeeId?: string | null;
  }): Promise<{ taskId: string; created: boolean }> {
    const term = params.unknownWord.trim().slice(0, 120);
    const termKey = term.toLowerCase();

    const { data: existing } = await supabase
      .from('terminology_review_tasks')
      .select('id, occurrence_count, priority_score')
      .eq('term', termKey)
      .in('status', ['open', 'in_review'])
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const count = Number(existing.occurrence_count ?? 1) + 1;
      const { data, error } = await supabase
        .from('terminology_review_tasks')
        .update({
          occurrence_count: count,
          priority_score: count,
          raw_message: params.rawMessage.slice(0, 500),
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      throwIfSupabaseError(error, 'Could not update terminology escalation');
      await this.recordPattern(params.farmerId, termKey, params.language);
      return { taskId: String(data?.id ?? existing.id), created: false };
    }

    const { data, error } = await supabase
      .from('terminology_review_tasks')
      .insert({
        farmer_id: params.farmerId,
        term: termKey,
        unknown_word: term,
        raw_message: params.rawMessage.slice(0, 500),
        language: params.language,
        crop_type: params.cropType ?? null,
        district: params.district ?? null,
        employee_id: params.employeeId ?? null,
        context_text: params.rawMessage.slice(0, 500),
        status: 'open',
        occurrence_count: 1,
        priority_score: 1,
        ai_confidence_reduced: true,
      })
      .select('id')
      .single();

    throwIfSupabaseError(error, 'Could not create terminology escalation');
    await this.recordPattern(params.farmerId, termKey, params.language);
    return { taskId: String(data!.id), created: true };
  },

  async recordPattern(farmerId: string, term: string, language: string): Promise<void> {
    const { data: row } = await supabase
      .from('farmer_language_patterns')
      .select('usage_count')
      .eq('farmer_id', farmerId)
      .eq('term', term.toLowerCase())
      .eq('language', language)
      .maybeSingle();

    const count = (row?.usage_count ?? 0) + 1;
    await supabase.from('farmer_language_patterns').upsert(
      {
        farmer_id: farmerId,
        term: term.toLowerCase(),
        language,
        usage_count: count,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'farmer_id,term,language' }
    );
  },

  async recordLearningHistory(params: {
    term: string;
    language: string;
    meaning: string;
    standardTerm?: string | null;
    cropType?: string | null;
    district?: string | null;
    action: 'approved' | 'rejected' | 'updated' | 'auto_learned';
    taskId?: string | null;
    farmerId?: string | null;
    approvedBy?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('terminology_learning_history').insert({
      term: params.term.toLowerCase(),
      language: params.language,
      crop_type: params.cropType ?? null,
      district: params.district ?? null,
      meaning: params.meaning,
      standard_term: params.standardTerm ?? null,
      action: params.action,
      task_id: params.taskId ?? null,
      farmer_id: params.farmerId ?? null,
      approved_by: params.approvedBy ?? null,
      metadata: params.metadata ?? {},
    });
    throwIfSupabaseError(error, 'Could not record terminology learning history');
  },
};
