import { type AgronomistReviewAction } from '@morbeez/shared';
import { Field, Input, Panel, textareaClass } from '../../ui';
import type { VisitIssueDraft } from './types';

const REVIEW_ACTIONS: Array<{ value: AgronomistReviewAction; label: string }> = [
  { value: 'approve_ai', label: 'Approve' },
  { value: 'correct_ai', label: 'Modify' },
  { value: 'partial_match', label: 'Partial' },
  { value: 'escalate_urgent', label: 'Reject' },
];

type Props = {
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitReviewStep({ issues, onChange }: Props) {
  function patchIssue(index: number, patch: Partial<VisitIssueDraft>) {
    const next = [...issues];
    const current = next[index]!;
    const action = patch.agronomistReview?.action ?? current.agronomistReview?.action ?? 'approve_ai';
    next[index] = {
      ...current,
      ...patch,
      agronomistReview: {
        action,
        finalDiagnosis: patch.finalDiagnosis ?? current.finalDiagnosis ?? current.agronomistReview?.finalDiagnosis,
        finalRecommendation:
          patch.finalRecommendation ??
          current.finalRecommendation ??
          current.agronomistReview?.finalRecommendation,
        modificationReason:
          patch.agronomistReview?.modificationReason ?? current.agronomistReview?.modificationReason,
        agronomistConfidence:
          patch.agronomistReview?.agronomistConfidence ?? current.agronomistReview?.agronomistConfidence,
        yieldRisk: patch.agronomistReview?.yieldRisk ?? current.agronomistReview?.yieldRisk,
        ...patch.agronomistReview,
      },
    };
    onChange(next);
  }

  return (
    <div className="vw-stack">
      {issues.map((issue, index) => {
        const action = issue.agronomistReview?.action ?? 'approve_ai';
        const needsReason = action === 'correct_ai' || action === 'partial_match' || action === 'escalate_urgent';
        const showEscalationHint = issue.confidenceAction === 'escalate' || issue.severity === 'high';
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {showEscalationHint ? (
              <div className="vw-banner vw-banner--warn">
                This case may need senior agronomist review before farmer communication.
              </div>
            ) : null}
            <span className="vw-field-label">Review decision</span>
            <div className="vw-segmented">
              {REVIEW_ACTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={['vw-segment', action === opt.value ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
                  onClick={() =>
                    patchIssue(index, {
                      agronomistReview: {
                        action: opt.value,
                        finalDiagnosis: issue.finalDiagnosis,
                        finalRecommendation: issue.finalRecommendation,
                      },
                    })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Field label="Final diagnosis">
              <Input
                value={issue.finalDiagnosis ?? ''}
                onChange={(e) => patchIssue(index, { finalDiagnosis: e.target.value })}
              />
            </Field>
            <span className="vw-field-label">Final recommendation</span>
            <textarea
              className={textareaClass}
              value={issue.finalRecommendation ?? ''}
              onChange={(e) => patchIssue(index, { finalRecommendation: e.target.value })}
            />
            {needsReason ? (
              <Field label="Reason for change">
                <Input
                  value={issue.agronomistReview?.modificationReason ?? ''}
                  onChange={(e) =>
                    patchIssue(index, {
                      agronomistReview: {
                        action,
                        modificationReason: e.target.value,
                        finalDiagnosis: issue.finalDiagnosis,
                        finalRecommendation: issue.finalRecommendation,
                      },
                    })
                  }
                />
              </Field>
            ) : null}
            <Field label="Yield risk (optional)">
              <Input
                value={issue.agronomistReview?.yieldRisk ?? ''}
                onChange={(e) =>
                  patchIssue(index, {
                    agronomistReview: {
                      action,
                      yieldRisk: e.target.value,
                      finalDiagnosis: issue.finalDiagnosis,
                      finalRecommendation: issue.finalRecommendation,
                    },
                  })
                }
              />
            </Field>
          </Panel>
        );
      })}
    </div>
  );
}
