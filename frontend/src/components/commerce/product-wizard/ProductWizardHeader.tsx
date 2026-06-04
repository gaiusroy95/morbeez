import { WIZARD_STEPS } from './constants';

type Props = {
  step: number;
  saving: boolean;
  canWrite: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onGoToStep: (n: number) => void;
};

export function ProductWizardHeader({
  step,
  saving,
  canWrite,
  onCancel,
  onSaveDraft,
  onPublish,
  onGoToStep,
}: Props) {
  return (
    <header className="pw-top">
      <nav className="pw-stepper" aria-label="Product wizard progress">
        {WIZARD_STEPS.map((s, idx) => {
          const done = s.n < step;
          const active = s.n === step;
          const canJump = done;
          return (
            <div key={s.n} className="pw-stepper-item-wrap">
              {idx > 0 ? <span className="pw-stepper-line" aria-hidden /> : null}
              <button
                type="button"
                className={`pw-stepper-item ${active ? 'pw-stepper-item--active' : ''} ${done ? 'pw-stepper-item--done' : ''}`}
                disabled={!canJump}
                onClick={() => canJump && onGoToStep(s.n)}
              >
                <span className="pw-stepper-badge">
                  {done ? '✓' : s.n}
                </span>
                <span className="pw-stepper-text">
                  <strong>{s.title}</strong>
                  <small>{s.sub}</small>
                </span>
              </button>
            </div>
          );
        })}
      </nav>
      <div className="pw-top-actions">
        <button type="button" className="pw-btn pw-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        {canWrite ? (
          <>
            <button
              type="button"
              className="pw-btn pw-btn--primary"
              disabled={saving}
              onClick={onSaveDraft}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="pw-btn pw-btn--primary pw-btn--split"
              disabled={saving}
              onClick={onPublish}
            >
              Save &amp; Publish
              <span className="pw-btn-caret" aria-hidden>
                ▾
              </span>
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
