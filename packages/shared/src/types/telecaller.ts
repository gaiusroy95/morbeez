export type TelecallerDashboard = {
  overview: {
    callsToday: number;
    pendingFollowUps: number;
    followUpsDueToday?: number;
    interestedFarmers: number;
    myLeadsCount: number;
    allLeadsCount: number;
  };
  qc: {
    callsToday: number;
    totalCalls: number;
    averageScore: number;
    interested: number;
    soilTestInterest: number;
    flaggedCalls: number;
  };
  queueHealth?: Record<string, unknown>;
};

export const EMPTY_TELECALLER_DASHBOARD: TelecallerDashboard = {
  overview: {
    callsToday: 0,
    pendingFollowUps: 0,
    followUpsDueToday: 0,
    interestedFarmers: 0,
    myLeadsCount: 0,
    allLeadsCount: 0,
  },
  qc: {
    callsToday: 0,
    totalCalls: 0,
    averageScore: 0,
    interested: 0,
    soilTestInterest: 0,
    flaggedCalls: 0,
  },
};

export type TelecallerLeadRow = {
  id: string;
  farmerName: string;
  farmerInitials: string;
  phone: string | null;
  stageLabel: string;
  stage: string;
  district: string | null;
  lastInteractionLabel: string | null;
  followUpLabel?: string | null;
};

export type TelecallerTaskRow = {
  id: string;
  title: string;
  dueLabel?: string;
  isDueToday?: boolean;
  leadId?: string;
  farmerName?: string;
};

export type TelecallerCallRow = {
  id: string;
  processing_status: string;
  ai_summary: string | null;
  qc_score: number | null;
  qc_flagged: boolean;
};

export type TelecallerTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  at: string;
  meta?: Record<string, unknown>;
};

export type PendingCallUpload = {
  id: string;
  leadId: string;
  audioBase64: string;
  mimeType: string;
  filename: string;
  outcome: string;
  durationSeconds: number;
  createdAt: string;
};
