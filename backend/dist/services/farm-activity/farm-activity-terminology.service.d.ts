export type FarmActivityTerminologyExpansion = {
    language: string;
    farmerOverrides: Array<{
        term: string;
        resolvedMeaning: string;
        standardTerm: string | null;
    }>;
    productAliases: Array<{
        alias: string;
        canonicalProductKey: string;
    }>;
    unitAliases: Array<{
        alias: string;
        canonicalUnit: string;
    }>;
};
/**
 * Loads optional farmer/product/unit terminology expansions for extraction prompts.
 * Soft-fails when the foundation migration has not been applied yet.
 */
export declare function loadFarmActivityTerminologyExpansion(input: {
    farmerId: string;
    languageHint?: string | null;
}): Promise<FarmActivityTerminologyExpansion>;
//# sourceMappingURL=farm-activity-terminology.service.d.ts.map