import type { AdvisoryLanguage } from '../ai/types.js';
import type { CallSummaryJson } from '../../domain/call-intelligence/types.js';
export declare const callIntelligenceProcessor: {
    transcribeAudio(buffer: Buffer, mimeType: string, language: AdvisoryLanguage): Promise<string>;
    summarizeTranscript(input: {
        farmerId: string;
        leadId: string;
        transcript: string;
        language: AdvisoryLanguage;
    }): Promise<{
        summary: CallSummaryJson;
        summaryText: string;
        expandedText: string;
        detection: import("../regional-terminology/types.js").TerminologyDetectionResult | null;
    }>;
    runQc(input: {
        transcript: string;
        summaryText: string;
        agentEmail: string;
    }): Promise<{
        totalScore: number;
        flagged: boolean;
        flagReason: string | null;
        rubric: Record<string, {
            score: number;
            maxPoints: number;
            note?: string;
        }>;
    }>;
};
//# sourceMappingURL=call-intelligence.processor.d.ts.map