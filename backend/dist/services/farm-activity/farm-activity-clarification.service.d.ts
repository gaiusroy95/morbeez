import type { FarmActivityAssistantClarification, FarmActivityAssistantDraftV1 } from '@morbeez/shared/farm-activity-assistant';
import { type BlockWithDap } from '../core/block.service.js';
export declare function normalizePlotAnswer(text: string): string;
/** Match farmer reply ("ginger", "Ginger Plot", crop.ginger) to a farm block id. */
export declare function resolveBlockRefFromBlocks(blocks: BlockWithDap[], text: string): string | null;
export declare function applyClarificationAnswer(input: {
    draft: FarmActivityAssistantDraftV1;
    clarification: FarmActivityAssistantClarification;
    answerText: string;
    messageId: string;
    blockRef?: string | null;
}): FarmActivityAssistantDraftV1 | null;
//# sourceMappingURL=farm-activity-clarification.service.d.ts.map