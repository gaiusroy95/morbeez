export declare const callDiagnosisService: {
    runFromTranscript(input: {
        farmerId: string;
        leadId: string;
        transcript: string;
        blockId?: string | null;
        imageBase64?: string;
        imageMimeType?: string;
    }): Promise<import("../ai/types.js").DiagnoseResult>;
};
//# sourceMappingURL=call-diagnosis.service.d.ts.map