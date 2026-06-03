import type { AdvisoryLanguage } from '../../ai/types.js';
import type { DiseaseWeatherPrior } from './disease-weather-rules.service.js';
import type { SimilarLearnedCase } from './diagnosis-follow-up.service.js';

export type FollowUpQuestionKind =
  | 'yes_no'
  | 'photo'
  | 'photo_close'
  | 'photo_rhizome'
  | 'spray_timing';

export type PlannedFollowUpQuestion = {
  id: string;
  kind: FollowUpQuestionKind;
  textEn: string;
  textMl: string;
  /** Skip asking when farmer message already implies the answer */
  skipHint?: RegExp;
  /** Ask only when prior answer matches */
  afterAnswer?: { questionId: string; answer: 'yes' | 'no' };
};

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
};

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function resolveMatchConfidenceBand(score: number): ConfidenceBand {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

export function needsMoreEvidence(ctx: InvestigationContext): boolean {
  if (!ctx.hasPhoto) return true;
  if (ctx.matchConfidence < 0.7) return true;
  if (ctx.category === 'unknown_low_conf') return true;
  return false;
}

export function shouldSkipFollowUpIntake(ctx: InvestigationContext): boolean {
  return ctx.matchConfidence >= 0.9 && ctx.hasPhoto && !needsMoreEvidence(ctx);
}

const BRANCH_AFTER_RAIN_YES: PlannedFollowUpQuestion[] = [
  {
    id: 'fungicide_after_rain',
    kind: 'spray_timing',
    textEn: 'When did you last spray fungicide on this crop?',
    textMl: 'ഈ വിളയിൽ അവസാനം fungicide spray എപ്പോഴാണ് ചെയ്തത്?',
  },
];

const BRANCH_SOFT_RHIZOME_YES: PlannedFollowUpQuestion[] = [
  {
    id: 'drainage_poor',
    kind: 'yes_no',
    textEn: 'Is water standing in the field or is drainage poor?',
    textMl: 'നിലത്ത് വെള്ളം നിൽക്കുന്നുണ്ടോ അല്ലെങ്കിൽ drainage മോശമാണോ?',
  },
];

function localize(q: PlannedFollowUpQuestion, lang: AdvisoryLanguage): string {
  if (lang === 'ml') return q.textMl;
  return q.textEn;
}

function issueFamily(label?: string): string {
  const t = (label ?? '').toLowerCase();
  if (/thrip|streak|silver/i.test(t)) return 'thrips';
  if (/spot|phyllosticta|anthracnose|blotch/i.test(t)) return 'leaf_spot';
  if (/blast|pyricularia/i.test(t)) return 'blast';
  if (/rot|wilt|pythium|soft/i.test(t)) return 'root_rot';
  if (/yellow|chlorosis|nutrient/i.test(t)) return 'nutrient';
  return 'general';
}

function priorsForIssue(priors: DiseaseWeatherPrior[], family: string): DiseaseWeatherPrior[] {
  const hints: Record<string, RegExp> = {
    thrips: /thrip|silver/i,
    leaf_spot: /spot|anthracnose|fungal/i,
    blast: /blast|pyricularia/i,
    root_rot: /rot|pythium|wilt/i,
    nutrient: /yellow|chlorosis|nutrient/i,
  };
  const re = hints[family];
  if (!re) return priors.slice(0, 2);
  return priors.filter((p) => re.test(p.issueLabel)).slice(0, 2);
}

export const diagnosisFollowUpReasoningEngine = {
  resolveMatchConfidenceBand,
  shouldSkipFollowUpIntake,
  needsMoreEvidence,

  buildIntro(ctx: InvestigationContext): string {
    const count = Math.max(ctx.similarCases.length, ctx.totalVerifiedCases);
    const band = resolveMatchConfidenceBand(ctx.matchConfidence);
    const issue = ctx.bestIssueLabel;

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
      return `${caseLine}${matchLine}${weatherLine}${confLine}`;
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
    return `${caseLine}${matchLine}${weatherLine}${confLine}`;
  },

  planQuestionSequence(ctx: InvestigationContext, maxQuestions: number): PlannedFollowUpQuestion[] {
    const planned: PlannedFollowUpQuestion[] = [];
    const family = issueFamily(ctx.bestIssueLabel);
    const priors = priorsForIssue(ctx.diseasePriors, family);

    if (!ctx.hasPhoto) {
      planned.push({
        id: 'photo_close',
        kind: 'photo_close',
        textEn: 'Please send a **close, clear photo** of the affected leaf (or type skip).',
        textMl: 'ബാധിച്ച **ഇലയുടെ അടുത്ത, വ്യക്തമായ ഫോട്ടോ** അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip" ടൈപ്പ് ചെയ്യൂ).',
      });
    }

    if (ctx.heavyRainLikely && !/rain|മഴ/i.test(ctx.symptomsText)) {
      planned.push({
        id: 'rain_recent',
        kind: 'yes_no',
        textEn: 'Has rainfall increased in your area in the last 7 days?',
        textMl: 'കഴിഞ്ഞ 7 ദിവസത്തിൽ നിങ്ങളുടെ പ്രദേശത്ത് മഴ കൂടിയോ?',
        skipHint: /rain|മഴ|wet|നന/i,
      });
    }

    if (ctx.highHumidityLikely && (family === 'leaf_spot' || family === 'blast')) {
      planned.push({
        id: 'spread_fast',
        kind: 'yes_no',
        textEn: 'Is the problem spreading quickly to many plants?',
        textMl: 'പ്രശ്നം വേഗത്തിൽ പല ചെടികളിലേക്ക് പടരുന്നുണ്ടോ?',
      });
    }

    if (family === 'leaf_spot') {
      planned.push({
        id: 'round_spots',
        kind: 'yes_no',
        textEn: 'Are spots round with yellow-brown edges?',
        textMl: 'പുള്ളികൾ വൃത്താകാരവും മഞ്ഞ-തവിട്ട അരികുകളുമാണോ?',
        skipHint: /round|circle|പുള്ളി/i,
      });
      if (ctx.heavyRainLikely) {
        planned.push({
          id: 'after_rain',
          kind: 'yes_no',
          textEn: 'Did spots increase after recent rain?',
          textMl: 'അടുത്തിടെ മഴ കഴിഞ്ഞ് പുള്ളി കൂടിയോ?',
          skipHint: /rain|മഴ/i,
        });
      }
    }

    if (family === 'thrips') {
      planned.push({
        id: 'silver_streaks',
        kind: 'yes_no',
        textEn: 'Do you see silvery streaks or scraping on leaves?',
        textMl: 'ഇലയിൽ വെള്ള/വെള്ളിമിശ്രിത പട്ടയോ scrape ചിഹ്നങ്ങളോ?',
        skipHint: /silver|streak|വെള്ള/i,
      });
    }

    if (family === 'blast') {
      planned.push({
        id: 'water_soaked',
        kind: 'yes_no',
        textEn: 'Do leaves show water-soaked or burnt-looking patches?',
        textMl: 'ഇലയിൽ വെള്ളം പിടിച്ച അല്ലെങ്കിൽ കരിച്ച ഭാഗങ്ങളുണ്ടോ?',
      });
    }

    if (family === 'root_rot' || priors.some((p) => /rot|pythium/i.test(p.issueLabel))) {
      planned.push({
        id: 'soft_rhizome',
        kind: 'yes_no',
        textEn: 'Is the rhizome/underground part soft or smelly?',
        textMl: 'രൈസോം/അടിവേര് മൃദുവോ ദുർഗന്ധമോ?',
        skipHint: /rot|soft|smell|മൃദു/i,
      });
      if (!ctx.hasPhoto) {
        planned.push({
          id: 'photo_rhizome',
          kind: 'photo_rhizome',
          textEn: 'If possible, send a photo of rhizome/root after washing (or type skip).',
          textMl: 'സാധ്യമെങ്കിൽ കഴുകിയ rhizome/root ഫോട്ടോ അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip").',
        });
      }
    }

    if (family === 'nutrient' || /yellow|chlorosis|മഞ്ഞ/i.test(ctx.symptomsText)) {
      planned.push({
        id: 'mulch_heat',
        kind: 'yes_no',
        textEn: 'Is thick mulch or straw covering the crop (possible heat stress under mulch)?',
        textMl: 'കനത്ത mulch/straw മൂടിയിട്ടുണ്ടോ (താഴെ heat stress സാധ്യത)?',
      });
      planned.push({
        id: 'new_growth_yellow',
        kind: 'yes_no',
        textEn: 'Are young new leaves more yellow than old leaves?',
        textMl: 'പുതിയ ഇലകൾ പഴയ ഇലകളേക്കാൾ കൂടുതൽ മഞ്ഞയാണോ?',
      });
    }

    if (!ctx.lastSprayKnown && (family === 'leaf_spot' || family === 'blast')) {
      planned.push({
        id: 'last_fungicide',
        kind: 'spray_timing',
        textEn: 'When did you last spray fungicide on this crop?',
        textMl: 'ഈ വിളയിൽ അവസാനം fungicide spray എപ്പോഴാണ് ചെയ്തത്?',
      });
    }

    if (ctx.dap != null && ctx.dap >= 120 && family === 'general') {
      planned.push({
        id: 'stage_late',
        kind: 'yes_no',
        textEn: `Crop is around ${ctx.dap} DAP — are symptoms mainly on older leaves?`,
        textMl: `വിള ~${ctx.dap} DAP — പഴയ ഇലകളിലാണോ പ്രധാന ലക്ഷണങ്ങൾ?`,
      });
    }

    const filtered: PlannedFollowUpQuestion[] = [];
    for (const q of planned) {
      if (q.skipHint && q.skipHint.test(ctx.symptomsText)) continue;
      if (filtered.some((f) => f.id === q.id)) continue;
      filtered.push(q);
      if (filtered.length >= maxQuestions) break;
    }

    if (!filtered.length && !ctx.hasPhoto) {
      filtered.push({
        id: 'photo_close',
        kind: 'photo_close',
        textEn: 'Please send a close photo of the affected part (or type skip).',
        textMl: 'ബാധിച്ച ഭാഗത്തിന്റെ അടുത്ത ഫോട്ടോ അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip").',
      });
    }

    return filtered.slice(0, maxQuestions);
  },

  branchAfterAnswer(
    questionId: string,
    answer: 'yes' | 'no' | 'skip',
    ctx: InvestigationContext
  ): PlannedFollowUpQuestion[] {
    if (answer === 'skip') return [];

    if (questionId === 'rain_recent' && answer === 'yes') {
      return BRANCH_AFTER_RAIN_YES.filter((q) => !ctx.lastSprayKnown || q.id !== 'fungicide_after_rain');
    }
    if (questionId === 'after_rain' && answer === 'yes') {
      return BRANCH_AFTER_RAIN_YES;
    }
    if (questionId === 'soft_rhizome' && answer === 'yes') {
      return BRANCH_SOFT_RHIZOME_YES;
    }
    if (questionId === 'spread_fast' && answer === 'yes' && ctx.matchConfidence < 0.85) {
      return [
        {
          id: 'field_percent',
          kind: 'yes_no',
          textEn: 'Is more than 20% of the field affected?',
          textMl: 'നിലത്ത് 20% ൽ കൂടുതൽ ചെടികൾ ബാധിച്ചിട്ടുണ്ടോ?',
        },
      ];
    }
    return [];
  },

  toWhatsAppQuestion(q: PlannedFollowUpQuestion, lang: AdvisoryLanguage) {
    const kind =
      q.kind === 'photo' || q.kind === 'photo_close' || q.kind === 'photo_rhizome'
        ? ('photo' as const)
        : q.kind === 'spray_timing'
          ? ('spray_timing' as const)
          : ('yes_no' as const);
    return {
      id: q.id,
      kind,
      text: localize(q, lang),
    };
  },

  enrichSymptomsFromAnswers(
    initial: string,
    answers: Record<string, string>,
    ctx: InvestigationContext
  ): string {
    const parts = [initial.trim()];
    for (const [qid, ans] of Object.entries(answers)) {
      if (ans === 'skip') continue;
      parts.push(`${qid}=${ans}`);
    }
    if (ctx.bestIssueLabel) parts.push(`Closest learned case: ${ctx.bestIssueLabel}`);
    if (ctx.heavyRainLikely) parts.push('Weather: heavy rain likely');
    if (ctx.highHumidityLikely) parts.push('Weather: high humidity');
    if (ctx.dap != null) parts.push(`Crop stage: ${ctx.dap} DAP`);
    return parts.filter(Boolean).join('. ');
  },

  formatFieldInvestigationSummary(
    answers: Record<string, string>,
    ctx: InvestigationContext
  ): string {
    const lines: string[] = [
      'FIELD INVESTIGATION — farmer answered follow-up questions on WhatsApp.',
      'You MUST base probableIssue, treatments, and farmerSummary on these answers.',
      'Do NOT ignore them or return a generic template that contradicts them.',
      '',
    ];

    const label: Record<string, string> = {
      rain_recent: 'Rainfall increased in last 7 days',
      after_rain: 'Spots increased after recent rain',
      fungicide_after_rain: 'Fungicide spray after rain (follow-up)',
      last_fungicide: 'Last fungicide spray timing',
      spread_fast: 'Problem spreading quickly across plants',
      field_percent: 'More than 20% of field affected',
      round_spots: 'Spots are round with yellow-brown edges',
      silver_streaks: 'Silvery streaks / scrape marks on leaves',
      water_soaked: 'Water-soaked or burnt-looking leaf patches',
      soft_rhizome: 'Soft or smelly rhizome',
      drainage_poor: 'Poor drainage / standing water',
      mulch_heat: 'Thick mulch (possible heat under mulch)',
      new_growth_yellow: 'Young leaves more yellow than old',
      photo_close: 'Close leaf photo provided',
      photo_rhizome: 'Rhizome photo provided',
    };

    for (const [qid, ans] of Object.entries(answers)) {
      if (ans === 'skip') continue;
      const title = label[qid] ?? qid;
      const human =
        ans === 'yes'
          ? 'Yes'
          : ans === 'no'
            ? 'No'
            : ans === 'within_7d'
              ? 'Within last 7 days'
              : ans === 'over_14d'
                ? '14+ days ago or never recently'
                : ans === 'never'
                  ? 'Not yet / no fungicide'
                  : ans;
      lines.push(`- ${title}: ${human}`);
    }

    const inferred = this.inferPrimaryIssueFromIntake(ctx.symptomsText, answers, ctx.bestIssueLabel);
    lines.push('');
    lines.push(`Investigation conclusion (use as probableIssue unless image strongly contradicts): ${inferred}`);
    if (ctx.bestIssueLabel) {
      lines.push(`Similar verified cases in Morbeez suggested: ${ctx.bestIssueLabel}`);
    }

    return lines.join('\n');
  },

  inferPrimaryIssueFromIntake(
    initialSymptoms: string,
    answers: Record<string, string>,
    bestIssueLabel?: string
  ): string {
    const yes = (id: string) => answers[id] === 'yes';
    const no = (id: string) => answers[id] === 'no';

    if (yes('round_spots') && (yes('after_rain') || yes('rain_recent'))) {
      return 'Fungal leaf spot (Phyllosticta / anthracnose) — confirmed round spots after rain';
    }
    if (yes('round_spots')) {
      return 'Fungal leaf spot — farmer confirmed round lesions with yellow-brown edges';
    }
    if (yes('silver_streaks') && no('round_spots')) {
      return 'Thrips damage — silvery streaks without typical round fungal spots';
    }
    if (/silver|streak/i.test(initialSymptoms) && yes('spread_fast') && !yes('round_spots')) {
      return 'Thrips damage with possible secondary spots — prioritize thrips management';
    }
    if (yes('water_soaked') || yes('soft_rhizome')) {
      return 'Foliar blast or rhizome rot risk — wet field / water-soaked lesions';
    }
    if (yes('mulch_heat') && yes('new_growth_yellow')) {
      return 'Heat stress under mulch — not primary nutrient deficiency';
    }

    if (bestIssueLabel?.trim()) return bestIssueLabel.trim();
    return 'Field issue — resolve using investigation answers and image';
  },
};

export type PostIntakeDiagnosisPayload = {
  enrichedSymptoms: string;
  fieldInvestigation: string;
  issueLabelHint: string;
  skipReuseCache: true;
};
