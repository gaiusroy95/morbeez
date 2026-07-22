import { type VisitAssistantProposalResponse, type VisitAssistantSnapshot } from '@morbeez/shared/visit-assistant';
import { fieldFindingsMastersService } from '../admin/field-findings-masters.service.js';
type IssueMaster = Awaited<ReturnType<typeof fieldFindingsMastersService.listIssueMaster>>[number];
type MeasurementTemplate = Awaited<ReturnType<typeof fieldFindingsMastersService.listMeasurementTemplates>>[number];
export declare const VISIT_ASSISTANT_RESPONSE_SCHEMA: {
    type: string;
    additionalProperties: boolean;
    properties: Record<string, unknown>;
    required: string[];
};
export type VisitAssistantSemanticContext = {
    snapshot: VisitAssistantSnapshot;
    userMessageId: string;
    issueMaster: IssueMaster[];
    measurementTemplates: MeasurementTemplate[];
};
export declare function normalizeVisitAssistantProposal(value: VisitAssistantProposalResponse, context: VisitAssistantSemanticContext): {
    ok: true;
    value: VisitAssistantProposalResponse;
} | {
    ok: false;
    errors: string[];
};
export declare function buildVisitAssistantFallback(snapshot: VisitAssistantSnapshot, target?: 'field_note' | 'issue'): VisitAssistantProposalResponse;
export declare const visitAssistantService: {
    extract(input: {
        farmerId: string;
        blockId: string;
        sessionId?: string;
        snapshot: VisitAssistantSnapshot;
        message: {
            id: string;
            content: string;
            createdAt: string;
        };
    }): Promise<VisitAssistantProposalResponse>;
};
export {};
//# sourceMappingURL=visit-assistant.service.d.ts.map