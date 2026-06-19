export declare const whatsappDiagnosisContextService: {
    buildFieldContext(params: {
        farmerId: string;
        blockId?: string | null;
        cropType: string;
        issueName: string;
        observation?: string;
        issueCategory?: string;
    }): Promise<string | null>;
    loadSoilSummaryForBlock(farmerId: string, blockId?: string | null): Promise<string | null>;
};
//# sourceMappingURL=whatsapp-diagnosis-context.service.d.ts.map