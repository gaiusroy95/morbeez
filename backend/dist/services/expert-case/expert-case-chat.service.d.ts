import type { ExpertCaseReviewDraft } from '@morbeez/shared/expert-case';
import { loadExpertCaseBriefing } from './expert-case-copilot-simulation.service.js';
import { buildExpertCaseNavigation } from './expert-case-navigation.service.js';
export type ExpertChatMessageInput = {
    caseId: string;
    ownerEmail: string;
    leaseToken?: string | null;
    content: string;
    uiLocale?: string | null;
};
export type ExpertCaseDraftPayload = ExpertCaseReviewDraft;
export declare const expertCaseChatService: {
    enabled(): boolean;
    assertOwner(params: {
        caseId: string;
        ownerEmail: string;
        leaseToken?: string | null;
    }): Promise<{
        id: any;
        owner_email: any;
        lease_token: any;
        lease_expires_at: any;
        current_revision: any;
        review_flag: any;
        farmer_id: any;
        crop_type: any;
        primary_issue_label: any;
        metadata: any;
        priority: any;
    }>;
    listTurns(caseId: string): Promise<any[]>;
    getPendingDraft(caseId: string): Promise<any>;
    persistDraftResult(params: {
        caseId: string;
        ownerEmail: string;
        leaseToken?: string | null;
        owned: {
            current_revision: number | null;
        };
        agronomistContent: string;
        assistantMessage: string;
        clarification: string | null;
        draft: ExpertCaseDraftPayload;
        metadata?: Record<string, unknown>;
    }): Promise<{
        agronomistTurn: any;
        assistantTurn: any;
        draft: ExpertCaseReviewDraft;
        clarification: string | null;
        baseRevision: number;
    }>;
    postMessage(input: ExpertChatMessageInput): Promise<{
        agronomistTurn: Record<string, unknown>;
        assistantTurn: Record<string, unknown>;
        draft: ExpertCaseDraftPayload;
        clarification: string | null;
        baseRevision: number;
        navigation?: {
            action: "next" | "previous" | "list";
            targetCaseId: string | null;
            caseNavigation?: Awaited<ReturnType<typeof buildExpertCaseNavigation>>;
        };
    }>;
    extractDraft(params: {
        caseId: string;
        message: string;
        history: Array<{
            role: string;
            content: string;
        }>;
        currentRevision: number;
        currentDraft?: ExpertCaseDraftPayload | null;
        clarificationAlreadyAsked?: boolean;
        clarificationCount?: number;
        maxClarifications?: number;
        briefing?: Awaited<ReturnType<typeof loadExpertCaseBriefing>> | null;
        uiLocale?: string | null;
    }): Promise<{
        assistantMessage: string;
        clarification: string | null;
        draft: ExpertCaseDraftPayload;
    }>;
    approveDraft(params: {
        caseId: string;
        ownerEmail: string;
        leaseToken?: string | null;
        expectedBaseRevision: number;
        draftPatch?: ExpertCaseDraftPayload;
    }): Promise<{
        draft: ExpertCaseReviewDraft;
        draftId: any;
        baseRevision: number;
    }>;
};
//# sourceMappingURL=expert-case-chat.service.d.ts.map