import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDictionaryEntry } from './types.js';
export declare const terminologyDictionaryService: {
    /**
     * Deterministic lookup priority:
     * farmer override → district+crop → crop → language-global → builtin.
     * District fallback always retains language.
     */
    lookup(token: string, language: AdvisoryLanguage, opts?: {
        cropType?: string | null;
        district?: string | null;
        farmerId?: string | null;
    }): Promise<TerminologyDictionaryEntry | null>;
    upsertApproved(params: {
        term: string;
        language: string;
        meaning: string;
        standardTerm?: string | null;
        localScript?: string | null;
        cropType?: string | null;
        district?: string | null;
        approvedBy?: string;
        confidence?: number;
    }): Promise<TerminologyDictionaryEntry>;
    listForContext(opts: {
        language: AdvisoryLanguage;
        cropType?: string | null;
        district?: string | null;
        limit?: number;
    }): Promise<TerminologyDictionaryEntry[]>;
};
//# sourceMappingURL=terminology-dictionary.service.d.ts.map