import { VISIT_AI_REJECT_REASON_OPTIONS, type VisitAiRejectReason } from '@morbeez/shared';

type Props = {
  value?: VisitAiRejectReason;
  onChange: (reason: VisitAiRejectReason) => void;
};

export function VisitRejectReasonStep({ value, onChange }: Props) {
  return (
    <div className="vw-reject-flow">
      <p className="vw-field-label">Why are you rejecting this recommendation?</p>
      <div className="vw-reject-options">
        {VISIT_AI_REJECT_REASON_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={['vw-reject-option', value === opt.value ? 'vw-reject-option--active' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(opt.value)}
          >
            <span className="vw-reject-option-label">{opt.label}</span>
            <span className="vw-reject-option-desc">{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
