import { VisitIssuesStep } from './VisitIssuesStep';
import { VisitReviewStep } from './VisitReviewStep';
import { VisitCopilotPanel } from '../VisitCopilotPanel';
import { VisitExplainPanel } from '../VisitExplainPanel';
import type { VisitIssueDraft } from './types';
import type { IssueMasterRow } from '@morbeez/shared';

type Props = {
  farmerId: string;
  blockId: string;
  issues: VisitIssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
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
  farmerSuggestedDiagnosis,
  farmerPriorExperience,
  farmerPriorProduct,
  onChange,
}: Props) {
  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Review each AI-detected issue. Approve, modify (with observation), or reject before continuing.
      </p>
      {farmerSuggestedDiagnosis || farmerPriorExperience || farmerPriorProduct ? (
        <div className="rounded-[var(--radius-control)] border border-amber-200/80 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Farmer recommendation (WhatsApp)
          </p>
          {farmerSuggestedDiagnosis ? (
            <p className="mt-1 font-semibold">{farmerSuggestedDiagnosis}</p>
          ) : null}
          {farmerPriorProduct ? (
            <p className="mt-1 text-xs">Prior products: {farmerPriorProduct}</p>
          ) : null}
          {farmerPriorExperience ? (
            <p className="mt-1 text-xs whitespace-pre-wrap">{farmerPriorExperience}</p>
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
