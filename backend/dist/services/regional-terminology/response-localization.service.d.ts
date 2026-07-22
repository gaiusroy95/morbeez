import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from './types.js';
/**
 * Stage 8 — Response Localization Engine
 * Swap standard scientific phrases → farmer regional terms when known.
 */
export declare const responseLocalizationService: {
    localize(params: {
        standardResponse: string;
        detection: TerminologyDetectionResult | null;
        language: AdvisoryLanguage;
        district?: string | null;
    }): Promise<string>;
    /** Sync wrapper for callers that cannot await. */
    localizeSync(params: {
        standardResponse: string;
        detection: TerminologyDetectionResult | null;
        language: AdvisoryLanguage;
    }): string;
    farmerPendingCopy(language: AdvisoryLanguage): string;
};
//# sourceMappingURL=response-localization.service.d.ts.map