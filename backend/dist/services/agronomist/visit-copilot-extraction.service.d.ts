import { type VisitAssistantProposalResponse, type VisitAssistantSnapshot } from '@morbeez/shared/visit-assistant';
import type { VisitCopilotStructuredPreview, VisitCopilotTreatmentDraft, VisitCopilotValidation, VisitCopilotReminder } from '@morbeez/shared/visit-copilot';
export declare const VISIT_COPILOT_EXTRACTION_SCHEMA: {
    type: string;
    additionalProperties: boolean;
    properties: Record<string, unknown>;
    required: string[];
};
export type VisitCopilotExtractionResult = {
    assistantMessage: string;
    preview: VisitCopilotStructuredPreview;
    farmerQuestions: string[];
    treatment: VisitCopilotTreatmentDraft;
    reminders: VisitCopilotReminder[];
    validation: VisitCopilotValidation;
    proposal: VisitAssistantProposalResponse;
};
export declare const visitCopilotExtractionService: {
    extract(input: {
        farmerId: string;
        blockId: string;
        snapshot: VisitAssistantSnapshot;
        message: {
            id: string;
            content: string;
            createdAt: string;
        };
        priorEvidenceReceived?: Array<{
            label: string;
            present: boolean;
        }>;
    }): Promise<VisitCopilotExtractionResult>;
};
//# sourceMappingURL=visit-copilot-extraction.service.d.ts.map