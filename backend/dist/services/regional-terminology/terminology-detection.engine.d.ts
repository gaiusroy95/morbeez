import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from './types.js';
/** Tokens worth checking as potential regional crop terms. */
declare function extractCandidateTokens(message: string): string[];
/**
 * Stage 2 — Regional Terminology Detection Engine
 * Tokenize → dictionary lookup → known vs unknown (never guess unknown).
 */
export declare const terminologyDetectionEngine: {
    extractCandidateTokens: typeof extractCandidateTokens;
    detect(params: {
        rawMessage: string;
        language: AdvisoryLanguage;
        cropType?: string | null;
        district?: string | null;
        farmerId?: string | null;
    }): Promise<TerminologyDetectionResult>;
};
export {};
//# sourceMappingURL=terminology-detection.engine.d.ts.map