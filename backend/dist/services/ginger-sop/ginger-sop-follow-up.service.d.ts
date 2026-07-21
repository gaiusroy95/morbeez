import type { AdvisoryLanguage } from '../ai/types.js';
export declare const gingerSopFollowUpService: {
    enabled(): boolean;
    scheduleRecoveryLoop(params: {
        farmerId: string;
        sessionId: string;
        language: AdvisoryLanguage;
        recommendationRecordId?: string | null;
        issueLabel?: string | null;
    }): Promise<void>;
    processRecoveryJob(job: {
        farmer_id: string;
        job_type: string;
        payload: Record<string, unknown>;
    }): Promise<void>;
    handleRecoveryReply(params: {
        farmerId: string;
        day: number;
        outcome: "improved" | "same" | "worse";
        sessionId?: string;
    }): Promise<string>;
};
//# sourceMappingURL=ginger-sop-follow-up.service.d.ts.map