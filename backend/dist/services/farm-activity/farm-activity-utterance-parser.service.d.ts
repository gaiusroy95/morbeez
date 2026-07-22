import type { FarmActivityAssistantSubEvent } from '@morbeez/shared/farm-activity-assistant';
/**
 * Deterministic parser for common WhatsApp activity logs (fertilizer + labour).
 * Used before/alongside LLM extraction so activity messages never fall through to Crop Doctor.
 */
export declare function parseDeterministicFarmActivityUtterance(text: string, messageId: string): FarmActivityAssistantSubEvent[];
//# sourceMappingURL=farm-activity-utterance-parser.service.d.ts.map