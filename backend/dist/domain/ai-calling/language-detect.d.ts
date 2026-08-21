import { type CallLanguage } from './types.js';
export declare function isCallLanguage(value: string | null | undefined): value is CallLanguage;
export declare function normalizeCallLanguage(value: string | null | undefined): CallLanguage;
/**
 * First-speech language lock. Native script in the utterance always wins over
 * a stored English default. Later calls keep the locked preference unless
 * `force` is set by staff.
 */
export declare function detectCallLanguage(speech: string, storedPreference?: string | null): {
    language: CallLanguage;
    shouldLock: boolean;
    source: 'first_speech' | 'stored';
};
//# sourceMappingURL=language-detect.d.ts.map