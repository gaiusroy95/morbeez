export type ExpertCaseStatus =
  | 'intake'
  | 'under_review'
  | 'awaiting_farmer'
  | 'awaiting_capacity'
  | 'ready_to_close'
  | 'closed'
  | 'merged';

export type ExpertReviewFlag = 'open' | 'awaiting_capacity' | 'closed';

export type ExpertPriorityTier = 'emergency' | 'sla_risk' | 'standard';

export type ExpertAssignmentStatus =
  | 'queued'
  | 'offered'
  | 'accepted'
  | 'working'
  | 'waiting_external'
  | 'completed'
  | 'intervention_required';

export type ExpertCaseRevisionSource =
  | 'farmer_message'
  | 'photo'
  | 'visit'
  | 'advisory_session'
  | 'expert_draft'
  | 'system_merge'
  | 'site_visit'
  | 'follow_up';

export type ExpertCaseLinkType =
  | 'escalation'
  | 'advisory_session'
  | 'visit_ai_case'
  | 'field_finding'
  | 'visit_issue'
  | 'recommendation'
  | 'callback';

export type SafetyGateDecision = 'PASS' | 'UNRESOLVED' | 'REJECT' | 'OVERRIDDEN';

export type KnowledgeCandidateStatus =
  | 'submitted'
  | 'needs_evidence'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'quarantined';

export function normalizeIssueFingerprint(issueLabel?: string | null): string {
  const raw = String(issueLabel ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return 'unknown';
  return raw.slice(0, 80);
}

export function buildExpertCaseKey(params: {
  farmerId: string;
  blockId?: string | null;
  fingerprint: string;
  generation?: number;
}): string {
  const block = params.blockId || 'noblock';
  const gen = params.generation && params.generation > 1 ? `:g${params.generation}` : '';
  return `ec:${params.farmerId}:${block}:${params.fingerprint}${gen}`;
}

export function priorityTierFromPriority(priority: string): ExpertPriorityTier {
  if (priority === 'urgent') return 'emergency';
  if (priority === 'high') return 'sla_risk';
  return 'standard';
}

export function slaMinutesForPriority(priority: string): number {
  switch (priority) {
    case 'urgent':
      return 30;
    case 'high':
      return 120;
    case 'low':
      return 480;
    default:
      return 240;
  }
}

export function queueWeightForPriority(priority: string): number {
  switch (priority) {
    case 'urgent':
      return 2;
    case 'high':
      return 1.5;
    case 'low':
      return 0.5;
    default:
      return 1;
  }
}
