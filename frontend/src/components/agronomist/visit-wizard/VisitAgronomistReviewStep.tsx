import {
  collectFarmerRecommendations,
  buildIssueDraftFromFarmerRecommendation,
  issueMatchesFarmerLabel,
  slugFarmerLabel,
  type FarmerRecommendationSource,
  type VisitIssueDraft,
} from '@morbeez/shared';
import { VisitIssuesStep } from './VisitIssuesStep';
import { VisitReviewStep } from './VisitReviewStep';
import { VisitCopilotPanel } from '../VisitCopilotPanel';
import { VisitExplainPanel } from '../VisitExplainPanel';
import { newIssueDraft } from './types';
import type { IssueMasterRow } from '@morbeez/shared';

type Props = {
  farmerId: string;
  blockId: string;
  issues: VisitIssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  farmerFeedback?: FarmerRecommendationSource & {
    priorExperience?: string | null;
    priorProduct?: string | null;
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
  farmerFeedback,
  farmerSuggestedDiagnosis,
  farmerPriorExperience,
  farmerPriorProduct,
  onChange,
}: Props) {
  const feedback: FarmerRecommendationSource & {
    priorExperience?: string | null;
    priorProduct?: string | null;
  } = farmerFeedback ?? {
    suggestedDiagnosis: farmerSuggestedDiagnosis,
    priorExperience: farmerPriorExperience,
    priorProduct: farmerPriorProduct,
  };

  const farmerRecommendations = collectFarmerRecommendations(feedback);
  const farmerExperience = feedback.priorExperience?.trim() || null;
  const farmerProduct = feedback.priorProduct?.trim() || null;

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

  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Review each AI-detected issue. Approve, modify (with observation), or reject before continuing.
      </p>
      {farmerRecommendations.length || farmerExperience || farmerProduct ? (
        <div className="vw-farmer-banner">
          <p className="vw-farmer-banner__title">Farmer recommendation (WhatsApp)</p>
          <p className="vw-farmer-banner__hint">Click a condition to add it to the issues list below.</p>
          <div className="vw-farmer-banner__chips">
            {farmerRecommendations.map((rec) => {
              const added = issues.some((i) =>
                issueMatchesFarmerLabel(i.issueName, rec.label, i.finalDiagnosis)
              );
              return (
                <button
                  key={rec.label}
                  type="button"
                  className={['vw-farmer-chip', added ? 'vw-farmer-chip--added' : ''].filter(Boolean).join(' ')}
                  disabled={added}
                  onClick={() => addIssueFromFarmerRecommendation(rec.label, rec.reason)}
                >
                  <span className="vw-farmer-chip__label">
                    {added ? '✓ ' : '+ '}
                    {rec.label}
                  </span>
                  <span className="vw-farmer-chip__action">{added ? 'Added' : 'Add issue'}</span>
                  {rec.reason ? <span className="vw-farmer-chip__reason">{rec.reason}</span> : null}
                </button>
              );
            })}
          </div>
          {farmerProduct ? <p className="vw-farmer-banner__meta">Prior products: {farmerProduct}</p> : null}
          {farmerExperience ? (
            <p className="vw-farmer-banner__meta whitespace-pre-wrap">{farmerExperience}</p>
          ) : null}
        </div>
      ) : null}
      <VisitIssuesStep issues={issues} issueMaster={issueMaster} cropType={cropType} onChange={onChange} />
      <VisitReviewStep issues={issues} onChange={onChange} />
      <VisitExplainPanel issues={issues} />
      <VisitCopilotPanel
        farmerId={farmerId}
        blockId={blockId}
        cropType={cropType}
        issueName={issues[0]?.finalDiagnosis ?? issues[0]?.issueName}
        aiCaseId={issues[0]?.aiCaseId}
      />
    </div>
  );
}
