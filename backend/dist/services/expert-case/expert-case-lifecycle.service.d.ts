import { type ExpertCaseLinkType, type ExpertCaseRevisionSource } from '../../domain/expert-case/types.js';
export type EnsureExpertCaseInput = {
    farmerId: string;
    sessionId?: string | null;
    escalationId?: string | null;
    blockId?: string | null;
    cropType?: string | null;
    issueLabel?: string | null;
    reason?: string | null;
    priority?: string | null;
    confidence?: number | null;
    reasonCodes?: string[];
    actorEmail?: string | null;
    source?: ExpertCaseRevisionSource;
    payload?: Record<string, unknown>;
};
export declare const expertCaseLifecycleService: {
    enabled(): boolean;
    dedupeEnabled(): boolean;
    recurrenceEnabled(): boolean;
    ensureFromAdvisory(input: EnsureExpertCaseInput): Promise<{
        caseId: string;
        created: boolean;
        merged: boolean;
    } | null>;
    findOpenCase(params: {
        farmerId: string;
        blockId?: string | null;
        fingerprint: string;
    }): Promise<{
        id: string;
        current_revision: number;
    } | null>;
    findRecentClosedRecurrence(params: {
        farmerId: string;
        blockId?: string | null;
        fingerprint: string;
    }): Promise<{
        id: string;
        case_key: string;
    } | null>;
    createCase(params: EnsureExpertCaseInput & {
        blockId?: string | null;
        fingerprint: string;
        caseKey: string;
        priority: string;
        recurrenceOfCaseId?: string;
        parentCaseId?: string;
    }): Promise<string>;
    appendRevision(params: {
        caseId: string;
        source: ExpertCaseRevisionSource;
        createdBy?: string;
        payload?: Record<string, unknown>;
        forceRevision?: number;
    }): Promise<number>;
    linkArtifact(params: {
        caseId: string;
        linkType: ExpertCaseLinkType;
        entityId: string;
        isPrimary?: boolean;
        mergedFromCaseId?: string | null;
    }): Promise<void>;
    getById(caseId: string): Promise<any>;
    listOpen(params?: {
        limit?: number;
        ownerEmail?: string | null;
    }): Promise<any[]>;
    closeCase(params: {
        caseId: string;
        closedBy: string;
        summary?: Record<string, unknown>;
    }): Promise<void>;
    contentHash(value: unknown): string;
    newId(): string;
};
//# sourceMappingURL=expert-case-lifecycle.service.d.ts.map