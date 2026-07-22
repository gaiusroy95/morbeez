import type { DiagnosisFinalReport, SafetyValidationResult, ScientificManagementPlan } from '../../domain/maios-reasoning/management-types.js';
import type { ReasoningDecision, ReasoningEvidenceItem, ReasoningExplanation } from '../../domain/maios-reasoning/types.js';
/** Domain 10 — structured final report for API and visit/WhatsApp surfaces. */
export declare const maiosFinalReportService: {
    build(params: {
        decision: ReasoningDecision;
        explanation: ReasoningExplanation;
        evidence: ReasoningEvidenceItem[];
        management: ScientificManagementPlan | null;
        safety: SafetyValidationResult | null;
        nextStepLabel: string | null;
    }): DiagnosisFinalReport;
};
//# sourceMappingURL=final-report.service.d.ts.map