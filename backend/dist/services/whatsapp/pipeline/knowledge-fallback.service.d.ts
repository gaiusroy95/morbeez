import type { AdvisoryLanguage } from '../../ai/types.js';
import type { StructuredAdvisory } from '../../ai/types.js';
import { type FarmerMemorySnapshot } from './farmer-memory.service.js';
import type { MorbeezReplyModule, ReplyAttributionMeta } from './reply-attribution.service.js';
export declare function isFertilizerOrNutrientQuestion(text: string): boolean;
/**
 * Rule-based / verified-case replies when OpenAI is unavailable (quota, outage).
 * Uses advisory_reuse_cases, spray_compatibility_rules, Ca nitrate chart, and field playbooks.
 */
/** Minimal advisory object when Crop Doctor cannot call OpenAI. */
export declare function advisoryFromKnowledgeText(summary: string, language: AdvisoryLanguage): StructuredAdvisory;
export type KnowledgeFallbackHit = {
    text: string;
    module: MorbeezReplyModule;
    meta?: ReplyAttributionMeta;
};
export declare const knowledgeFallbackService: {
    tryReply(params: {
        farmerId: string;
        text: string;
        language: AdvisoryLanguage;
        memory?: FarmerMemorySnapshot;
        followUp?: boolean;
        hasMedia?: boolean;
    }): Promise<string | null>;
    tryReplyWithModule(params: {
        farmerId: string;
        text: string;
        language: AdvisoryLanguage;
        memory?: FarmerMemorySnapshot;
        followUp?: boolean;
        hasMedia?: boolean;
    }): Promise<KnowledgeFallbackHit | null>;
};
//# sourceMappingURL=knowledge-fallback.service.d.ts.map