import { type FarmActivityCanonicalUnit } from '../regional-terminology/unit-alias.service.js';
export declare const terminologyAdminService: {
    getSummary(): Promise<{
        pendingTerms: number;
        approvedTerms: number;
        learnedTerminologies: number;
        totalConcepts: number;
    }>;
    listConcepts(): Promise<{
        id: string;
        conceptCode: string | null;
        name: string;
        category: string;
        termCount: number;
        createdAt: string;
    }[]>;
    createConcept(input: {
        name: string;
        category?: string;
    }): Promise<any>;
    listLearnedTerminologies(params?: {
        search?: string;
        language?: string;
        district?: string;
        status?: string;
    }): Promise<{
        id: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm: string | null;
        localScript: string | null;
        cropType: string | null;
        district: string | null;
        state: string | null;
        status: string;
        replyPreferred: boolean;
        usageCount: number;
        conceptId: string | null;
        conceptName: string | null;
        conceptCode: string | null;
        conceptCategory: string | null;
        aliases: {
            alias: string;
            language: string;
        }[];
        updatedAt: string;
    }[]>;
    getRegionalTerm(termId: string): Promise<{
        id: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm: string | null;
        localScript: string | null;
        cropType: string | null;
        district: string | null;
        state: string | null;
        status: string;
        replyPreferred: boolean;
        usageCount: number;
        conceptId: string | null;
        conceptName: string | null;
        conceptCode: string | null;
        conceptCategory: string | null;
        aliases: {
            alias: string;
            language: string;
        }[];
        updatedAt: string;
    }>;
    updateRegionalTerm(termId: string, input: {
        term?: string;
        language?: string;
        cropType?: string | null;
        district?: string | null;
        state?: string | null;
        meaning?: string;
        standardTerm?: string;
        conceptId?: string | null;
        replyPreferred?: boolean;
        status?: "active" | "inactive";
        aliases?: string[];
    }): Promise<{
        id: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm: string | null;
        localScript: string | null;
        cropType: string | null;
        district: string | null;
        state: string | null;
        status: string;
        replyPreferred: boolean;
        usageCount: number;
        conceptId: string | null;
        conceptName: string | null;
        conceptCode: string | null;
        conceptCategory: string | null;
        aliases: {
            alias: string;
            language: string;
        }[];
        updatedAt: string;
    }>;
    listRegionalTerms(params?: {
        search?: string;
        language?: string;
        district?: string;
    }): Promise<{
        id: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm: string | null;
        localScript: string | null;
        cropType: string | null;
        district: string | null;
        state: string | null;
        status: string;
        replyPreferred: boolean;
        usageCount: number;
        conceptId: string | null;
        conceptName: string | null;
        conceptCode: string | null;
        conceptCategory: string | null;
        aliases: {
            alias: string;
            language: string;
        }[];
        updatedAt: string;
    }[]>;
    listLocalizationProfiles(params?: {
        language?: string;
        district?: string;
    }): Promise<{
        id: string;
        language: string;
        district: string | null;
        state: string | null;
        preferredTerms: any;
        responseStyle: string;
        updatedAt: string;
    }[]>;
    upsertLocalizationProfile(input: {
        language: string;
        district?: string | null;
        state?: string | null;
        preferredTerms?: unknown[];
        responseStyle?: string;
    }): Promise<any>;
    approveTask(taskId: string, input: {
        conceptId?: string;
        conceptName?: string;
        conceptCategory?: string;
        meaning: string;
        standardTerm?: string;
        cropType?: string | null;
        district?: string | null;
        replyPreferred?: boolean;
        examples?: string[];
        aliases?: string[];
        resolvedBy?: string;
    }): Promise<any>;
    syncProfilePreferredTerm(params: {
        language: string;
        district: string;
        conceptId: string;
        termId: string;
        regionalTerm: string;
    }): Promise<void>;
    rejectTask(taskId: string, resolvedBy?: string, reason?: string): Promise<any>;
    skipTask(taskId: string, resolvedBy?: string): Promise<any>;
    listFarmerOverrides(params?: {
        farmerId?: string;
        language?: string;
        limit?: number;
    }): Promise<import("../regional-terminology/types.js").TerminologyDictionaryEntry[] | {
        id: string;
        farmerId: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm: string | null;
        cropType: string | null;
        district: string | null;
        updatedAt: string;
    }[]>;
    upsertFarmerOverride(input: {
        farmerId: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm?: string | null;
        cropType?: string | null;
        district?: string | null;
    }): Promise<import("../regional-terminology/types.js").TerminologyDictionaryEntry | null>;
    /**
     * Promote a farmer-private override into regional agronomy_terms after human review.
     * Does not auto-promote; requires explicit staff action.
     */
    promoteFarmerOverride(input: {
        farmerId: string;
        term: string;
        language: string;
        meaning: string;
        standardTerm?: string | null;
        cropType?: string | null;
        district?: string | null;
        approvedBy?: string;
    }): Promise<import("../regional-terminology/types.js").TerminologyDictionaryEntry>;
    listProductAliases(params?: {
        status?: string;
        language?: string;
        search?: string;
    }): Promise<import("../regional-terminology/product-alias.service.js").ProductAliasMatch[]>;
    proposeProductAlias(input: {
        alias: string;
        language: string;
        canonicalProductKey: string;
        shopifyProductId?: string | null;
        farmerId?: string | null;
        cropType?: string | null;
        district?: string | null;
        proposedBy?: string | null;
    }): Promise<import("../regional-terminology/product-alias.service.js").ProductAliasMatch>;
    reviewProductAlias(id: string, status: "approved" | "rejected" | "retired" | "pending", approvedBy?: string): Promise<import("../regional-terminology/product-alias.service.js").ProductAliasMatch>;
    listUnitAliases(params?: {
        status?: string;
        language?: string;
        search?: string;
    }): Promise<import("../regional-terminology/unit-alias.service.js").UnitAliasMatch[]>;
    proposeUnitAlias(input: {
        alias: string;
        language: string;
        canonicalUnit: FarmActivityCanonicalUnit;
        farmerId?: string | null;
        cropType?: string | null;
        district?: string | null;
        proposedBy?: string | null;
    }): Promise<import("../regional-terminology/unit-alias.service.js").UnitAliasMatch>;
    reviewUnitAlias(id: string, status: "approved" | "rejected" | "retired" | "pending", approvedBy?: string): Promise<import("../regional-terminology/unit-alias.service.js").UnitAliasMatch>;
};
//# sourceMappingURL=terminology-admin.service.d.ts.map