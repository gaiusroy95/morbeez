import type { CallOutcome, CallSummaryJson } from '../../domain/call-intelligence/types.js';
export declare const callIntelligenceService: {
    uploadAndProcess(input: {
        leadId: string;
        agentEmail: string;
        audioBase64?: string;
        filename?: string;
        mimeType?: string;
        transcript?: string;
        outcome?: CallOutcome;
        durationSeconds?: number;
        recordingProvider?: "app_upload" | "voice_note" | "exotel";
    }): Promise<{
        call: any;
    }>;
    processCall(callId: string): Promise<{
        callId: string;
        summary: CallSummaryJson;
        qc: {
            totalScore: number;
            flagged: boolean;
            flagReason: string | null;
            rubric: Record<string, {
                score: number;
                maxPoints: number;
                note?: string;
            }>;
        };
        interactionId: string;
    }>;
    confirmCall(callId: string, input: {
        acceptStage?: boolean;
        stage?: string;
        agentEmail: string;
    }): Promise<{
        ok: boolean;
    }>;
    applySoilTestAutomation(leadId: string, farmerId: string, summary: CallSummaryJson, agentEmail: string): Promise<void>;
    getCall(callId: string): Promise<any>;
    runDiagnosis(callId: string, input?: {
        imageBase64?: string;
        imageMimeType?: string;
    }): Promise<import("../ai/types.js").DiagnoseResult>;
    getLeadTimeline(leadId: string): Promise<{
        items: {
            id: string;
            type: string;
            title: string;
            detail: string | null;
            at: string;
            meta?: Record<string, unknown>;
        }[];
    }>;
};
//# sourceMappingURL=call-intelligence.service.d.ts.map