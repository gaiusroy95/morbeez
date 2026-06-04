import {
  FINDING_TYPE_LABELS,
  REVIEW_SEVERITY_LABELS,
  type FindingType,
  type ReviewSeverity,
} from '../../lib/ai-training-enums';

export type OperationalChain = {
  fieldFinding?: {
    id: string;
    issue: string;
    findingType?: string | null;
    severity?: string | null;
    affectedAreaPct?: number | null;
  };
  recommendation?: {
    id: string;
    summary: string;
    problem?: string | null;
    status?: string | null;
  };
  escalation?: {
    id: string;
    status: string;
    workflowStatus?: string | null;
  };
};

type Props = {
  chain: OperationalChain;
  onOpenFinding?: (findingId: string) => void;
  onOpenRecommendation?: (recommendationId: string) => void;
};

export function OperationalChainPanel({ chain, onOpenFinding, onOpenRecommendation }: Props) {
  const hasAny = chain.fieldFinding || chain.recommendation || chain.escalation;
  if (!hasAny) return null;

  return (
    <section className="tc-op-chain" aria-label="Operational chain">
      <h3 className="tc-op-chain-title">Operational chain</h3>
      <ol className="tc-op-chain-steps">
        <li className={`tc-op-chain-step${chain.fieldFinding ? ' is-linked' : ' is-empty'}`}>
          <span className="tc-op-chain-dot" aria-hidden />
          <div className="tc-op-chain-body">
            <span className="tc-op-chain-label">Field finding</span>
            {chain.fieldFinding ? (
              <>
                <strong className="tc-op-chain-value">{chain.fieldFinding.issue}</strong>
                <span className="tc-op-chain-meta">
                  {chain.fieldFinding.findingType
                    ? FINDING_TYPE_LABELS[chain.fieldFinding.findingType as FindingType] ??
                      chain.fieldFinding.findingType
                    : null}
                  {chain.fieldFinding.severity
                    ? ` · ${REVIEW_SEVERITY_LABELS[chain.fieldFinding.severity as ReviewSeverity] ?? chain.fieldFinding.severity}`
                    : null}
                  {chain.fieldFinding.affectedAreaPct != null
                    ? ` · ${chain.fieldFinding.affectedAreaPct}% affected`
                    : null}
                </span>
                {onOpenFinding ? (
                  <button
                    type="button"
                    className="tc-op-chain-link"
                    onClick={() => onOpenFinding(chain.fieldFinding!.id)}
                  >
                    View finding →
                  </button>
                ) : null}
              </>
            ) : (
              <span className="tc-op-chain-muted">Not recorded in this session</span>
            )}
          </div>
        </li>

        <li className={`tc-op-chain-step${chain.recommendation ? ' is-linked' : ' is-empty'}`}>
          <span className="tc-op-chain-dot" aria-hidden />
          <div className="tc-op-chain-body">
            <span className="tc-op-chain-label">Recommendation</span>
            {chain.recommendation ? (
              <>
                <strong className="tc-op-chain-value">{chain.recommendation.summary}</strong>
                {chain.recommendation.status ? (
                  <span className="tc-op-chain-meta">Status: {chain.recommendation.status}</span>
                ) : null}
                {onOpenRecommendation ? (
                  <button
                    type="button"
                    className="tc-op-chain-link"
                    onClick={() => onOpenRecommendation(chain.recommendation!.id)}
                  >
                    View recommendation →
                  </button>
                ) : null}
              </>
            ) : (
              <span className="tc-op-chain-muted">No recommendation linked</span>
            )}
          </div>
        </li>

        <li className={`tc-op-chain-step${chain.escalation ? ' is-linked' : ' is-empty'}`}>
          <span className="tc-op-chain-dot" aria-hidden />
          <div className="tc-op-chain-body">
            <span className="tc-op-chain-label">Escalation / outcome</span>
            {chain.escalation ? (
              <>
                <strong className="tc-op-chain-value">
                  {chain.escalation.workflowStatus ?? chain.escalation.status}
                </strong>
                <span className="tc-op-chain-meta">Agronomist case review opened from this session</span>
              </>
            ) : (
              <span className="tc-op-chain-muted">Not escalated — outcome tracked via follow-up</span>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
