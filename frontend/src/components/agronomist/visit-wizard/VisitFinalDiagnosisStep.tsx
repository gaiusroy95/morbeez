import { useEffect } from 'react';
import { expandSeparateNutrientIssues } from '@morbeez/shared';
import { Field, Input, Panel, textareaClass } from '../../ui';
import type { VisitIssueDraft } from './types';

type Props = {
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitFinalDiagnosisStep({ issues, onChange }: Props) {
  useEffect(() => {
    const expanded = expandSeparateNutrientIssues(issues);
    const changed =
      expanded.length !== issues.length ||
      expanded.some((row, i) => row.issueName !== issues[i]?.issueName);
    if (changed) onChange(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchIssue(index: number, patch: Partial<VisitIssueDraft>) {
    const next = [...issues];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Confirm or correct the diagnosis for each issue before recommendation planning. Update the issue name if the
        field problem was described incorrectly.
      </p>
      {issues.map((issue, index) => (
        <Panel key={issue.localId} title={`Issue ${index + 1}`}>
          <Field label="Issue name">
            <Input
              value={issue.issueName}
              onChange={(e) => patchIssue(index, { issueName: e.target.value })}
              placeholder="e.g. Rhizome rot, K deficiency"
            />
          </Field>
          <div className="vw-row">
            <span className="vw-row-label">Category</span>
            <span className="vw-row-value">{issue.category.replace(/_/g, ' ')}</span>
          </div>
          {issue.rootCause ? (
            <div className="vw-root-cause-chain" style={{ marginTop: 12 }}>
              <span className="vw-field-label">Root cause chain</span>
              <div className="vw-hint" style={{ color: '#0f172a' }}>
                {(issue.rootCause.symptoms ?? []).join(', ')}
                {issue.rootCause.immediateCause ? ` → ${issue.rootCause.immediateCause}` : ''}
                {issue.rootCause.rootCause ? ` → ${issue.rootCause.rootCause}` : ''}
              </div>
            </div>
          ) : null}
          <Field label="Final diagnosis">
            <textarea
              className={textareaClass}
              value={issue.finalDiagnosis ?? ''}
              onChange={(e) =>
                patchIssue(index, {
                  finalDiagnosis: e.target.value,
                  selectedHypothesisLabel: e.target.value.trim() || issue.selectedHypothesisLabel,
                })
              }
              placeholder="Enter or correct the confirmed diagnosis"
              rows={2}
            />
          </Field>
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
