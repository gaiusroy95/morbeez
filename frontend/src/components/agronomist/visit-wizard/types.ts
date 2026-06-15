export type { VisitIssueDraft, VisitPhotoDraft } from '@morbeez/shared';
export type {
  VisitWizardStep,
  VisitDraftPayload,
} from '@morbeez/shared';

import type { IssueCategory, RecommendationFollowed, VisitFollowupOutcome } from '@morbeez/shared';
import type { VisitIssueDraft } from '@morbeez/shared';
import { ISSUE_CATEGORIES } from '@morbeez/shared';

export type FollowUpDraft = {
  recommendationId: string;
  label: string;
  followed: RecommendationFollowed;
  outcome: VisitFollowupOutcome;
  notes: string;
};

export function newIssueDraft(category: IssueCategory, localId: string): VisitIssueDraft {
  return {
    localId,
    category,
    issueName: '',
    severity: 'medium',
    status: 'open',
    observation: '',
    photos: [],
  };
}

export function pickDefaultIssueCategory(): IssueCategory {
  return ISSUE_CATEGORIES[0] ?? 'disease';
}
