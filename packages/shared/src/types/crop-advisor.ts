export type CropAdvisorDashboard = {
  overview: {
    callsToday: number;
    pendingFollowUps: number;
    followUpsDueToday?: number;
    interestedFarmers: number;
    myLeadsCount: number;
    allLeadsCount: number;
    ordersGenerated?: number;
    revenue?: number;
    conversionRate?: number;
    monthlyTarget?: number;
    openEscalations?: number;
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
  actionQueue?: CropAdvisorActionQueueItem[];
  todaysTasks?: CropAdvisorTaskRow[];
  escalations?: number;
};

export const EMPTY_CROP_ADVISOR_DASHBOARD: CropAdvisorDashboard = {
  overview: {
    callsToday: 0,
    pendingFollowUps: 0,
    followUpsDueToday: 0,
    interestedFarmers: 0,
    myLeadsCount: 0,
    allLeadsCount: 0,
    ordersGenerated: 0,
    revenue: 0,
    conversionRate: 0,
    monthlyTarget: 0,
    openEscalations: 0,
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

export type CropAdvisorLeadRow = {
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

export type CropAdvisorOperationalLeadRow = {
  id: string;
  farmerId: string;
  farmerName: string;
  phone: string | null;
  district: string | null;
  village?: string | null;
  stageLabel: string;
  stage: string;
  primaryCrop?: string | null;
  healthStatus?: string | null;
  openTaskCount?: number;
  pendingTasksCount?: number;
  escalationCount?: number;
  opportunityScore?: number | null;
  priorityLabel?: string;
  lastInteractionLabel?: string | null;
  followUpLabel?: string | null;
  isOverdue?: boolean;
  isDueToday?: boolean;
  acreage?: number | null;
};

export type CropAdvisorTaskRow = {
  id: string;
  title: string;
  dueLabel?: string;
  isDueToday?: boolean;
  leadId?: string;
  farmerName?: string;
  category?: string;
  status?: string;
  dueAt?: string | null;
  taskType?: string;
};

export type CropAdvisorFollowUpSections = {
  today: CropAdvisorTaskRow[];
  overdue: CropAdvisorTaskRow[];
  upcoming: CropAdvisorTaskRow[];
  recommendationReviews: CropAdvisorTaskRow[];
  visitFollowUps: CropAdvisorTaskRow[];
  orderFollowUps: CropAdvisorTaskRow[];
  general: CropAdvisorTaskRow[];
};

export type CropAdvisorCallRow = {
  id: string;
  processing_status: string;
  ai_summary: string | null;
  qc_score: number | null;
  qc_flagged: boolean;
  transcript?: string | null;
  recording_url?: string | null;
  duration_seconds?: number | null;
  direction?: string | null;
  created_at?: string | null;
  qc_status?: string | null;
  compliance_flags?: string[] | null;
  action_items?: Array<{ label: string; type?: string }> | null;
  farmer_phone?: string | null;
  lead_id?: string | null;
};

export type CropAdvisorTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  at: string;
  meta?: Record<string, unknown>;
};

export type CropAdvisorWorkspaceSummary = {
  leadId: string;
  farmerId: string;
  farmer: {
    id: string;
    name: string;
    phone: string | null;
    district: string | null;
    village?: string | null;
    language?: string | null;
    acreage: number | null;
  };
  lead: {
    stage: string;
    stageLabel: string;
    assignedCropAdvisor?: string | null;
    assignedAgronomist?: string | null;
    leadSource?: string | null;
    campaign?: string | null;
    tags?: string[];
    customerSince?: string | null;
    ownership?: string | null;
    serviceModel?: string | null;
    assignedPartnerId?: string | null;
    assignedPartnerName?: string | null;
    enrollmentSource?: string | null;
  };
  ownership?: import('./partner').FarmerOwnership | null;
  intelligence: {
    opportunityScore?: number | null;
    relationshipScore?: number | null;
    revenueGenerated?: number | null;
  };
  healthStatus: string;
  activeCrops: string[];
  dap: number | null;
  lastVisitAt: string | null;
  lastInteractionAt: string | null;
  pendingTaskCount: number;
  openEscalationCount: number;
  openRecommendationsCount: number;
  lastOrderAt: string | null;
  blockCount: number;
};

export type CropAdvisorActionQueueItem = {
  id: string;
  category: string;
  label: string;
  count: number;
  leadId?: string;
  farmerName?: string;
};

export type CropAdvisorNotification = {
  id: string;
  category: string;
  title: string;
  detail?: string | null;
  at: string;
  leadId?: string;
  taskId?: string;
  read?: boolean;
};

export type CropAdvisorQueueSummary = {
  all?: number;
  pending?: number;
  overdue?: number;
  dueToday?: number;
  escalated?: number;
  hotLeads?: number;
  highAcreage?: number;
  [key: string]: number | undefined;
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

export type LeadWorkspaceTab =
  | 'overview'
  | 'team'
  | 'interactions'
  | 'blocks'
  | 'recommendations'
  | 'orders'
  | 'notes';
