import type { CallType } from '../../domain/ai-calling/types.js';
export declare const aiCallingTriggers: {
    onNewLead(params: {
        farmerId: string;
        leadId: string;
        language?: string | null;
        cropType?: string | null;
    }): void;
    onCallbackRequested(params: {
        farmerId: string;
        notes?: string | null;
    }): void;
    onRecommendationCommunicated(params: {
        farmerId: string;
        recommendationRecordId: string;
        language?: string | null;
    }): void;
    onCropWorsened(params: {
        farmerId: string;
        reason: string;
        sessionId?: string;
    }): void;
    onHealthSopScheduled(params: {
        farmerId: string;
        language?: string | null;
        days?: number[];
    }): void;
    enqueue(params: {
        farmerId: string;
        callType: CallType;
        leadId?: string | null;
        payload?: Record<string, unknown>;
    }): void;
};
//# sourceMappingURL=ai-calling-triggers.d.ts.map