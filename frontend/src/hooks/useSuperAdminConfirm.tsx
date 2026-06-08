import { useCallback, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Field, Modal, inputClass } from '../components/Modal';

type PendingAction = {
  title: string;
  description: string;
  confirmLabel: string;
  run: (confirmPassword: string) => Promise<void>;
};

export function useSuperAdminConfirm() {
  const { admin } = useAuth();
  const canEditDelete = admin?.role === 'super_admin';
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
      if (!canEditDelete) return;
      setPending({
        title: kind === 'delete' ? 'Confirm delete' : 'Confirm edit',
        description:
          kind === 'delete'
            ? `Enter your super admin password to delete "${itemLabel}".`
            : `Enter your super admin password to save changes to "${itemLabel}".`,
        confirmLabel: kind === 'delete' ? 'Delete' : 'Save changes',
        run,
      });
      setPassword('');
      setError('');
    },
    [canEditDelete]
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
      <p className="mb-3 text-sm text-slate-600">{pending.description}</p>
      {error ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Field label="Super admin password">
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

  return { canEditDelete, requestConfirm, confirmModal };
}
