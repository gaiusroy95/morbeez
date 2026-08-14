import type { SeasonPhase } from './seasonal-priority.service.js';

export type EnvSignals = {
  seasonPhase?: SeasonPhase;
  heavyRainLikely: boolean;
  highHumidityLikely: boolean;
  weatherRiskScore: number;
};

export type DiseaseWeatherPrior = {
  issueLabel: string;
  likelihood: 'low' | 'medium' | 'high';
  spreadMode?: 'airborne' | 'soil' | 'vector' | 'stress';
  reasoning: string;
};

type Rule = {
  crops: string[];
  issue: string;
  spreadMode: DiseaseWeatherPrior['spreadMode'];
  minScore: number;
  phases?: SeasonPhase[];
  requiresHeavyRain?: boolean;
  requiresHighHumidity?: boolean;
  /** When true, weather alone must not fire this prior — farmer/photo symptoms required. */
  requiresSymptomMatch?: boolean;
  symptomHints?: RegExp;
  reasoningEn: string;
};

const RULES: Rule[] = [
  {
    crops: ['ginger', 'rice', 'paddy'],
    issue: 'Pyricularia leaf blast',
    spreadMode: 'airborne',
    minScore: 55,
    phases: ['monsoon', 'disease_peak'],
    requiresHighHumidity: true,
    symptomHints: /blast|pyricularia|diamond|spindle|brown.?spot|leaf.?spot|lesion/i,
    reasoningEn:
      'Monsoon/high humidity favours Pyricularia (blast) on ginger — spores spread by wind and rain splash.',
  },
  {
    crops: ['ginger'],
    issue: 'Rhizome rot / Pythium',
    spreadMode: 'soil',
    minScore: 50,
    phases: ['monsoon'],
    requiresHeavyRain: true,
    symptomHints: /rot|wilt|yellow|collar|soft|damp|waterlog/i,
    reasoningEn:
      'Heavy rain and poor drainage increase rhizome rot risk in ginger.',
  },
  {
    crops: ['ginger', 'cardamom', 'pepper'],
    issue: 'Thrips',
    spreadMode: 'vector',
    minScore: 40,
    phases: ['monsoon', 'normal', 'planting'],
    symptomHints: /silver|streak|scrap|curl|thrip/i,
    reasoningEn:
      'Thrips often rise after rains; silvery streaks on leaves are typical.',
  },
  {
    crops: ['cardamom', 'pepper', 'ginger'],
    issue: 'Anthracnose / fungal leaf spot',
    spreadMode: 'airborne',
    minScore: 48,
    requiresHighHumidity: true,
    // Never invent anthracnose from humidity alone — needs lesion wording from farmer/photo.
    requiresSymptomMatch: true,
    symptomHints: /\banthracnose\b|\bcolletotrichum\b|\bcircular\s+spot|\bdark\s+margin|\bspore\s+mass/i,
    reasoningEn:
      'Warm humid weather can support fungal leaf spots when discrete lesions are present.',
  },
];

function scoreRule(rule: Rule, ctx: EnvSignals, symptomsText?: string): number {
  const text = symptomsText?.trim() ?? '';
  const symptomHit = Boolean(text && rule.symptomHints?.test(text));
  if (rule.requiresSymptomMatch && !symptomHit) return 0;

  let score = 0;
  if (rule.phases?.length && ctx.seasonPhase && rule.phases.includes(ctx.seasonPhase)) {
    score += 25;
  }
  if (rule.requiresHeavyRain && ctx.heavyRainLikely) score += 30;
  if (rule.requiresHighHumidity && ctx.highHumidityLikely) score += 28;
  if (ctx.weatherRiskScore >= 60) score += 15;
  if (symptomHit) score += 35;
  if (!rule.phases && ctx.seasonPhase === 'monsoon') score += 10;
  return score;
}

export const diseaseWeatherRulesService = {
  evaluate(params: {
    cropType: string;
    env: EnvSignals;
    symptomsText?: string;
    dap?: number;
  }): DiseaseWeatherPrior[] {
    const crop = params.cropType.toLowerCase().replace(/_/g, ' ');
    const text = params.symptomsText ?? '';

    const priors: DiseaseWeatherPrior[] = [];

    for (const rule of RULES) {
      if (!rule.crops.some((c) => crop.includes(c) || c.includes(crop))) continue;

      const score = scoreRule(rule, params.env, text);
      if (score < rule.minScore) continue;

      const likelihood: DiseaseWeatherPrior['likelihood'] =
        score >= rule.minScore + 35 ? 'high' : score >= rule.minScore + 15 ? 'medium' : 'low';

      priors.push({
        issueLabel: rule.issue,
        likelihood,
        spreadMode: rule.spreadMode,
        reasoning: rule.reasoningEn,
      });
    }

    return priors
      .sort((a, b) => {
        const rank = { high: 3, medium: 2, low: 1 };
        return rank[b.likelihood] - rank[a.likelihood];
      })
      .slice(0, 4);
  },

  formatForPrompt(priors: DiseaseWeatherPrior[]): string {
    if (!priors.length) return '';
    return priors
      .map(
        (p) =>
          `- ${p.issueLabel} (${p.likelihood} likelihood${p.spreadMode ? `, ${p.spreadMode} spread` : ''}): ${p.reasoning}`
      )
      .join('\n');
  },
};
