import { Panel } from '../../ui';
import type { VisitIssueDraft } from './types';

type Props = {
  issues: VisitIssueDraft[];
};

export function VisitFinalDiagnosisStep({ issues }: Props) {
  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Confirm the final diagnosis for each issue before recommendation planning. These summaries are read-only here;
        update on the Q&A step if needed.
      </p>
      {issues.map((issue, index) => (
        <Panel key={issue.localId} title={`Issue ${index + 1}: ${issue.issueName}`}>
          <div className="vw-row">
            <span className="vw-row-label">Category</span>
            <span className="vw-row-value">{issue.category.replace(/_/g, ' ')}</span>
          </div>
          <div className="vw-row">
            <span className="vw-row-label">Final diagnosis</span>
            <span
              className={['vw-row-value', !issue.finalDiagnosis?.trim() ? 'vw-row-value--missing' : '']
                .filter(Boolean)
                .join(' ')}
            >
              {issue.finalDiagnosis?.trim() || 'Not set — go back to Q&A'}
            </span>
          </div>
          {issue.observation?.trim() ? (
            <div style={{ paddingTop: 8 }}>
              <span className="vw-field-label">Field notes</span>
              <p className="vw-hint" style={{ color: '#0f172a', marginTop: 4 }}>
                {issue.observation}
              </p>
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
