import type { ReactNode } from 'react';

type Props = {
  label: string;
  required?: boolean;
  full?: boolean;
  counter?: string;
  children: ReactNode;
};

export function WizardField({ label, required, full, counter, children }: Props) {
  return (
    <div className={`pw-field ${full ? 'pw-field--full' : ''}`}>
      <label className="pw-label">
        {label}
        {required ? <span className="pw-req"> *</span> : null}
      </label>
      {children}
      {counter ? <span className="pw-counter">{counter}</span> : null}
    </div>
  );
}

export function pwInputClass() {
  return 'pw-input';
}

export function pwSelectClass() {
  return 'pw-input pw-select';
}

export function pwTextareaClass() {
  return 'pw-input pw-textarea';
}
