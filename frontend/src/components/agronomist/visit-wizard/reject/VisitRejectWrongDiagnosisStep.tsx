import { Field, Input, Panel } from '../../../ui';

type Props = {
  aiDiagnosis: string;
  correctedDiagnosis: string;
  onChangeCorrected: (value: string) => void;
};

export function VisitRejectWrongDiagnosisStep({ aiDiagnosis, correctedDiagnosis, onChangeCorrected }: Props) {
  return (
    <div className="vw-reject-flow">
      <Panel title="AI diagnosis">
        <p>{aiDiagnosis || '—'}</p>
      </Panel>
      <Field label="Correct diagnosis">
        <Input
          value={correctedDiagnosis}
          onChange={(e) => onChangeCorrected(e.target.value)}
          placeholder="Enter the correct diagnosis"
        />
      </Field>
      <p className="vw-muted">A new recommendation will be generated from the corrected diagnosis.</p>
    </div>
  );
}
