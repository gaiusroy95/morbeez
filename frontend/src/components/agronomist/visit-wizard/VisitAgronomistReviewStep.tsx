import { VisitIssuesStep } from './VisitIssuesStep';
import { VisitReviewStep } from './VisitReviewStep';
import type { VisitIssueDraft } from './types';
import type { IssueMasterRow } from '@morbeez/shared';

type Props = {
  issues: VisitIssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitAgronomistReviewStep({ issues, issueMaster, cropType, onChange }: Props) {
  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Review each AI-detected issue. Approve, modify (with observation), or reject before continuing.
      </p>
      <VisitIssuesStep issues={issues} issueMaster={issueMaster} cropType={cropType} onChange={onChange} />
      <VisitReviewStep issues={issues} onChange={onChange} />
    </div>
  );
}
