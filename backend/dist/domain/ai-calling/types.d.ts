export declare const CALL_LANGUAGES: readonly ["en", "ml", "ta", "kn", "hi"];
export type CallLanguage = (typeof CALL_LANGUAGES)[number];
export declare const CALL_TYPES: readonly ["qualification", "reminder", "crop_application", "health_follow_up", "escalation"];
export type CallType = (typeof CALL_TYPES)[number];
export declare const FARMER_INTENTS: readonly ["yes_completed", "no_pending", "symptoms", "worsening", "human_requested", "opt_out", "unclear"];
export type FarmerIntent = (typeof FARMER_INTENTS)[number];
export declare const CALL_CHANNELS: readonly ["voice", "whatsapp", "staff_script"];
export type CallChannel = (typeof CALL_CHANNELS)[number];
export type QualificationBand = 'HOT' | 'WARM' | 'COLD';
export type QualificationAnswers = {
    hasName?: boolean;
    hasPhone?: boolean;
    hasLocation?: boolean;
    crop?: string | null;
    acres?: number | null;
    cropAgeDays?: number | null;
    problemStated?: boolean;
    requirementStated?: boolean;
    marketingSource?: string | null;
    availabilityStated?: boolean;
};
export type QualificationResult = {
    score: number;
    band: QualificationBand;
    answers: QualificationAnswers;
};
export type CropProtocolMatch = {
    cropType: string;
    stageKey: string;
    stageLabel: string;
    dapFrom: number;
    dapTo: number;
    promptKind: 'application' | 'health' | 'reminder';
    questionEn: string;
    followUpHoursIfNo: number;
    healthFollowUpDays: number[];
};
export type CallRuleAction = {
    kind: 'mark_completed';
    note: string;
} | {
    kind: 'schedule_reminder';
    hours: number;
    note: string;
} | {
    kind: 'open_ticket';
    priority: 'high' | 'urgent';
    note: string;
} | {
    kind: 'escalate';
    ladder: 'assigned' | 'backup' | 'queue';
    note: string;
} | {
    kind: 'opt_out';
    note: string;
} | {
    kind: 'transfer_human';
    note: string;
} | {
    kind: 'clarify';
    note: string;
};
export type CallScript = {
    language: CallLanguage;
    opening: string;
    body: string;
    closing: string;
    /** Combined farmer-facing text. Never contains a chemical prescription. */
    fullText: string;
};
export type CallingWindow = {
    allowed: boolean;
    reason: 'ok' | 'quiet_hours' | 'dnd' | 'opted_out' | 'no_consent';
    nextAllowedAt?: Date;
};
//# sourceMappingURL=types.d.ts.map