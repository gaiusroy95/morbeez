export declare const diagnosisQaService: {
    list(month: string): Promise<any[]>;
    summary(month: string, agronomistEmail?: string): Promise<{
        sampled: number;
        pending: number;
        skipped: number;
        accurate: number;
        inaccurate: number;
        accuracyPct: number;
    }>;
    draw(month: string, force?: boolean): Promise<{
        drawn: number;
        existing: number;
        month: string;
        sampleSize?: undefined;
        ruleVersionId?: undefined;
    } | {
        drawn: number;
        existing: number;
        month: string;
        sampleSize: number;
        ruleVersionId?: undefined;
    } | {
        drawn: number;
        existing: number;
        month: string;
        sampleSize: number;
        ruleVersionId: string | null;
    }>;
    ensureSample(month: string): Promise<{
        drawn: number;
        existing: number;
        month: string;
        sampleSize?: undefined;
        ruleVersionId?: undefined;
    } | {
        drawn: number;
        existing: number;
        month: string;
        sampleSize: number;
        ruleVersionId?: undefined;
    } | {
        drawn: number;
        existing: number;
        month: string;
        sampleSize: number;
        ruleVersionId: string | null;
    }>;
    audit(id: string, input: {
        status: "accurate" | "inaccurate" | "skipped";
        notes?: string;
        auditor?: string;
    }): Promise<any>;
};
//# sourceMappingURL=diagnosis-qa.service.d.ts.map