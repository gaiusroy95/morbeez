import type { CallChannel, CallLanguage, CallType, FarmerIntent } from '../../domain/ai-calling/types.js';
type EnqueueInput = {
    farmerId: string;
    callType: CallType;
    scheduledAt?: Date;
    leadId?: string | null;
    payload?: Record<string, unknown>;
    language?: CallLanguage;
};
type IdentityRow = {
    id: string;
    slot_number: number;
    agronomist_email: string | null;
    display_name: string;
    did_number: string | null;
    backup_identity_id: string | null;
    is_active: boolean;
};
declare function enabled(): boolean;
export declare const aiCallingOrchestrator: {
    enabled: typeof enabled;
    enqueue(input: EnqueueInput): Promise<{
        id: string;
        reused: boolean;
    } | null>;
    processDueJobs(limit?: number): Promise<number>;
    processJob(jobId: string): Promise<void>;
    deliverWhatsApp(params: {
        job: Record<string, unknown>;
        farmer: Record<string, unknown>;
        identity: IdentityRow | null;
    }): Promise<boolean>;
    openStaffScriptSession(params: {
        job: Record<string, unknown>;
        farmer: Record<string, unknown>;
        prefs: Record<string, unknown> | null;
        channel: CallChannel;
        identity?: IdentityRow | null;
        providerCallId?: string | null;
        note: string;
    }): Promise<void>;
    scriptForJob(job: Record<string, unknown>, language: CallLanguage): Promise<import("../../domain/ai-calling/types.js").CallScript>;
    tryConsumeInboundReply(farmerId: string, text: string): Promise<{
        handled: boolean;
        reply?: string;
    }>;
    applyFarmerReply(params: {
        sessionId: string;
        text: string;
        source: "whatsapp" | "staff_simulate" | "voice_stt";
    }): Promise<{
        farmerReply: string;
        intent: FarmerIntent;
        actionKind: string;
    }>;
    recordQualification(farmerId: string, sessionId: string, payload: Record<string, unknown>, job: Record<string, unknown> | null): Promise<void>;
    escalate(params: {
        farmerId: string;
        sessionId: string;
        jobId: string;
        ladder: "assigned" | "backup" | "queue";
        reason: string;
        priority: "high" | "urgent";
    }): Promise<void>;
    optOut(farmerId: string, reason: string): Promise<void>;
    setConsent(farmerId: string, patch: {
        consentOutboundCall?: boolean;
        consentWhatsapp?: boolean;
        dnd?: boolean;
        language?: CallLanguage;
        bestTimeStart?: string | null;
        bestTimeEnd?: string | null;
    }): Promise<void>;
    upsertIdentity(input: {
        slotNumber: number;
        agronomistEmail?: string | null;
        agronomistAdminId?: string | null;
        displayName?: string;
        didNumber?: string | null;
        backupIdentityId?: string | null;
        isActive?: boolean;
        notes?: string | null;
    }): Promise<any>;
    listConsole(): Promise<{
        voicebotConfigured: boolean;
        whatsappFallback: boolean;
        pendingJobs: number;
        jobs: ({
            id: any;
            farmer_id: any;
            call_type: any;
            status: any;
            scheduled_at: any;
            assigned_agronomist_email: any;
            language: any;
            attempts: any;
            last_error: any;
            created_at: any;
            payload: any;
        } & {
            farmerName: any;
            farmerPhone: any;
            district: any;
        })[];
        sessions: ({
            id: any;
            job_id: any;
            farmer_id: any;
            call_type: any;
            channel: any;
            status: any;
            language_used: any;
            farmer_intent: any;
            outcome: any;
            summary: any;
            started_at: any;
            ended_at: any;
        } & {
            farmerName: any;
            farmerPhone: any;
            district: any;
        })[];
        identities: {
            id: any;
            slot_number: any;
            agronomist_email: any;
            display_name: any;
            did_number: any;
            backup_identity_id: any;
            is_active: any;
            last_assigned_at: any;
            notes: any;
        }[];
        escalations: ({
            id: any;
            farmer_id: any;
            assigned_agronomist_email: any;
            status: any;
            reason: any;
            priority: any;
            created_at: any;
        } & {
            farmerName: any;
            farmerPhone: any;
            district: any;
        })[];
    }>;
    resolveCropDueJob(farmerId: string, cropType: string, plantingDateIso: string): Promise<{
        id: string;
        reused: boolean;
    } | null>;
};
export {};
//# sourceMappingURL=ai-calling-orchestrator.service.d.ts.map