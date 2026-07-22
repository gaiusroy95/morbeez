import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from './types.js';
declare function enabled(): boolean;
/**
 * End-to-end regional terminology pipeline for one inbound farmer message.
 */
export declare const regionalTerminologyProcessor: {
    enabled: typeof enabled;
    processInbound(params: {
        farmerId: string;
        text: string;
        language: AdvisoryLanguage;
        messageType?: string;
        externalMessageId?: string;
    }): Promise<{
        detection: TerminologyDetectionResult | null;
        messageId: string | null;
        /** True when we sent escalation reply and should stop further AI for this turn. */
        handled: boolean;
        reduceAiConfidence: boolean;
    }>;
    localizeOutbound(text: string, detection: TerminologyDetectionResult | null, language: AdvisoryLanguage): string;
    localizeOutboundAsync(text: string, detection: TerminologyDetectionResult | null, language: AdvisoryLanguage, district?: string | null): Promise<string>;
    pendingFarmerCopy(language: AdvisoryLanguage): string;
};
export {};
//# sourceMappingURL=regional-terminology.processor.d.ts.map