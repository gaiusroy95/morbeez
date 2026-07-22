import type { DiagnosisReportResponse, DiagnosisStartResponse, DiagnosisV17SessionMeta } from '../../domain/diagnosis/v17-session.types.js';
export type DiagnosisStartInput = {
    farmerId?: string;
    phone?: string;
    name?: string;
    cropType: string;
    symptomsText?: string;
    suspectedIssue?: string;
    language?: 'en' | 'ml';
    contextPack?: DiagnosisV17SessionMeta['contextPack'];
    visionLabel?: string;
    visionConfidence?: number;
    photoCount?: number;
};
export type DiagnosisAnswerInput = {
    answers: Array<{
        questionId?: string;
        questionText: string;
        answer: string;
    }>;
};
/** v17 evidence-driven diagnosis API — Bayesian engine owns probability; no LLM ranking. */
export declare const diagnosisV17Service: {
    start(input: DiagnosisStartInput): Promise<DiagnosisStartResponse>;
    submitAnswers(sessionId: string, input: DiagnosisAnswerInput): Promise<DiagnosisStartResponse>;
    getReport(sessionId: string): Promise<DiagnosisReportResponse>;
};
//# sourceMappingURL=diagnosis-v17.service.d.ts.map