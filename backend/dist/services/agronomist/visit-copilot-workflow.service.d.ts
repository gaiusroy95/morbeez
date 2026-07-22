import type { VisitAssistantSnapshot } from '@morbeez/shared/visit-assistant';
import { type VisitCopilotChatResponse, type VisitCopilotWorkflowState } from '@morbeez/shared/visit-copilot';
export declare const visitCopilotWorkflowService: {
    chat(input: {
        farmerId: string;
        blockId: string;
        snapshot: VisitAssistantSnapshot;
        message: {
            id: string;
            content: string;
            createdAt: string;
        };
        workflow?: VisitCopilotWorkflowState | null;
    }): Promise<VisitCopilotChatResponse>;
};
//# sourceMappingURL=visit-copilot-workflow.service.d.ts.map