import type { TerminologyDictionaryEntry } from './types.js';
declare function memoryEnabled(): boolean;
/**
 * Farmer-scoped lexicon read/write path.
 * Personal overrides never auto-promote to regional agronomy_terms.
 */
export declare const farmerTerminologyMemoryService: {
    enabled: typeof memoryEnabled;
    lookup(params: {
        farmerId: string;
        term: string;
        language: string;
        cropType?: string | null;
        district?: string | null;
    }): Promise<TerminologyDictionaryEntry | null>;
    /**
     * Persist a farmer-confirmed nickname/meaning immediately.
     * Regional promotion remains a separate agronomist-reviewed path.
     */
    upsertOverride(params: {
        farmerId: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm?: string | null;
        cropType?: string | null;
        district?: string | null;
        sourceDraftId?: string | null;
        sourceMessageId?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<TerminologyDictionaryEntry | null>;
    listForFarmer(params: {
        farmerId: string;
        language?: string;
        limit?: number;
    }): Promise<TerminologyDictionaryEntry[]>;
};
export {};
//# sourceMappingURL=farmer-terminology-memory.service.d.ts.map