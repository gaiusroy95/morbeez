/** Default workflow statuses for operational interaction sessions. */
export const CRM_WORKFLOW_STATUSES = ['Active', 'Closed', 'Escalated'] as const;

export type CrmWorkflowStatus = (typeof CRM_WORKFLOW_STATUSES)[number];
