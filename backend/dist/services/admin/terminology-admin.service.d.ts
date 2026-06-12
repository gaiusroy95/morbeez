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
};
//# sourceMappingURL=terminology-admin.service.d.ts.map