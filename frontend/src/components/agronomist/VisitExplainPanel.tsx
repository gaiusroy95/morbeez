import { useEffect, useState } from 'react';
import { agronomistClient } from '@morbeez/shared';
import { Btn, Panel } from '../ui';
import type { VisitIssueDraft } from './visit-wizard/types';

type Props = {
  issues: VisitIssueDraft[];
};

export function VisitExplainPanel({ issues }: Props) {
  const issue = issues[0];
  const [farmerText, setFarmerText] = useState('');
  const [agronomistText, setAgronomistText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issue?.issueName) return;
    setLoading(true);
    void agronomistClient
      .explainDiagnosis({
        issueName: issue.issueName,
        finalDiagnosis: issue.finalDiagnosis,
        observation: issue.observation,
        severity: issue.severity,
        rootCause: issue.rootCause
          ? {
              symptoms: issue.rootCause.symptoms,
              immediateCause: issue.rootCause.conclusion,
              rootCause: issue.rootCause.conclusion,
            }
          : undefined,
        hypotheses: issue.hypotheses?.map((h) => ({
          label: h.label,
          confidence: h.confidence,
          rationale: h.rationale,
        })),
      })
      .then((r) => {
        setFarmerText(r.farmerText);
        setAgronomistText(r.agronomistText);
      })
      .catch(() => {
        setFarmerText('');
        setAgronomistText('');
      })
      .finally(() => setLoading(false));
  }, [issue?.issueName, issue?.finalDiagnosis, issue?.observation]);

  if (!issue) return null;

  return (
    <Panel title="Diagnosis explainability">
      {loading ? <p className="vw-hint">Generating explanation…</p> : null}
      {farmerText ? (
        <>
          <p className="vw-field-label">Farmer message</p>
          <p className="text-sm">{farmerText}</p>
          <p className="vw-field-label mt-3">Agronomist notes</p>
          <pre className="text-sm whitespace-pre-wrap">{agronomistText}</pre>
        </>
      ) : !loading ? (
        <Btn
          variant="secondary"
          size="sm"
          label="Generate explanation"
          onClick={() => {
            setLoading(true);
            void agronomistClient
              .explainDiagnosis({
                issueName: issue.issueName,
                finalDiagnosis: issue.finalDiagnosis,
                observation: issue.observation,
                severity: issue.severity,
              })
              .then((r) => {
                setFarmerText(r.farmerText);
                setAgronomistText(r.agronomistText);
              })
              .finally(() => setLoading(false));
          }}
        />
      ) : null}
    </Panel>
  );
}
