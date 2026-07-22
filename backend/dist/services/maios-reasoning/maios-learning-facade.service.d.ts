import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
export type LearningFacadeInput = {
    farmerId: string;
    cropType: string;
    issueLabel: string;
    sessionId?: string;
    channel: 'visit' | 'whatsapp' | 'api' | 'field_visit';
    reasoning?: MaiosReasoningSnapshot | null;
    agronomistVerified?: boolean;
    outcome?: 'improved' | 'partial' | 'no_improvement' | null;
};
/** Domain 11 — unified learning entry point. Records regional stats; LR matrix is never auto-updated. */
export declare const maiosLearningFacadeService: {
    recordOutcome(input: LearningFacadeInput): Promise<void>;
    recordFromReasoningSnapshot(input: {
        farmerId: string;
        cropType: string;
        sessionId?: string;
        channel: LearningFacadeInput["channel"];
        snapshot: MaiosReasoningSnapshot;
    }): Promise<void>;
    /** Agronomist-confirmed diagnosis on visit close — records regional stats, never updates LR matrix. */
    recordAgronomistVerifiedOutcome(input: {
        farmerId: string;
        cropType: string;
        verifiedIssueLabel: string;
        sessionId?: string;
        reasoning?: MaiosReasoningSnapshot | null;
        outcome?: LearningFacadeInput["outcome"];
        reviewAction?: string | null;
    }): Promise<void>;
};
//# sourceMappingURL=maios-learning-facade.service.d.ts.map