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
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitAgronomistReviewStep({ farmerId, blockId, issues, issueMaster, cropType, onChange }: Props) {
  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Review each AI-detected issue. Approve, modify (with observation), or reject before continuing.
      </p>
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
