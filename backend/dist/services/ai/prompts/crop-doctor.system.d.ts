/** System prompt — AI-assisted, not autonomous diagnosis */
export declare const CROP_DOCTOR_SYSTEM_PROMPT: string;
export declare function buildUserPrompt(params: {
    cropType: string;
    cropStage?: string;
    symptomsText?: string;
    voiceTranscript?: string;
    plantIdSummary?: string;
    farmerHistory?: string;
    /** WhatsApp session memory: crop, DAP, recent chat — do not re-ask crop if present here */
    whatsappContext?: string;
    verifiedRegionalHints?: string;
    /** Live weather, season, disease–weather priors, nearby farmer cases */
    environmentalContext?: string;
    language: string;
}): string;
//# sourceMappingURL=crop-doctor.system.d.ts.map