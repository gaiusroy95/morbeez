import { useCallback, useState, type ReactNode } from 'react';
import { Field, Modal, inputClass } from '../components/Modal';
import { Alert } from '../components/ui';

type PendingAction = {
  title: string;
  description: string;
  confirmLabel: string;
  run: (confirmPassword: string) => Promise<void>;
};

/** Password confirmation for staff with write access (telecaller / operations). */
export function useStaffPasswordConfirm(canWrite: boolean) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const requestConfirm = useCallback(
    (
      kind: 'edit' | 'delete',
      itemLabel: string,
      run: (confirmPassword: string) => Promise<void>
    ) => {
      if (!canWrite) return;
      const copy =
        kind === 'delete'
          ? {
              title: 'Confirm delete',
              description: `Enter your password to delete "${itemLabel}".`,
              confirmLabel: 'Delete',
            }
          : {
              title: 'Confirm changes',
              description: `Enter your password to save changes to "${itemLabel}".`,
              confirmLabel: 'Save changes',
            };
      setPending({
        title: copy.title,
        description: copy.description,
        confirmLabel: copy.confirmLabel,
        run,
      });
      setPassword('');
      setError('');
    },
    [canWrite]
  );

  const close = useCallback(() => {
    if (saving) return;
    setPending(null);
    setPassword('');
    setError('');
  }, [saving]);

  const confirmModal: ReactNode = pending ? (
    <Modal
      title={pending.title}
      onClose={close}
      onSave={async () => {
        if (!password.trim()) {
          setError('Password is required');
          return;
        }
        setSaving(true);
        setError('');
        try {
          await pending.run(password);
          setPending(null);
          setPassword('');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Password confirmation failed');
        } finally {
          setSaving(false);
        }
      }}
      saveLabel={pending.confirmLabel}
      saving={saving}
    >
      <p className="mb-3 text-sm text-ink-secondary">{pending.description}</p>
      {error ? <Alert tone="error" className="mb-3">{error}</Alert> : null}
      <Field label="Your password">
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoFocus
        />
      </Field>
    </Modal>
  ) : null;

  return { canConfirm: canWrite, requestConfirm, confirmModal };
}
