import type { RecommendationFollowed, VisitFollowupOutcome } from '../types/field-findings.js';

export type PriorRecommendationFollowUpSource = {
  id: string;
  blockId: string | null;
  issueDetected?: string | null;
  recommendationText: string;
  status: string;
};

export type PriorRecommendationFollowUpDraft = {
  recommendationId: string;
  label: string;
  followed: RecommendationFollowed;
  outcome: VisitFollowupOutcome;
  notes: string;
};

/** Only recommendations already sent to the farmer qualify for visit follow-up. */
export function buildPriorRecommendationFollowUps(
  recommendations: PriorRecommendationFollowUpSource[],
  blockId: string,
  max = 5
): PriorRecommendationFollowUpDraft[] {
  return recommendations
    .filter(
      (r) => r.blockId === blockId && String(r.status).toLowerCase() === 'communicated'
    )
    .slice(0, max)
    .map((r) => ({
      recommendationId: r.id,
      label: r.issueDetected?.trim() || r.recommendationText.slice(0, 60),
      followed: 'not_applicable',
      outcome: 'not_reviewed',
      notes: '',
    }));
}
