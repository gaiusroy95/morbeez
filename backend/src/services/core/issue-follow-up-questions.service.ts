import { env } from '../../config/env.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';

const FALLBACK: Record<string, string[]> = {
  disease: [
    'Are new leaves affected?',
    'Has incidence increased since last visit?',
    'Was fungicide applied as recommended?',
    'Any rainfall in the last 7 days?',
  ],
  pest: [
    'Is pest pressure increasing on younger shoots?',
    'Were recommended controls applied?',
    'Any beneficial insects observed?',
  ],
  nutrient_deficiency: [
    'Are deficiency symptoms spreading to older leaves?',
    'Was the recommended nutrient application completed?',
  ],
  default: [
    'Has the situation changed since the last recommendation?',
    'Was the recommended action applied?',
    'Any new symptoms observed?',
  ],
};

export const issueFollowUpQuestionsService = {
  async suggest(input: {
    issueCategory: string;
    issueName: string;
    cropType: string;
    dap?: number | null;
    observation?: string;
    recommendationText?: string;
    photoCount?: number;
    selectedHypothesis?: string;
    contextPack?: Record<string, unknown>;
  }): Promise<string[]> {
    const category = input.issueCategory.toLowerCase();
    const fallback = FALLBACK[category] ?? FALLBACK.default;
    const hypothesis = input.selectedHypothesis?.trim() || input.issueName;

    if (!env.OPENAI_API_KEY) {
      return fallback.slice(0, 5);
    }

    try {
      const userPrompt = `Crop: ${input.cropType}
DAP: ${input.dap ?? 'unknown'}
Issue category: ${input.issueCategory}
Selected hypothesis: ${hypothesis}
Observation: ${input.observation ?? 'none'}
Prior recommendation: ${input.recommendationText ?? 'none'}
Photos: ${input.photoCount ?? 0}
Context: ${input.contextPack ? JSON.stringify(input.contextPack).slice(0, 1500) : 'none'}`;

      const result = await openaiJsonCompletion<{ questions: string[] }>(
        'Return JSON {"questions":["..."]} with 3-5 short agronomy follow-up questions.',
        userPrompt,
        512
      );

      if (Array.isArray(result.questions) && result.questions.length) {
        return result.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 5);
      }
    } catch {
      // use fallback
    }

    return fallback.slice(0, 5);
  },
};
