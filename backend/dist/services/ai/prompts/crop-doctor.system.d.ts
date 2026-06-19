/** System prompt — Morbeez field intelligence diagnosis */
export declare const CROP_DOCTOR_SYSTEM_PROMPT: string;
export declare function buildUserPrompt(params: {
    cropType: string;
    cropStage?: string;
    symptomsText?: string;
    voiceTranscript?: string;
    plantIdSummary?: string;
    farmerHistory?: string;
    whatsappContext?: string;
    verifiedRegionalHints?: string;
    environmentalContext?: string;
    morbeezFieldContext?: string;
    fieldInvestigation?: string;
    issueLabelHint?: string;
    language: string;
    /** When farmer sent multiple photos in one burst. */
    photoCount?: number;
}): string;
//# sourceMappingURL=crop-doctor.system.d.ts.map