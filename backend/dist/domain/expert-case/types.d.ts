export type ExpertCaseStatus = 'intake' | 'under_review' | 'awaiting_farmer' | 'awaiting_capacity' | 'ready_to_close' | 'closed' | 'merged';
export type ExpertReviewFlag = 'open' | 'awaiting_capacity' | 'closed';
export type ExpertPriorityTier = 'emergency' | 'sla_risk' | 'standard';
export type ExpertAssignmentStatus = 'queued' | 'offered' | 'accepted' | 'working' | 'waiting_external' | 'completed' | 'intervention_required';
export type ExpertCaseRevisionSource = 'farmer_message' | 'photo' | 'visit' | 'advisory_session' | 'expert_draft' | 'system_merge' | 'site_visit' | 'follow_up';
export type ExpertCaseLinkType = 'escalation' | 'advisory_session' | 'visit_ai_case' | 'field_finding' | 'visit_issue' | 'recommendation' | 'callback';
export type SafetyGateDecision = 'PASS' | 'UNRESOLVED' | 'REJECT' | 'OVERRIDDEN';
export type KnowledgeCandidateStatus = 'submitted' | 'needs_evidence' | 'accepted' | 'rejected' | 'withdrawn' | 'quarantined';
export declare function normalizeIssueFingerprint(issueLabel?: string | null): string;
export declare function buildExpertCaseKey(params: {
    farmerId: string;
    blockId?: string | null;
    fingerprint: string;
    generation?: number;
}): string;
export declare function priorityTierFromPriority(priority: string): ExpertPriorityTier;
export declare function slaMinutesForPriority(priority: string): number;
export declare function queueWeightForPriority(priority: string): number;
//# sourceMappingURL=types.d.ts.map