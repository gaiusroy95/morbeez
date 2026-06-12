export const CALL_OUTCOMES = [
  'answered',
  'connected',
  'callback',
  'no_answer',
  'busy',
  'completed',
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CONNECTED_OUTCOMES = new Set<CallOutcome>(['answered', 'connected', 'callback']);

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
