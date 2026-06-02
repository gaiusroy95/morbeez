import type { AdvisoryLanguage } from '../ai/types.js';
export declare const terminologyEscalationService: {
    /**
     * Stage 4 — create or bump priority for unknown regional word (does not guess meaning).
     */
    escalateUnknown(params: {
        farmerId: string;
        unknownWord: string;
        rawMessage: string;
        language: AdvisoryLanguage;
        cropType?: string | null;
        district?: string | null;
        employeeId?: string | null;
    }): Promise<{
        taskId: string;
        created: boolean;
    }>;
    recordPattern(farmerId: string, term: string, language: string): Promise<void>;
    recordLearningHistory(params: {
        term: string;
        language: string;
        meaning: string;
        standardTerm?: string | null;
        cropType?: string | null;
        district?: string | null;
        action: "approved" | "rejected" | "updated" | "auto_learned";
        taskId?: string | null;
        farmerId?: string | null;
        approvedBy?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
};
//# sourceMappingURL=terminology-escalation.service.d.ts.map