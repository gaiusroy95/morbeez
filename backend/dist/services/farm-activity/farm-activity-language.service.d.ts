export type FarmActivityLanguageCode = 'en' | 'ml' | 'ta' | 'kn' | 'hi';
export type FarmActivityLanguageDetection = {
    detectedLanguage: FarmActivityLanguageCode;
    codeMixed: boolean;
};
/**
 * Detects the language from the final text/transcript. The stored preference is
 * only a tie-breaker and never overrides a script observed in the transcript.
 */
export declare function detectFarmActivityLanguage(transcript: string, storedPreference?: string | null): FarmActivityLanguageDetection;
export declare const farmActivityLanguageService: {
    detect: typeof detectFarmActivityLanguage;
};
//# sourceMappingURL=farm-activity-language.service.d.ts.map