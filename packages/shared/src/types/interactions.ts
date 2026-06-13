export type FarmerCallLogSummary = {
  totalCalls: number;
  lastCallAt: string | null;
  lastCallOutcome: string | null;
  lastCallAgent: string | null;
  lastCallSummary: string | null;
  connectedCount: number;
  pendingAiSummary: number;
  recentCalls: Array<{
    id: string;
    outcome: string | null;
    at: string;
    agentEmail: string | null;
    durationSeconds: number | null;
    aiSummary: string | null;
    direction: string;
  }>;
};

export type FarmerInteractionRow = {
  id: string;
  interactionType?: string;
  typeCategory?: string;
  typeIcon?: string;
  summary?: string;
  by?: string;
  role?: string;
  createdLabel?: string;
  displayStatus?: string;
  workflowStatus?: string;
  outcome?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  blockName?: string | null;
  fieldFinding?: string | null;
  fieldActivity?: string | null;
  recommendation?: string | null;
  completionStatus?: 'pending' | 'completed' | null;
};
