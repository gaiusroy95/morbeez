export declare const qualifiedCaseEngine: {
    list(month: string, qualified?: boolean): Promise<any[]>;
    scanMonth(month: string, limit?: number): Promise<{
        scanned: number;
        month: string;
        ruleVersionId: string | null;
    }>;
};
//# sourceMappingURL=qualified-case.engine.d.ts.map