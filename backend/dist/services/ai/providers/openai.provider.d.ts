import type { StructuredAdvisory } from '../types.js';
import type { TranscriptionProvider, VisionProvider } from './base.provider.js';
export declare const openaiVisionProvider: VisionProvider;
export declare const openaiWhisperProvider: TranscriptionProvider;
/** Text-only advisory when no image */
export declare function openaiTextAdvisory(systemPrompt: string, userPrompt: string): Promise<StructuredAdvisory>;
/** Generic JSON completion for planners / classifiers (not crop-doctor advisory shape). */
export declare function openaiJsonCompletion<T extends Record<string, unknown>>(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<T>;
//# sourceMappingURL=openai.provider.d.ts.map