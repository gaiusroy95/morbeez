import type { FarmActivityAssistantDraftV1, FarmActivityAssistantSubEvent } from '@morbeez/shared/farm-activity-assistant';
export type FarmActivityCommitResult = {
    draftId: string;
    revision: number;
    commandId: string;
    activityIds: string[];
    roiEntryIds: string[];
    harvestIds: string[];
};
export declare const farmActivityCommitService: {
    enabled(): boolean;
    commitDraft(input: {
        farmerId: string;
        draftId: string;
        expectedRevision: number;
        actor?: string;
        fallbackBlockId?: string | null;
    }): Promise<FarmActivityCommitResult>;
    writeSubEvent(input: {
        farmerId: string;
        draft: FarmActivityAssistantDraftV1;
        event: FarmActivityAssistantSubEvent;
        commandId: string;
        provenance: Record<string, unknown>;
        fallbackBlockId: string | null;
    }): Promise<{
        activityIds: string[];
        roiEntryIds: string[];
        harvestIds: string[];
    }>;
};
//# sourceMappingURL=farm-activity-commit.service.d.ts.map