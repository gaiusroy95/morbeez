export declare const CALL_OUTCOMES: readonly ["answered", "connected", "callback", "no_answer", "busy", "completed"];
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export declare const CONNECTED_OUTCOMES: Set<"completed" | "answered" | "connected" | "callback" | "no_answer" | "busy">;
export type CallSummaryJson = {
    bullets: string[];
    crop?: string | null;
    problem?: string | null;
    interestLevel?: 'low' | 'medium' | 'high' | null;
    interestedInSoilTest?: boolean;
    followUpDays?: number | null;
    suggestedStage?: string | null;
    suggestedOutcome?: string | null;
    nextAction?: string | null;
    language?: string | null;
};
export type ConversationChannel = 'call' | 'whatsapp' | 'field';
//# sourceMappingURL=types.d.ts.map