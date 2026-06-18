import type { VisitIssueDraft } from './types';
import type { RecommendationGroupDraft } from '@morbeez/shared';

type Props = {
  issues: VisitIssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
};

export function VisitCaseClosureStep({ issues, recommendationGroups }: Props) {
  return (
    <div className="vw-stack">
      <p className="vw-hint">
        This visit will enter the learning loop with AI vs final diagnosis, Q&A, photos, recommendations, and outcomes.
      </p>
      {issues.map((issue) => (
        <div key={issue.localId} className="vw-issue-card">
          <div className="vw-issue-title">{issue.issueName}</div>
          <div className="vw-hint">AI: {issue.selectedHypothesisLabel ?? issue.finalDiagnosis ?? '—'}</div>
          <div className="vw-hint">Final: {issue.finalDiagnosis ?? '—'}</div>
          <div className="vw-hint">
            Review: {issue.agronomistReview?.action ?? 'pending'} · Q&A:{' '}
            {(issue.followUpQuestions ?? []).filter((q) => q.answer).length} answered
          </div>
        </div>
      ))}
      <div className="vw-hint">Recommendation groups: {recommendationGroups.length}</div>
    </div>
  );
}
