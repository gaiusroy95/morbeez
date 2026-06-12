import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

const CATEGORY_PREFIX: Record<string, string> = {
  disease: 'DIS',
  pest: 'PST',
  nutrient_deficiency: 'NUT',
  growth_issue: 'GRW',
  weather_impact: 'WTH',
  general: 'GEN',
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function overlapScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const w of a) if (setB.has(w)) hits += 1;
  return hits / Math.max(a.length, b.length);
}

async function nextConceptCode(category: string): Promise<string> {
  const prefix = CATEGORY_PREFIX[category] ?? 'GEN';
  const { data, error } = await supabase
    .from('agronomy_concepts')
    .select('concept_code')
    .like('concept_code', `${prefix}%`)
    .order('concept_code', { ascending: false })
    .limit(1);
  throwIfSupabaseError(error, 'Could not load concept codes');
  const last = data?.[0]?.concept_code;
  const num = last ? parseInt(String(last).replace(/\D/g, ''), 10) || 0 : 0;
  return `${prefix}${String(num + 1).padStart(3, '0')}`;
}

export const terminologyConceptSuggestService = {
  async suggestForTask(params: {
    term: string;
    rawMessage: string;
    language?: string | null;
  }): Promise<{ conceptId: string | null; conceptName: string | null; confidence: number }> {
    const haystack = `${params.term} ${params.rawMessage}`.trim();
    const tokens = tokenize(haystack);
    if (!tokens.length) return { conceptId: null, conceptName: null, confidence: 0 };

    const [{ data: concepts, error: cErr }, { data: terms, error: tErr }] = await Promise.all([
      supabase.from('agronomy_concepts').select('id, name, category, concept_code'),
      supabase
        .from('agronomy_terms')
        .select('term, standard_term, meaning, concept_id, agronomy_concepts(id, name)')
        .eq('status', 'active')
        .limit(500),
    ]);
    throwIfSupabaseError(cErr, 'Could not load concepts for suggestion');
    throwIfSupabaseError(tErr, 'Could not load terms for suggestion');

    let best: { conceptId: string | null; conceptName: string; confidence: number } | null = null;

    for (const c of concepts ?? []) {
      const name = String(c.name);
      const score = overlapScore(tokens, tokenize(name));
      if (score >= 0.25 && (!best || score > best.confidence)) {
        best = { conceptId: String(c.id), conceptName: name, confidence: Math.min(0.95, 0.5 + score * 0.5) };
      }
    }

    for (const t of terms ?? []) {
      const labels = [t.term, t.standard_term, t.meaning].filter(Boolean).map(String);
      for (const label of labels) {
        const score = overlapScore(tokens, tokenize(label));
        if (score >= 0.35) {
          const rawConcept = t.agronomy_concepts as unknown;
          const concept = (Array.isArray(rawConcept) ? rawConcept[0] : rawConcept) as
            | { id: string; name: string }
            | null
            | undefined;
          const conceptName = concept?.name ?? String(t.standard_term ?? t.meaning ?? t.term);
          const conceptId = concept?.id ? String(concept.id) : t.concept_id ? String(t.concept_id) : null;
          const confidence = Math.min(0.92, 0.55 + score * 0.45);
          if (!best || confidence > best.confidence) {
            best = { conceptId, conceptName, confidence };
          }
        }
      }
    }

    return best ?? { conceptId: null, conceptName: null, confidence: 0 };
  },

  async attachSuggestionToTask(taskId: string): Promise<void> {
    const { data: task, error } = await supabase
      .from('terminology_review_tasks')
      .select('id, term, raw_message, context_text, language')
      .eq('id', taskId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load task for suggestion');
    if (!task) return;

    const suggestion = await this.suggestForTask({
      term: String(task.term),
      rawMessage: String(task.raw_message ?? task.context_text ?? task.term),
      language: task.language ? String(task.language) : null,
    });

    if (!suggestion.conceptName || suggestion.confidence < 0.4) return;

    await supabase
      .from('terminology_review_tasks')
      .update({
        ai_suggested_concept_id: suggestion.conceptId,
        ai_suggested_concept_name: suggestion.conceptName,
        confidence_score: suggestion.confidence,
      })
      .eq('id', taskId);
  },

  nextConceptCode,
};
