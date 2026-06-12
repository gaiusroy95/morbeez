import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { roleLabel } from '../lib/format';
import { assignableRolesForActor } from '../lib/role-home';
import { Field, Modal, inputClass } from '../components/Modal';
import {
  Alert,
  Badge,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  ReadOnlyBanner,
  TableWrap,
  StaticSelect,
} from '../components/ui';
import { CompanySettingsPanel } from '../components/settings/CompanySettingsPanel';
import { LanguageDictionaryPanel } from '../components/settings/LanguageDictionaryPanel';
import { OperationsSystemConfigPanel } from '../components/operations/OperationsSystemConfigPanel';

type Staff = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
};

export function SettingsPage({ canRead, canWrite }: { canRead: boolean; canWrite?: boolean }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deactivateStaff, setDeactivateStaff] = useState<Staff | null>(null);

  async function reload() {
    const d = await api<{ ok: boolean; staff: Staff[] }>('/morbeez-staff/api/v1/os/settings/staff');
    setStaff(d.staff ?? []);
  }

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    api<{ ok: boolean; staff: Staff[] }>('/morbeez-staff/api/v1/os/settings/staff')
      .then((d) => setStaff(d.staff ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [canRead]);

  if (!canRead) {
    return (
      <Panel title="Settings">
        <ReadOnlyBanner />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <CompanySettingsPanel canWrite={canWrite} />
      <LanguageDictionaryPanel canWrite={canWrite} />
      {canWrite ? <OperationsSystemConfigPanel /> : null}
      <p className="muted">
        Staff accounts and RBAC. For full employee workspace, use <strong>Employees</strong> in the sidebar.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}
      {!loading ? (
        <Panel title="Staff accounts">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>{s.fullName ?? '—'}</td>
                    <td>
                      <Badge tone="role">{roleLabel(s.role)}</Badge>
                    </td>
                    <td>
                      <Badge tone={s.active ? 'active' : 'archived'}>
                        {s.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="muted">
                      {s.lastLoginAt
                        ? new Date(s.lastLoginAt).toLocaleString('en-IN')
                        : 'Never'}
                    </td>
                    {canWrite ? (
                      <td>
                        <div className="flex gap-2">
                          <Btn size="sm" variant="secondary" onClick={() => setEditing(s)}>
                            Edit
                          </Btn>
                          {s.active ? (
                            <Btn
                              size="sm"
                              variant="danger"
                              onClick={() => setDeactivateStaff(s)}
                            >
                              Deactivate
                            </Btn>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          {staff.length === 0 ? <EmptyState>No staff users.</EmptyState> : null}
        </Panel>
      ) : null}
      {editing ? (
        <EditStaffModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
      {deactivateStaff ? (
        <Modal
          title="Deactivate staff"
          onClose={() => setDeactivateStaff(null)}
          onSave={async () => {
            try {
              await api(`/morbeez-staff/api/v1/os/settings/staff/${deactivateStaff.id}`, {
                method: 'DELETE',
              });
              setDeactivateStaff(null);
              await reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not deactivate staff');
            }
          }}
          saveLabel="Deactivate"
        >
          <p className="text-sm text-slate-700">
            Deactivate {deactivateStaff.email}?
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function EditStaffModal({
  row,
  onClose,
  onSaved,
}: {
  row: Staff;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { admin } = useAuth();
  const assignableRoles = assignableRolesForActor(admin?.role);
  const roleOptions =
    assignableRoles.includes(row.role) || row.role === 'super_admin'
      ? [...new Set([...assignableRoles, row.role])]
      : assignableRoles;
  const [fullName, setFullName] = useState(row.fullName ?? '');
  const [role, setRole] = useState(row.role);
  const [active, setActive] = useState(row.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api(`/morbeez-staff/api/v1/os/settings/staff/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fullName, role, active }),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update staff');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit staff" onClose={onClose} onSave={save} saveLabel="Update" saving={saving}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Role">
          <StaticSelect
            className={inputClass}
            value={role}
            onChange={setRole}
            options={roleOptions.map((r) => ({ value: r, label: roleLabel(r) }))}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>
    </Modal>
  );
}
