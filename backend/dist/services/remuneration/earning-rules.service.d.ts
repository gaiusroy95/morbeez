import { type AgronomistSlab, type KpiFactorBand } from '../../domain/remuneration/kpi-factor.js';
import { type SettlementRule } from '../../domain/remuneration/settlement-split.js';
import { type FarmerIntroductionRule } from '../../domain/remuneration/introduction-eligibility.js';
import { type KpiParameter } from '../../domain/remuneration/weighted-kpi.js';
import { type QualifiedCaseRule } from '../../domain/remuneration/qualified-case.js';
import { type DiagnosisQaRule } from '../../domain/remuneration/diagnosis-qa.js';
import { type RuleType } from '../../domain/remuneration/rule-workflow.js';
export type { RuleType };
type RuleRow = {
    id: string;
    rule_type: string;
    version_number: number;
    effective_from: string;
    effective_to: string | null;
    status: string;
    payload: Record<string, unknown>;
    change_reason: string;
    created_by: string | null;
    approved_by: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    activated_at: string | null;
    created_at: string;
};
export declare const earningRulesService: {
    partnerKpiBands(asOf?: Date): Promise<KpiFactorBand[]>;
    agronomistSlabs(asOf?: Date): Promise<AgronomistSlab[]>;
    settlementRule(asOf?: Date): Promise<SettlementRule>;
    returnWindowDays(asOf?: Date): Promise<number>;
    introductionRule(asOf?: Date): Promise<FarmerIntroductionRule & {
        versionId: string | null;
    }>;
    partnerKpiWeights(asOf?: Date): Promise<{
        versionId: string | null;
        parameters: KpiParameter[];
    }>;
    agronomistKpiWeights(asOf?: Date): Promise<{
        versionId: string | null;
        qualifiedCaseTarget: number;
        parameters: KpiParameter[];
    }>;
    qualifiedCaseRule(asOf?: Date): Promise<QualifiedCaseRule & {
        versionId: string | null;
    }>;
    diagnosisQaRule(asOf?: Date): Promise<DiagnosisQaRule & {
        versionId: string | null;
    }>;
    list(): Promise<any[]>;
    get(id: string): Promise<RuleRow>;
    createVersion(input: {
        ruleType: RuleType;
        payload: Record<string, unknown>;
        effectiveFrom: string;
        changeReason: string;
        createdBy?: string | null;
    }): Promise<RuleRow>;
    updateDraft(id: string, patch: {
        payload?: Record<string, unknown>;
        effectiveFrom?: string;
        changeReason?: string;
    }): Promise<RuleRow>;
    transition(id: string, to: "submitted" | "approved" | "scheduled" | "active" | "draft", actor?: string): Promise<RuleRow>;
    listLocks(month?: string): Promise<any[]>;
    freezeMonth(month: string, frozenBy?: string | null): Promise<Record<string, unknown>[]>;
    freezePreviousMonth(asOf?: Date, frozenBy?: string | null): Promise<Record<string, unknown>[]>;
};
//# sourceMappingURL=earning-rules.service.d.ts.map