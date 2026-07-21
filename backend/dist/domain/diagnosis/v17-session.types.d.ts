import type { DiagnosisFinalReport } from '../maios-reasoning/management-types.js';
import type { MaiosReasoningSnapshot } from '../maios-reasoning/types.js';
export type DiagnosisV17SessionMeta = {
    version: '17.0';
    cropType: string;
    symptomsText?: string;
    farmerAnswers: Array<{
        questionId?: string;
        questionText: string;
        answer: string;
    }>;
    answeredQuestionIds: string[];
    contextPack?: {
        weatherRiskScore?: number;
        heavyRainLikely?: boolean;
        highHeatLikely?: boolean;
        highHumidityLikely?: boolean;
        soilPh?: number;
        soilEc?: number;
        dap?: number;
    };
    visionLabel?: string | null;
    visionConfidence?: number;
    photoCount?: number;
    lastSnapshot: MaiosReasoningSnapshot;
};
export type DiagnosisStartResponse = {
    sessionId: string;
    pipelineVersion: '17.0';
    decision: MaiosReasoningSnapshot['decision'];
    explanation: MaiosReasoningSnapshot['explanation'];
    nextEvidence: MaiosReasoningSnapshot['nextEvidence'];
    posterior: MaiosReasoningSnapshot['posterior'];
    finalReport: DiagnosisFinalReport;
    management: MaiosReasoningSnapshot['management'];
    safety: MaiosReasoningSnapshot['safety'];
};
export type DiagnosisReportResponse = {
    sessionId: string;
    report: DiagnosisFinalReport;
    decision: MaiosReasoningSnapshot['decision'];
};
//# sourceMappingURL=v17-session.types.d.ts.map