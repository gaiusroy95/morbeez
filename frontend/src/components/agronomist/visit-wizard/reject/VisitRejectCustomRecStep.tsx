import type { VisitAiCustomRecommendation } from '@morbeez/shared';
import { Field, Input } from '../../../ui';

type Props = {
  custom: VisitAiCustomRecommendation;
  onChange: (next: VisitAiCustomRecommendation) => void;
};

export function VisitRejectCustomRecStep({ custom, onChange }: Props) {
  return (
    <div className="vw-reject-flow">
      <span className="vw-field-label">Your prescription</span>
      <Field label="Product">
        <Input value={custom.product} onChange={(e) => onChange({ ...custom, product: e.target.value })} />
      </Field>
      <Field label="Dose">
        <Input value={custom.dose} onChange={(e) => onChange({ ...custom, dose: e.target.value })} />
      </Field>
      <Field label="Application method">
        <Input value={custom.method} onChange={(e) => onChange({ ...custom, method: e.target.value })} />
      </Field>
      <Field label="Review date (optional)">
        <Input
          value={custom.reviewDate ?? ''}
          onChange={(e) => onChange({ ...custom, reviewDate: e.target.value })}
          placeholder="e.g. 15 Jul 2026"
        />
      </Field>
    </div>
  );
}
