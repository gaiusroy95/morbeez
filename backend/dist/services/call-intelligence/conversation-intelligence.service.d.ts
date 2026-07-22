import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from '../regional-terminology/types.js';
import type { ConversationChannel } from '../../domain/call-intelligence/types.js';
export declare const conversationIntelligenceService: {
    processText(input: {
        farmerId: string;
        leadId?: string | null;
        text: string;
        channel: ConversationChannel;
        language?: AdvisoryLanguage;
        district?: string | null;
        cropType?: string | null;
        agentEmail?: string | null;
    }): Promise<{
        expandedText: string;
        detection: TerminologyDetectionResult | null;
        unknownTerms: string[];
    }>;
};
//# sourceMappingURL=conversation-intelligence.service.d.ts.map