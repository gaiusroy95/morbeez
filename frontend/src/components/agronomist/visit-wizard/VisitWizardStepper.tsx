import { VISIT_WIZARD_STEPS, getVisibleWizardSteps, type VisitWizardStep } from '@morbeez/shared';
import { cn } from '../../../lib/cn';

type Props = {
  current: VisitWizardStep;
  partnerMode?: boolean;
};

export function VisitWizardStepper({ current, partnerMode }: Props) {
  const steps = getVisibleWizardSteps(partnerMode);
  const currentIndex = steps.indexOf(current);

  return (
    <nav
      className="flex gap-0.5 overflow-x-auto rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-2.5 shadow-[var(--shadow-card)]"
      aria-label="Visit wizard progress"
    >
      {steps.map((stepId, index) => {
        const step = VISIT_WIZARD_STEPS.find((s) => s.id === stepId)!;
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div key={step.id} className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center justify-center">
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                  done || active
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-border-strong bg-surface-subtle text-ink-muted'
                )}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div className={cn('mx-0.5 h-0.5 flex-1', done ? 'bg-brand-500' : 'bg-border')} />
              ) : null}
            </div>
            <div
              className={cn(
                'max-w-full truncate text-center text-[9px]',
                active ? 'font-bold text-brand-800' : 'text-ink-muted'
              )}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
