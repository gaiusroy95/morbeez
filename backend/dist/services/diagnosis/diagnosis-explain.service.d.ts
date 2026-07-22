import type { VisitAiRootCause } from '../../domain/diagnosis/types.js';
export type ExplainDiagnosisInput = {
    issueName: string;
    finalDiagnosis?: string | null;
    observation?: string | null;
    severity?: string | null;
    rootCause?: VisitAiRootCause | null;
    hypotheses?: Array<{
        label: string;
        confidence: number;
        rationale?: string;
    }>;
};
export declare const diagnosisExplainService: {
    explain(input: ExplainDiagnosisInput): {
        farmerText: string;
        agronomistText: string;
    };
};
//# sourceMappingURL=diagnosis-explain.service.d.ts.map