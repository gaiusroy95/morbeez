import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDictionaryEntry } from './types.js';
export declare const terminologyDictionaryService: {
    lookup(token: string, language: AdvisoryLanguage, opts?: {
        cropType?: string | null;
        district?: string | null;
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