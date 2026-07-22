import type { BroadcastKind } from './broadcast-copy.js';
export type ThrottleResult = {
    allowed: true;
} | {
    allowed: false;
    reason: string;
};
export declare const broadcastThrottleService: {
    maxPerDay(): number;
    kindCooldownHours(): number;
    shouldSend(params: {
        farmerId: string;
        broadcastKind: BroadcastKind;
        cropType: string;
        priority: number;
    }): Promise<ThrottleResult>;
    logSkipped(params: {
        farmerId: string;
        broadcastKind: BroadcastKind;
        cropType: string;
        dap?: number;
        ruleId?: string;
        campaignId?: string;
        whatsappMessageId?: string | null;
        messageBody: string;
        skipReason: string;
        priority: number;
    }): Promise<void>;
    logSent(params: {
        farmerId: string;
        broadcastKind: BroadcastKind;
        cropType: string;
        dap?: number;
        ruleId?: string;
        campaignId?: string;
        whatsappMessageId?: string | null;
        messageBody: string;
        priority: number;
    }): Promise<void>;
    logFailed(params: {
        farmerId: string;
        broadcastKind: BroadcastKind;
        cropType: string;
        campaignId?: string;
        messageBody: string;
        error: string;
        priority: number;
    }): Promise<void>;
};
//# sourceMappingURL=broadcast-throttle.service.d.ts.map