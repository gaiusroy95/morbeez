export type ExpertCaseReviewEventType =
  | 'diagnosis'
  | 'hypothesis'
  | 'confidence'
  | 'evidence'
  | 'treatment'
  | 'follow_up'
  | 'recovery'
  | 'knowledge_candidate'
  | 'closure';

export type ExpertCaseReviewDraft = {
  diagnosis?: string | null;
  confidence?: number | null;
  severity?: string | null;
  recommendationText?: string | null;
  dosage?: string | null;
  followUpDays?: number | null;
  recoveryStatus?: string | null;
  knowledgeCandidate?: boolean;
  notes?: string | null;
  unresolvedFields?: string[];
};

export type ExpertCaseReviewProposal = {
  assistantMessage: string;
  clarification: string | null;
  draft: ExpertCaseReviewDraft;
  events?: Array<{ type: ExpertCaseReviewEventType; payload: Record<string, unknown> }>;
};
