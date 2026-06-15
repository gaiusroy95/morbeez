import { VISIT_WIZARD_STEPS, type VisitWizardStep } from '@morbeez/shared';

type Props = {
  current: VisitWizardStep;
};

export function VisitWizardStepper({ current }: Props) {
  const currentIndex = VISIT_WIZARD_STEPS.findIndex((s) => s.id === current);

  return (
    <nav className="vw-stepper" aria-label="Visit wizard progress">
      {VISIT_WIZARD_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div key={step.id} className="vw-stepper-item">
            <div className="vw-stepper-row">
              <div
                className={[
                  'vw-stepper-dot',
                  done || active ? 'vw-stepper-dot--done' : '',
                  active ? 'vw-stepper-dot--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                {index + 1}
              </div>
              {index < VISIT_WIZARD_STEPS.length - 1 ? (
                <div className={['vw-stepper-line', done ? 'vw-stepper-line--done' : ''].filter(Boolean).join(' ')} />
              ) : null}
            </div>
            <span
              className={['vw-stepper-label', active ? 'vw-stepper-label--active' : ''].filter(Boolean).join(' ')}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
