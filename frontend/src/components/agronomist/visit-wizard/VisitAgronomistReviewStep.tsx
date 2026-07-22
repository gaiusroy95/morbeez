import {
  VALIDATION_DIFF_BANNER,
  buildFarmerExperienceSections,
  collectFarmerRecommendations,
  buildIssueDraftFromFarmerRecommendation,
  issueMatchesFarmerLabel,
  formatActiveIngredientLine,
  slugFarmerLabel,
  type FarmerRecommendationSource,
  type VisitIssueDraft,
} from '@morbeez/shared';
import { VisitIssuesStep } from './VisitIssuesStep';
import { VisitReviewStep } from './VisitReviewStep';
import { VisitCopilotWorkflowChat } from '../visit-copilot/VisitCopilotWorkflowChat';
import { VisitExplainPanel } from '../VisitExplainPanel';
import { newIssueDraft } from './types';
import type { IssueMasterRow } from '@morbeez/shared';

type Props = {
  farmerId: string;
  blockId: string;
  issues: VisitIssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  showValidationBanner?: boolean;
  farmerFeedback?: FarmerRecommendationSource & {
    priorExperience?: string | null;
    priorProduct?: string | null;
    priorOutcome?: string | null;
  };
  /** @deprecated use farmerFeedback */
  farmerSuggestedDiagnosis?: string | null;
  farmerPriorExperience?: string | null;
  farmerPriorProduct?: string | null;
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitAgronomistReviewStep({
  farmerId,
  blockId,
  issues,
  issueMaster,
  cropType,
  showValidationBanner,
  farmerFeedback,
  farmerSuggestedDiagnosis,
  farmerPriorExperience,
  farmerPriorProduct,
  onChange,
}: Props) {
  const feedback: FarmerRecommendationSource & {
    priorExperience?: string | null;
    priorProduct?: string | null;
    priorOutcome?: string | null;
  } = farmerFeedback ?? {
    suggestedDiagnosis: farmerSuggestedDiagnosis,
    priorExperience: farmerPriorExperience,
    priorProduct: farmerPriorProduct,
  };

  const farmerSections = buildFarmerExperienceSections(feedback);
  const farmerRecommendations = collectFarmerRecommendations(feedback);

  function addIssueFromFarmerRecommendation(label: string, reason?: string) {
    const already = issues.some((i) =>
      issueMatchesFarmerLabel(i.issueName, label, i.finalDiagnosis)
    );
    if (already) return;

    const base = buildIssueDraftFromFarmerRecommendation({
      label,
      reason,
      localId: `farmer-${slugFarmerLabel(label)}-${Date.now()}`,
    });
    const draft: VisitIssueDraft = {
      ...newIssueDraft(base.category, base.localId),
      ...base,
    };
    onChange([...issues, draft]);
  }

  const hasFarmerContext =
    farmerSections.observations.length > 0 ||
    farmerSections.activeIngredients.length > 0 ||
    farmerSections.symptomsReported ||
    farmerSections.responseAfterApplication;

  return (
    <div className="vw-stack">
      {showValidationBanner ? (
        <div className="vw-validation-banner">🟡 {VALIDATION_DIFF_BANNER}</div>
      ) : null}

      <p className="vw-hint">
        Review each AI-detected issue. Approve, modify, or reject — then edit issue details to confirm category, type,
        and agronomist notes.
      </p>

      {hasFarmerContext ? (
        <div className="vw-farmer-banner">
          <p className="vw-farmer-banner__title">Farmer recommendation (WhatsApp)</p>
          <p className="vw-farmer-banner__hint">Click a condition to add it to the issues list below.</p>

          {farmerSections.observations.length ? (
            <div className="vw-farmer-section">
              <p className="vw-farmer-section__title">Farmer observations</p>
              <div className="vw-farmer-banner__chips">
                {farmerSections.observations.map((label) => {
                  const added = issues.some((i) =>
                    issueMatchesFarmerLabel(i.issueName, label, i.finalDiagnosis)
                  );
                  return (
                    <button
                      key={label}
                      type="button"
                      className={['vw-farmer-chip', added ? 'vw-farmer-chip--added' : ''].filter(Boolean).join(' ')}
                      disabled={added}
                      onClick={() => addIssueFromFarmerRecommendation(label)}
                    >
                      <span className="vw-farmer-chip__label">
                        {added ? '✓ ' : '+ '}
                        {label}
                      </span>
                      <span className="vw-farmer-chip__action">{added ? 'Added' : 'Add issue'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {farmerSections.activeIngredients.length ? (
            <div className="vw-farmer-section">
              <p className="vw-farmer-section__title">Active ingredients applied</p>
              <ul className="vw-farmer-list">
                {farmerSections.activeIngredients.map((item) => (
                  <li key={item.label}>{formatActiveIngredientLine(item)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <VisitIssuesStep
        issues={issues}
        issueMaster={issueMaster}
        cropType={cropType}
        farmerFeedback={feedback}
        onChange={onChange}
      />
      <VisitReviewStep issues={issues} farmerFeedback={feedback} onChange={onChange} />
      <VisitExplainPanel issues={issues} />
      <VisitCopilotWorkflowChat farmerId={farmerId} blockId={blockId} />
    </div>
  );
}
