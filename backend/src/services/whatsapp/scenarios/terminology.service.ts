import { isLikelyUnknownRegionalPhrase as isRegionalTermLookup } from '../pipeline/agriculture-free-text.service.js';
import { terminologyDictionaryService } from '../../regional-terminology/terminology-dictionary.service.js';
import { terminologyEscalationService } from '../../regional-terminology/terminology-escalation.service.js';
import { t } from './whatsapp-flow-copy.js';
import type { AdvisoryLanguage } from '../../ai/types.js';

/** Scenarios 7–9 — regional terminology mapping (delegates to regional-terminology engine). */
export const terminologyService = {
  async resolveTerm(
    term: string,
    language: AdvisoryLanguage,
    district?: string | null,
    cropType?: string | null
  ): Promise<{ found: boolean; meaning?: string; confidence: number }> {
    const entry = await terminologyDictionaryService.lookup(term, language, {
      cropType: cropType ?? null,
      district: district ?? null,
    });
    if (entry) {
      return { found: true, meaning: entry.meaning, confidence: entry.confidence };
    }
    return { found: false, confidence: 0 };
  },

  async createReviewTask(params: {
    farmerId: string;
    term: string;
    language?: AdvisoryLanguage;
    cropType?: string;
    district?: string;
    contextText?: string;
  }): Promise<void> {
    await terminologyEscalationService.escalateUnknown({
      farmerId: params.farmerId,
      unknownWord: params.term,
      rawMessage: params.contextText ?? params.term,
      language: params.language ?? 'en',
      cropType: params.cropType ?? null,
      district: params.district ?? null,
    });
  },

  isChimbIssue(text: string): boolean {
    return /\bchimb|chimbi\b/i.test(text) || /ചിമ്പ്|சிம்ப்/i.test(text);
  },

  isLikelyUnknownRegionalPhrase(text: string): boolean {
    return isRegionalTermLookup(text);
  },

  chimbQuestionCopy(language: AdvisoryLanguage): string {
    return t('chimbQuestion', language);
  },

  chimbAdviceCopy(language: AdvisoryLanguage): string {
    return t('chimbAdvice', language);
  },

  clarifyCopy(language: AdvisoryLanguage): string {
    return t('terminologyClarify', language);
  },
};
