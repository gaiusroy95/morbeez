/**
 * After "AI is wrong", refine the farmer's free-text hypothesis into ranked conditions.
 * Conditions and probabilities come from the LLM using session context — not hardcoded disease lists.
 */
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { isFarmerSuggestionButtonId } from '../../domain/learning/farmer-nutrient-suggestions.js';
import { supabase } from '../../lib/supabase.js';
import { AppError } from '../../lib/errors.js';

export type RefinedConditionRole = 'primary' | 'contributing' | 'secondary' | 'possible';

export type RefinedCondition = {
  label: string;
  /** 0–1 */
  probability: number;
  role: RefinedConditionRole;
  reason: string;
};

export type FarmerHypothesisRefineResult = {
  conditions: RefinedCondition[];
  sequenceSummary: string;
  replyToFarmer: string;
  source: 'llm';
};

type LlmRefineJson = {
  conditions?: Array<{
    label?: string;
    probability?: number;
    role?: string;
    reason?: string;
  }>;
  sequenceSummary?: string;
  farmerReplyEn?: string;
  farmerReplyMl?: string;
};

/** Free-typed theory (not a WhatsApp chip / button id). */
export function looksLikeDescriptiveHypothesis(raw: string): boolean {
  const t = raw.trim();
  if (!t || isFarmerSuggestionButtonId(t)) return false;
  if (/^feedback\./i.test(t)) return false;
  // Any open answer with real content — LLM decides what conditions exist.
  return t.length >= 12;
}

function clampProb(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n > 1 && n <= 100) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

function normalizeRole(raw: string | undefined, index: number): RefinedConditionRole {
  const r = (raw ?? '').toLowerCase().trim();
  if (r === 'primary' || r.includes('primary')) return 'primary';
  if (r === 'contributing' || r.includes('contribut')) return 'contributing';
  if (r === 'secondary' || r.includes('second')) return 'secondary';
  if (r === 'possible' || r.includes('possible')) return 'possible';
  if (index === 0) return 'primary';
  return 'possible';
}

function formatPct(p: number): string {
  return `${Math.round(clampProb(p) * 100)}%`;
}

function formatWhatsAppAssessment(
  lang: AdvisoryLanguage,
  conditions: RefinedCondition[],
  sequenceSummary: string
): string {
  const lines = conditions.slice(0, 6).map((c, i) => {
    const role =
      c.role === 'primary'
        ? 'Primary'
        : c.role === 'contributing'
          ? 'Contributing'
          : c.role === 'secondary'
            ? 'Secondary'
            : 'Possible';
    return `${i + 1}) ${c.label} — ${role} (${formatPct(c.probability)})`;
  });

  if (lang === 'ml') {
    return [
      'നിങ്ങളുടെ അഭിപ്രായം പരിഗണിച്ചു. ഫോട്ടോകളും നിങ്ങളുടെ വിവരണവും അടിസ്ഥാനമാക്കി ഞങ്ങളുടെ വിലയിരുത്തൽ:',
      '',
      ...lines,
      sequenceSummary ? `\nക്രമം: ${sequenceSummary}` : '',
      '',
      'അഗ്രോണമിസ്റ്റ് ഇത് സ്ഥിരീകരിക്കും. കുറച്ച് ചോദ്യങ്ങൾ കൂടി…',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'Thanks — your field theory is noted. Based on the photos and your description, here is our refined assessment:',
    '',
    ...lines,
    sequenceSummary ? `\nLikely sequence: ${sequenceSummary}` : '',
    '',
    'An agronomist will verify this. A few quick follow-up questions…',
  ]
    .filter(Boolean)
    .join('\n');
}

async function loadPriorAdvisory(sessionId: string | null): Promise<{
  probableIssue: string | null;
  imageObservations: string[];
  differential: Array<{ label: string; probability?: number; reason?: string }>;
  cropType: string | null;
  cropStage: string | null;
  symptomsText: string | null;
  summaryEn: string | null;
  imageStoragePath: string | null;
}> {
  if (!sessionId) {
    return {
      probableIssue: null,
      imageObservations: [],
      differential: [],
      cropType: null,
      cropStage: null,
      symptomsText: null,
      summaryEn: null,
      imageStoragePath: null,
    };
  }

  const [{ data: out }, { data: sess }] = await Promise.all([
    supabase
      .from('ai_advisory_outputs')
      .select('probable_issue, farmer_summary_en, raw_response')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ai_advisory_sessions')
      .select('crop_type, crop_stage, symptoms_text, image_storage_path')
      .eq('id', sessionId)
      .maybeSingle(),
  ]);

  const raw = (out?.raw_response ?? {}) as Record<string, unknown>;
  const observations = Array.isArray(raw.imageObservations)
    ? raw.imageObservations.map((o) => String(o)).filter(Boolean).slice(0, 16)
    : [];
  const differential = Array.isArray(raw.differentialDiagnosis)
    ? (raw.differentialDiagnosis as Array<Record<string, unknown>>)
        .map((d) => ({
          label: String(d.label ?? '').trim(),
          probability: typeof d.probability === 'number' ? d.probability : undefined,
          reason: d.reason != null ? String(d.reason) : undefined,
        }))
        .filter((d) => d.label)
    : [];

  return {
    probableIssue: out?.probable_issue ? String(out.probable_issue) : null,
    imageObservations: observations,
    differential,
    cropType: sess?.crop_type ? String(sess.crop_type) : null,
    cropStage: sess?.crop_stage ? String(sess.crop_stage) : null,
    symptomsText: sess?.symptoms_text ? String(sess.symptoms_text) : null,
    summaryEn: out?.farmer_summary_en ? String(out.farmer_summary_en) : null,
    imageStoragePath: sess?.image_storage_path ? String(sess.image_storage_path) : null,
  };
}

function parseLlmResult(json: LlmRefineJson, lang: AdvisoryLanguage): FarmerHypothesisRefineResult {
  const conditions = (json.conditions ?? [])
    .map((c, i) => {
      const label = String(c.label ?? '').trim();
      if (!label) return null;
      return {
        label: label.slice(0, 160),
        probability: clampProb(Number(c.probability)),
        role: normalizeRole(c.role, i),
        reason: String(c.reason ?? '').slice(0, 320),
      } satisfies RefinedCondition;
    })
    .filter((c): c is RefinedCondition => Boolean(c))
    .slice(0, 6);

  if (!conditions.length) {
    throw new AppError('Refine returned no conditions', 502, 'REFINE_EMPTY');
  }

  // Keep LLM ordering; only force primary on the highest-probability item if roles missing.
  conditions.sort((a, b) => b.probability - a.probability);
  const hasPrimary = conditions.some((c) => c.role === 'primary');
  if (!hasPrimary && conditions[0]) conditions[0].role = 'primary';

  const sequenceSummary = String(json.sequenceSummary ?? '').trim().slice(0, 500);
  const customReply =
    lang === 'ml'
      ? String(json.farmerReplyMl ?? '').trim()
      : String(json.farmerReplyEn ?? '').trim();

  return {
    conditions,
    sequenceSummary,
    replyToFarmer: customReply || formatWhatsAppAssessment(lang, conditions, sequenceSummary),
    source: 'llm',
  };
}

export const farmerHypothesisRefineService = {
  looksLikeDescriptiveHypothesis,

  async refine(params: {
    farmerText: string;
    sessionId: string | null;
    lang: AdvisoryLanguage;
    priorAiIssue?: string | null;
  }): Promise<FarmerHypothesisRefineResult> {
    const prior = await loadPriorAdvisory(params.sessionId);
    const priorIssue = params.priorAiIssue ?? prior.probableIssue;

    const system = [
      'You are an agronomy assistant refining a farmer correction after they disagreed with an AI crop diagnosis.',
      'Use ONLY the session context + farmer text provided. Do not invent crop-specific stock answers.',
      'Extract every distinct condition the farmer means (nutrient, disease, pest, stress, etc.).',
      'Then score each against the photo/session evidence with calibrated probabilities from 0 to 1.',
      'If photos contradict the farmer on a condition, lower its probability and explain in reason.',
      'If photos support a condition the farmer did not name, you may add it with role contributing/possible.',
      'Return JSON only with keys:',
      'conditions: [{label, probability, role, reason}],',
      'sequenceSummary: short causal sequence if useful,',
      'farmerReplyEn, farmerReplyMl: WhatsApp-friendly ranked list with % (no markdown tables).',
      'role must be one of: primary | contributing | secondary | possible.',
    ].join(' ');

    const user = [
      `Crop type: ${prior.cropType ?? 'unknown'}`,
      `Crop stage: ${prior.cropStage ?? 'unknown'}`,
      `Session has image path: ${prior.imageStoragePath ? 'yes' : 'no'}`,
      `Prior AI probable issue: ${priorIssue ?? 'unknown'}`,
      prior.symptomsText ? `Original symptoms text: ${prior.symptomsText.slice(0, 500)}` : null,
      prior.summaryEn ? `Prior AI farmer summary: ${prior.summaryEn.slice(0, 800)}` : null,
      prior.imageObservations.length
        ? `Photo observations from prior diagnosis:\n${prior.imageObservations.map((o) => `- ${o}`).join('\n')}`
        : 'Photo observations: not separately stored — infer carefully from prior AI summary/differentials only.',
      prior.differential.length
        ? `Prior AI differentials:\n${prior.differential
            .slice(0, 6)
            .map(
              (d) =>
                `- ${d.label}${d.probability != null ? ` (${Math.round(d.probability * 100)}%)` : ''}${
                  d.reason ? `: ${d.reason}` : ''
                }`
            )
            .join('\n')}`
        : null,
      `Farmer hypothesis (free text):\n${params.farmerText.slice(0, 1500)}`,
      'Output calibrated ranked conditions now.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const json = await openaiJsonCompletion<LlmRefineJson>(system, user, 1100, {
      temperature: 0.15,
    });
    return parseLlmResult(json, params.lang);
  },
};
