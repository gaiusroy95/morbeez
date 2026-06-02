import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from './types.js';
/**
 * Stage 7 — inject regional terminology into AI prompts (language memory).
 */
export declare const terminologyAiContextService: {
    buildPromptBlock(params: {
        language: AdvisoryLanguage;
        cropType?: string | null;
        district?: string | null;
        detection?: TerminologyDetectionResult | null;
        maxLines?: number;
    }): Promise<string>;
    /** AI reasons in standard terms; farmer text expansion for internal use. */
    expandedSymptomsText(detection: TerminologyDetectionResult | null, fallback: string): string;
};
//# sourceMappingURL=terminology-ai-context.service.d.ts.map