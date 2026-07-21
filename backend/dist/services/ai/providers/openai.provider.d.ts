import type { StructuredAdvisory } from '../types.js';
import type { TranscriptionProvider, VisionProvider } from './base.provider.js';
export declare const openaiVisionProvider: VisionProvider;
export declare const openaiWhisperProvider: TranscriptionProvider;
/** Text-only advisory when no image */
export declare function openaiTextAdvisory(systemPrompt: string, userPrompt: string): Promise<StructuredAdvisory>;
/** Generic JSON completion for planners / classifiers (not crop-doctor advisory shape). */
export declare function openaiJsonCompletion<T extends Record<string, unknown>>(systemPrompt: string, userPrompt: string, maxTokens?: number, options?: {
    temperature?: number;
}): Promise<T>;
export type StrictJsonSchema = Record<string, unknown>;
export declare function openaiStrictJsonSchemaCompletion<T>(input: {
    schemaName: string;
    schema: StrictJsonSchema;
    systemPrompt: string;
    userPrompt: string;
    validate: (value: unknown) => {
        ok: true;
        value: T;
    } | {
        ok: false;
        errors: string[];
    };
    maxTokens?: number;
}): Promise<T>;
export declare function openaiStrictJsonSchemaMediaCompletion<T>(input: {
    schemaName: string;
    schema: StrictJsonSchema;
    systemPrompt: string;
    userPrompt: string;
    mediaBase64: string;
    mimeType: string;
    fileName?: string;
    validate: (value: unknown) => {
        ok: true;
        value: T;
    } | {
        ok: false;
        errors: string[];
    };
    maxTokens?: number;
}): Promise<T>;
/**
 * Vision + JSON completion (photos + text → arbitrary JSON schema).
 * Use for photo-calibrated refine / scoring — not crop-doctor StructuredAdvisory shape.
 */
export declare function openaiJsonVisionCompletion<T extends Record<string, unknown>>(systemPrompt: string, userPrompt: string, images: Array<{
    imageBase64: string;
    mimeType: string;
}>, maxTokens?: number, options?: {
    temperature?: number;
}): Promise<T>;
//# sourceMappingURL=openai.provider.d.ts.map