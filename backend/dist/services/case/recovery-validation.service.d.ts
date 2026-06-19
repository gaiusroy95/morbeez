import type { AdvisoryLanguage } from '../ai/types.js';
export declare const recoveryValidationService: {
    enabled(): boolean;
    scheduleRecoveryLoop(params: {
        farmerId: string;
        sessionId: string;
        cropType: string;
        language: AdvisoryLanguage;
        recommendationRecordId?: string | null;
    }): Promise<void>;
    processRecoveryJobSend(job: {
        farmer_id: string;
        job_type: string;
        payload: Record<string, unknown>;
    }): Promise<void>;
    handleRecoveryReply(params: {
        farmerId: string;
        sessionId?: string;
        day: number;
        outcome: "improved" | "same" | "worse";
    }): Promise<string>;
};
//# sourceMappingURL=recovery-validation.service.d.ts.map