import { VISIT_WIZARD_STEPS, getVisibleWizardSteps, type VisitWizardStep } from '@morbeez/shared';

type Props = {
  current: VisitWizardStep;
  partnerMode?: boolean;
};

export function VisitWizardStepper({ current, partnerMode }: Props) {
  const steps = getVisibleWizardSteps(partnerMode);
  const currentIndex = steps.indexOf(current);

  return (
    <nav className="vw-stepper" aria-label="Visit wizard progress">
      {steps.map((stepId, index) => {
        const step = VISIT_WIZARD_STEPS.find((s) => s.id === stepId)!;
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={step.id}
            className={[
              'vw-stepper-item',
              done ? 'vw-stepper-item--done' : '',
              active ? 'vw-stepper-item--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="vw-stepper-dot">{index + 1}</div>
            <div className="vw-stepper-label">{step.label}</div>
            {index < steps.length - 1 ? <div className="vw-stepper-line" /> : null}
          </div>
        );
      })}
    </nav>
  );
}
