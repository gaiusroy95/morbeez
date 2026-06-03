import { telecallerAdminService, type TelecallerListQuery } from './telecaller-admin.service.js';
export type LeadPriorityBand = 'escalated' | 'overdue' | 'due_today' | 'follow_up' | 'hot_lead' | 'high_opportunity' | 'new_lead' | 'inactive';
export type OperationalLeadSmartFilter = 'all' | 'pending' | 'escalated' | 'overdue' | 'due_today' | 'hot_leads' | 'high_acreage' | 'no_engagement';
export type OperationalLeadSort = 'priority' | 'pending_tasks' | 'escalations' | 'opportunity_score' | 'relationship_score' | 'acreage' | 'follow_up_due' | 'recent_interaction' | 'recently_added';
export interface OperationalLeadListQuery extends TelecallerListQuery {
    pendingTasks?: boolean;
    escalations?: boolean;
    district?: string;
    pincode?: string;
    language?: string;
    crop?: string;
    owner?: string;
    opportunityLevel?: 'high' | 'medium' | 'low';
    smartFilter?: OperationalLeadSmartFilter;
    sort?: OperationalLeadSort;
    limit?: number;
}
export type OperationalLeadRow = Awaited<ReturnType<typeof telecallerAdminService.listLeads>>['leads'][number] & {
    pendingTasksCount: number;
    escalationCount: number;
    priorityBand: LeadPriorityBand;
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
export declare const telecallerLeadQueueService: {
    priorityMeta: Record<LeadPriorityBand, {
        rank: number;
        label: string;
        color: "red" | "orange" | "yellow" | "green" | "gray";
    }>;
    listOperationalLeads(query: OperationalLeadListQuery, agentEmail: string): Promise<{
        leads: OperationalLeadRow[];
        counts: {
            visible: number;
            inScope: number;
            scopeTotal: number;
            mine: number;
            all: number;
        };
        filtersActive: boolean;
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
        priorityMeta: Record<LeadPriorityBand, {
            rank: number;
            label: string;
            color: "red" | "orange" | "yellow" | "green" | "gray";
        }>;
    }>;
    getQueueSummary(agentEmail: string, scope?: "mine" | "all"): Promise<{
        pendingTasks: number;
        escalations: number;
        dueToday: number;
        hotLeads: number;
        highOpportunity: number;
        atRisk: number;
        overdue: number;
    }>;
    listAssignableTeam(): Promise<{
        email: string;
        fullName: string;
        role: string;
    }[]>;
    leadsToCsv(rows: OperationalLeadRow[]): string;
    exportLeads(query: OperationalLeadListQuery, agentEmail: string, leadIds?: string[]): Promise<{
        csv: string;
        count: number;
    }>;
    bulkUpdateLeads(leadIds: string[], action: "change_owner" | "assign_employee" | "change_stage" | "add_broadcast_tag" | "delete", payload: {
        owner?: string;
        stage?: string;
        broadcastTag?: string;
    }, agentEmail: string): Promise<{
        updated: number;
    }>;
};
//# sourceMappingURL=telecaller-lead-queue.service.d.ts.map