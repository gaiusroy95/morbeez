import { ReadOnlyBanner } from '../components/ui';
import { RecommendationApprovalsWorkspace } from '../components/approvals/RecommendationApprovalsWorkspace';
import '../styles/approvals-workspace.css';

export function ApprovalsPage({
  canApprove,
  canWrite,
}: {
  canApprove: boolean;
  canWrite: boolean;
}) {
  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Review agronomist recommendations — edit before approval, approve or reject, and view
        full created / approved audit history.
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      <RecommendationApprovalsWorkspace
        canWrite={canWrite}
        canApprove={canApprove}
        mineOnly={false}
      />
    </div>
  );
}
