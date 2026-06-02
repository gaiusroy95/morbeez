export declare const osPrecisionService: {
    /**
     * Morbeez modular AI precision — reuse, module mix, vs generic OpenAI path.
     */
    getModulePrecision(days?: number): Promise<{
        periodDays: number;
        since: string;
        kpis: {
            whatsappRepliesTagged: number;
            modularReplySharePct: number;
            openaiReplySharePct: number;
            verifiedReuseCasesTotal: number;
            diagnosisSessions: number;
            diagnosisFromReuseCachePct: number;
            escalationRatePct: number;
            avgDiagnosisConfidencePct: number;
            uspHeadline: string;
        };
        moduleBreakdown: {
            module: string;
            count: number;
            sharePct: number;
        }[];
        topReuseCases: {
            cropType: any;
            district: any;
            hitCount: any;
        }[];
        topCropsByReplies: {
            crop: string;
            count: number;
        }[];
    }>;
};
//# sourceMappingURL=os-precision.service.d.ts.map