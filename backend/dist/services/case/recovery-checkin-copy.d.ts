import type { AdvisoryLanguage } from '../ai/types.js';
/** Resolve the farmer-facing condition label for Day 3/7/14 recovery check-ins. */
export declare function resolveRecoveryCheckInCondition(params: {
    sessionId?: string | null;
    recommendationRecordId?: string | null;
    issueLabelHint?: string | null;
}): Promise<string | null>;
export declare function buildMaiosRecoveryCheckInBody(params: {
    lang: AdvisoryLanguage;
    cropDisplayName: string;
    day: number;
    condition?: string | null;
}): string;
export declare function buildGingerRecoveryCheckInBody(params: {
    lang: AdvisoryLanguage;
    day: number;
    condition?: string | null;
}): string;
//# sourceMappingURL=recovery-checkin-copy.d.ts.map