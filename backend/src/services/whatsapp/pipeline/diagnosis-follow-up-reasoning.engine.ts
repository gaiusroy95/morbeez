import type { AdvisoryLanguage } from '../../ai/types.js';
import type { DiseaseWeatherPrior } from './disease-weather-rules.service.js';
import type { SimilarLearnedCase } from './diagnosis-follow-up.service.js';
import type { LearnedInvestigationPattern } from './diagnosis-follow-up-question.generator.js';
import {
  formatChoiceAnswerLabel,
  type FollowUpChoiceOption,
} from './follow-up-question.types.js';

export type InvestigationContext = {
  language: AdvisoryLanguage;
  cropType: string;
  symptomsText: string;
  hasPhoto: boolean;
  dap?: number;
  similarCases: SimilarLearnedCase[];
  totalVerifiedCases: number;
  matchConfidence: number;
  bestIssueLabel?: string;
  heavyRainLikely: boolean;
  highHumidityLikely: boolean;
  highHeatLikely: boolean;
  weatherRiskScore: number;
  diseasePriors: DiseaseWeatherPrior[];
  lastSprayKnown: boolean;
  category: string;
  learnedPatterns: LearnedInvestigationPattern[];
};

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function resolveMatchConfidenceBand(score: number): ConfidenceBand {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

export function needsMoreEvidence(ctx: InvestigationContext): boolean {
  if (!ctx.hasPhoto) return true;
  if (ctx.matchConfidence < 0.85) return true;
  if (ctx.category === 'unknown_low_conf') return true;
  return false;
}

export function shouldSkipFollowUpIntake(ctx: InvestigationContext): boolean {
  return ctx.matchConfidence >= 0.9 && ctx.hasPhoto && !needsMoreEvidence(ctx);
}

function formatAnswerHuman(
  ans: string,
  choices?: FollowUpChoiceOption[],
  lang: AdvisoryLanguage = 'en'
): string {
  if (choices?.length) return formatChoiceAnswerLabel(ans, choices, lang);
  if (ans === 'yes') return 'Yes';
  if (ans === 'no') return 'No';
  if (ans === 'skip') return 'Skipped';
  if (ans === 'within_7d') return 'Within last 7 days';
  if (ans === 'over_14d') return '14+ days ago';
  if (ans === 'never') return 'Not yet / no spray';
  if (ans === 'unsure') return 'Unsure';
  return ans;
}

export const diagnosisFollowUpReasoningEngine = {
  resolveMatchConfidenceBand,
  shouldSkipFollowUpIntake,
  needsMoreEvidence,

  buildIntro(ctx: InvestigationContext): string {
    const count = Math.max(ctx.similarCases.length, ctx.totalVerifiedCases);
    const band = resolveMatchConfidenceBand(ctx.matchConfidence);
    const issue = ctx.bestIssueLabel;
    const patternHint =
      ctx.learnedPatterns.length > 0
        ? ctx.language === 'ml'
          ? '\n\nസമാന കേസുകളിൽ സഹായിച്ച ചോദ്യങ്ങൾ അടിസ്ഥാനമാക്കി AI അടുത്ത ചോദ്യം തയ്യാറാക്കും.'
          : '\n\nAI will ask tailored questions based on what helped in similar verified cases.'
        : '';

    if (ctx.language === 'ml') {
      const caseLine =
        count > 0
          ? `മോർബീസിൽ ഈ ${ctx.cropType} വിളയിൽ ${count}+ വിജയകരമായ സമാന കേസുകൾ ഉണ്ട്.`
          : 'നിങ്ങളുടെ പ്രശ്നം കൃത്യമായി മനസ്സിലാക്കാൻ ചില ചോദ്യങ്ങൾ ചോദിക്കുന്നു.';
      const matchLine = issue ? `\nഏറ്റവും അടുത്ത പ്രശ്നം: ${issue}.` : '';
      const weatherLine = ctx.highHumidityLikely
        ? '\nഈ ആഴ്ച ഉയർന്ന humidity — fungal/blast അപകടം കൂടാം.'
        : ctx.heavyRainLikely
          ? '\nമഴ അധികം — drainage/rot ശ്രദ്ധിക്കണം.'
          : '';
      const confLine =
        band === 'medium'
          ? '\n\n2–3 ചെറിയ ചോദ്യങ്ങൾ — ശരിയായ ഉപദേശം നൽകാൻ:'
          : band === 'low'
            ? '\n\nകൂടുതൽ വിവരം ശേഖരിക്കുന്നു (agronomist review ആവശ്യമാകാം):'
            : '\n\nconfirmation ചോദ്യങ്ങൾ:';
      return `${caseLine}${matchLine}${weatherLine}${confLine}${patternHint}`;
    }

    const caseLine =
      count > 0
        ? `Morbeez found ${count}+ similar successful ${ctx.cropType} cases in your region.`
        : 'A few quick questions will help give accurate advice.';
    const matchLine = issue ? `\nClosest match: ${issue}.` : '';
    const weatherLine = ctx.highHumidityLikely
      ? '\nHigh humidity this week — fungal/blast risk may be elevated.'
      : ctx.heavyRainLikely
        ? '\nHeavy rain likely — check drainage and rot signs.'
        : '';
    const confLine =
      band === 'medium'
        ? '\n\nA few one-by-one questions for the most accurate advice:'
        : band === 'low'
          ? '\n\nGathering more field evidence (agronomist review may follow):'
          : '\n\nQuick confirmation questions:';
    return `${caseLine}${matchLine}${weatherLine}${confLine}${patternHint}`;
  },

  buildPostDiagnosisIntro(params: {
    language: AdvisoryLanguage;
    probableIssue: string;
    confidence: number;
    differentialCount: number;
  }): string {
    const pct = Math.round(params.confidence * 100);
    const issue = params.probableIssue?.trim() || 'your crop issue';
    const diffHint =
      params.differentialCount > 1
        ? params.language === 'ml'
          ? ' AI അടുത്ത ചോദ്യം ഈ വിശകലനത്തിലെ ബദൽ സാധ്യതകൾ വേർതിരിക്കാൻ തയ്യാറാക്കും.'
          : ' AI will plan the next question from your diagnosis differentials — not a fixed script.'
        : params.language === 'ml'
          ? ' AI അടുത്ത ചോദ്യം ഫീൽഡ് സ്ഥിരീകരണത്തിനായി തയ്യാറാക്കും.'
          : ' AI will plan a field confirmation question from the analysis.';

    if (params.language === 'ml') {
      return `ഫോട്ടോ വിശകലനം പൂർത്തിയായി (${pct}% സാധ്യത: ${issue}). പൂർണ്ണ നിർണയം അയയ്ക്കുന്നതിന് മുമ്പ് ഒരൊന്നായി ചോദ്യങ്ങൾ:${diffHint}`;
    }
    return `Photo analysis is done (${pct}% likely: ${issue}). A few one-by-one questions before the full diagnosis:${diffHint}`;
  },

  enrichSymptomsFromAnswers(
    initial: string,
    answers: Record<string, string>,
    questionTexts: Record<string, string>,
    questionChoices: Record<string, FollowUpChoiceOption[]>,
    ctx: InvestigationContext
  ): string {
    const parts = [initial.trim()];
    for (const [qid, ans] of Object.entries(answers)) {
      if (ans === 'skip') continue;
      const q = questionTexts[qid] ?? qid;
      parts.push(
        `Follow-up "${q}" → ${formatAnswerHuman(ans, questionChoices[qid], ctx.language)}`
      );
    }
    if (ctx.bestIssueLabel) parts.push(`Closest learned case: ${ctx.bestIssueLabel}`);
    if (ctx.heavyRainLikely) parts.push('Weather: heavy rain likely');
    if (ctx.highHumidityLikely) parts.push('Weather: high humidity');
    if (ctx.dap != null) parts.push(`Crop stage: ${ctx.dap} DAP`);
    return parts.filter(Boolean).join('. ');
  },

  formatFieldInvestigationSummary(
    answers: Record<string, string>,
    questionTexts: Record<string, string>,
    questionChoices: Record<string, FollowUpChoiceOption[]>,
    ctx: InvestigationContext
  ): string {
    const lines: string[] = [
      'FIELD INVESTIGATION — farmer answered AI-planned follow-up questions on WhatsApp.',
      'You MUST base probableIssue, treatments, and farmerSummary on ALL answers below.',
      'Do NOT ignore them or return a generic template that contradicts them.',
      '',
    ];

    for (const [qid, ans] of Object.entries(answers)) {
      if (ans === 'skip') continue;
      const title = questionTexts[qid] ?? qid;
      lines.push(
        `- ${title}: ${formatAnswerHuman(ans, questionChoices[qid], ctx.language)}`
      );
    }

    const holistic = this.synthesizeAllAnswersConclusion(
      ctx.symptomsText,
      answers,
      questionTexts,
      questionChoices,
      ctx
    );
    const inferred = this.inferPrimaryIssueFromIntake(
      ctx.symptomsText,
      answers,
      questionTexts,
      questionChoices,
      ctx
    );

    lines.push('');
    lines.push(`Investigation conclusion (use as probableIssue unless image strongly contradicts): ${inferred}`);
    lines.push('');
    lines.push('INTEGRATED SYNTHESIS (all answers combined — farmerSummary MUST reflect this):');
    lines.push(holistic);
    if (ctx.bestIssueLabel) {
      lines.push('');
      lines.push(`Similar verified cases in Morbeez suggested: ${ctx.bestIssueLabel}`);
    }

    return lines.join('\n');
  },

  inferPrimaryIssueFromIntake(
    initialSymptoms: string,
    answers: Record<string, string>,
    questionTexts: Record<string, string>,
    questionChoices: Record<string, FollowUpChoiceOption[]>,
    ctx: InvestigationContext
  ): string {
    if (ctx.bestIssueLabel?.trim()) {
      const confirmed = Object.entries(answers)
        .filter(([, v]) => v !== 'skip')
        .map(
          ([id, v]) =>
            `${questionTexts[id] ?? id}: ${formatAnswerHuman(v, questionChoices[id], ctx.language)}`
        )
        .slice(0, 4);
      if (confirmed.length) {
        return `${ctx.bestIssueLabel.trim()} — confirmed by: ${confirmed.join('; ')}`;
      }
      return ctx.bestIssueLabel.trim();
    }
    if (Object.keys(answers).length) {
      return `Field issue (${initialSymptoms.trim().slice(0, 80)}) — resolve using all investigation answers and image`;
    }
    return 'Field issue — resolve using investigation answers and image';
  },

  synthesizeAllAnswersConclusion(
    initialSymptoms: string,
    answers: Record<string, string>,
    questionTexts: Record<string, string>,
    questionChoices: Record<string, FollowUpChoiceOption[]>,
    ctx: InvestigationContext
  ): string {
    const parts: string[] = [];
    parts.push(`Original complaint: ${initialSymptoms.trim().slice(0, 200)}.`);

    const facts = Object.entries(answers)
      .filter(([, ans]) => ans !== 'skip')
      .map(
        ([id, ans]) =>
          `${questionTexts[id] ?? id}: ${formatAnswerHuman(ans, questionChoices[id], ctx.language)}`
      );

    if (facts.length) {
      parts.push(`All follow-up answers together: ${facts.join('; ')}.`);
    } else {
      parts.push('No follow-up answers recorded.');
    }

    if (ctx.heavyRainLikely) parts.push('Regional weather: heavy rain likely.');
    if (ctx.highHumidityLikely) parts.push('Regional weather: high humidity this week.');

    const issue = this.inferPrimaryIssueFromIntake(
      initialSymptoms,
      answers,
      questionTexts,
      questionChoices,
      ctx
    );
    parts.push(
      `Integrated conclusion (must reflect ALL answers above, not just the first symptom): ${issue}.`
    );

    return parts.join(' ');
  },
};

export type PostIntakeDiagnosisPayload = {
  enrichedSymptoms: string;
  fieldInvestigation: string;
  issueLabelHint: string;
  skipReuseCache: true;
  investigationPattern?: LearnedInvestigationPattern;
};
