import type { StructuredAdvisory, PlantIdHealthResult } from '../types.js';
export interface VisionInput {
    imageBase64: string;
    mimeType: string;
    userPrompt: string;
    systemPrompt: string;
    /** Lower values improve repeatability for diagnosis (default: provider default). */
    temperature?: number;
    /** Additional photos from the same farmer message burst (analyzed together). */
    additionalImages?: Array<{
        imageBase64: string;
        mimeType: string;
    }>;
}
export interface VisionProvider {
    readonly name: string;
    analyzeVision(input: VisionInput): Promise<StructuredAdvisory>;
}
export interface HealthAssessmentInput {
    imageBase64: string;
}
export interface PlantHealthProvider {
    readonly name: string;
    assessHealth(input: HealthAssessmentInput): Promise<PlantIdHealthResult>;
}
export interface TranscriptionInput {
    audioBuffer: Buffer;
    mimeType: string;
    languageHint?: string;
}
export interface TranscriptionProvider {
    readonly name: string;
    transcribe(input: TranscriptionInput): Promise<string>;
}
//# sourceMappingURL=base.provider.d.ts.map