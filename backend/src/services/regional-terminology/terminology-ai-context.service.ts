import type { AdvisoryLanguage } from '../ai/types.js';
import { terminologyDictionaryService } from './terminology-dictionary.service.js';
import type { TerminologyDetectionResult } from './types.js';

/**
 * Stage 7 — inject regional terminology into AI prompts (language memory).
 */
export const terminologyAiContextService = {
  async buildPromptBlock(params: {
    language: AdvisoryLanguage;
    cropType?: string | null;
    district?: string | null;
    detection?: TerminologyDetectionResult | null;
    maxLines?: number;
  }): Promise<string> {
    const lines: string[] = [];

    if (params.detection?.glossaryLines.length) {
      lines.push('Farmer message regional terms (this message):');
      lines.push(...params.detection.glossaryLines.slice(0, params.maxLines ?? 12));
      if (params.detection.hasUnknown) {
        lines.push(
          `Unknown local terms (do not guess): ${params.detection.unknownTerms.map((u) => u.token).join(', ')}`
        );
      }
    }

    const dict = await terminologyDictionaryService.listForContext({
      language: params.language,
      cropType: params.cropType,
      district: params.district,
      limit: 15,
    });

    if (dict.length) {
      lines.push('Regional terminology dictionary (approved):');
      for (const e of dict.slice(0, params.maxLines ?? 15)) {
        const std = e.standardTerm ? ` → ${e.standardTerm}` : '';
        lines.push(`- ${e.term}${std}: ${e.meaning}`);
      }
    }

    if (!lines.length) return '';
    return lines.join('\n');
  },

  /** AI reasons in standard terms; farmer text expansion for internal use. */
  expandedSymptomsText(detection: TerminologyDetectionResult | null, fallback: string): string {
    if (!detection?.knownTerms.length) return fallback;
    return detection.expandedForAi || fallback;
  },
};
