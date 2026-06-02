export type OperationalLead = {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerInitials: string;
  phone: string | null;
  stage: string;
  stageLabel: string;
  district: string | null;
  lastInteractionLabel: string | null;
  followUpLabel?: string | null;
  pendingTasksCount: number;
  escalationCount: number;
  priorityBand: string;
  priorityRank: number;
  priorityLabel: string;
  cropSummary: string | null;
  acreage: number | null;
  owner: string | null;
  pincode: string | null;
  language: string | null;
  relationshipScore: number | null;
  opportunityScore: number | null;
  followUpDueAt: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  hasPendingTasks: boolean;
  dap: number | null;
  healthStatus: string | null;
  createdAtLabel: string;
};

export type QueueSummary = {
  pendingTasks: number;
  escalations: number;
  dueToday: number;
  hotLeads: number;
  highOpportunity: number;
  atRisk: number;
  overdue: number;
};

export type PriorityMeta = Record<
  string,
  { rank: number; label: string; color: 'red' | 'orange' | 'yellow' | 'green' | 'gray' }
>;
