import type { AdvisoryLanguage } from '../../ai/types.js';
/** Morbeez knowledge module that produced the farmer-visible answer (not generic ChatGPT). */
export type MorbeezReplyModule = 'verified_case' | 'compatibility_chart' | 'knowledge_fallback' | 'crop_doctor_reuse' | 'crop_doctor_openai' | 'conversational_openai' | 'playbook' | 'regional_learning' | 'follow_up_memory';
export type ReplyAttributionMeta = {
    cropType?: string;
    district?: string;
    reuseCaseId?: string;
    verifiedCaseCount?: number;
    issueLabel?: string;
};
export declare const replyAttributionService: {
    moduleLabel(module: MorbeezReplyModule, language: AdvisoryLanguage): string;
    /** One-line farmer USP: Morbeez module, not generic internet AI. */
    buildAttributionLine(module: MorbeezReplyModule, language: AdvisoryLanguage, meta?: ReplyAttributionMeta): string;
    attachAttribution(body: string, module: MorbeezReplyModule, language: AdvisoryLanguage, meta?: ReplyAttributionMeta): string;
    countVerifiedCases(cropType: string, district?: string | null): Promise<number>;
    logAttribution(params: {
        farmerId: string;
        module: MorbeezReplyModule;
        meta?: ReplyAttributionMeta;
    }): Promise<void>;
    enrichMeta(meta: ReplyAttributionMeta | undefined, module: MorbeezReplyModule): Promise<ReplyAttributionMeta>;
    /** Attach USP line, send, and log for analytics. */
    deliverAttributedReply(params: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        body: string;
        module: MorbeezReplyModule;
        meta?: ReplyAttributionMeta;
        sendText: (phone: string, text: string) => Promise<void>;
    }): Promise<string>;
};
//# sourceMappingURL=reply-attribution.service.d.ts.map