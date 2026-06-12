import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { OPERATIONS_API, type BroadcastDelivery, type BroadcastRule } from '../../lib/broadcast-api';
import { matchesSearch } from '../../lib/search-filter';
import { Alert, StaticSelect } from '../ui';
import { Modal } from '../Modal';

const BROADCAST_KINDS = [
  'cultivation_schedule',
  'fertigation_reminder',
  'pgr_broadcast',
  'dap_task',
  'cultivation_knowledge',
] as const;

const WEEKDAYS = [
  { value: '', label: 'Any day' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

function TableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export function BroadcastAutomationPanel({
  canWrite,
  search = '',
}: {
  canWrite: boolean;
  search?: string;
}) {
  const base = OPERATIONS_API;
  const [rules, setRules] = useState<BroadcastRule[]>([]);
  const [deliveries, setDeliveries] = useState<BroadcastDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runDryRun, setRunDryRun] = useState(true);
  const [runResult, setRunResult] = useState('');
  const [editRule, setEditRule] = useState<BroadcastRule | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);

  const [ruleForm, setRuleForm] = useState({
    cropType: 'ginger',
    broadcastKind: 'cultivation_schedule' as (typeof BROADCAST_KINDS)[number],
    targetDap: '',
    minDap: '',
    maxDap: '',
    weekday: '',
    dapTolerance: '3',
    priority: '50',
    active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, del] = await Promise.all([
        api<{ ok: boolean; rules: BroadcastRule[] }>(`${base}/broadcasts/rules`),
        api<{ ok: boolean; deliveries: BroadcastDelivery[] }>(`${base}/broadcasts/deliveries?limit=40`),
      ]);
      setRules(r.rules ?? []);
      setDeliveries(del.deliveries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRules = useMemo(
    () =>
      rules.filter((r) =>
        matchesSearch(search, r.crop_type, r.broadcast_kind, String(r.target_dap), String(r.id))
      ),
    [rules, search]
  );

  const visibleDeliveries = useMemo(
    () =>
      deliveries.filter((d) =>
        matchesSearch(
          search,
          d.broadcast_kind,
          d.status,
          d.farmers?.name,
          d.farmers?.phone,
          d.farmers?.district
        )
      ),
    [deliveries, search]
  );

  function openEdit(rule: BroadcastRule) {
    setEditRule(rule);
    setRuleForm({
      cropType: rule.crop_type,
      broadcastKind: rule.broadcast_kind as (typeof BROADCAST_KINDS)[number],
      targetDap: rule.target_dap != null ? String(rule.target_dap) : '',
      minDap: rule.min_dap != null ? String(rule.min_dap) : '',
      maxDap: rule.max_dap != null ? String(rule.max_dap) : '',
      weekday: rule.weekday != null ? String(rule.weekday) : '',
      dapTolerance: String(rule.dap_tolerance ?? 3),
      priority: String(rule.priority),
      active: rule.active,
    });
  }

  async function saveRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    await api(`${base}/broadcasts/rules`, {
      method: 'POST',
      body: JSON.stringify({
        id: editRule?.id,
        cropType: ruleForm.cropType,
        broadcastKind: ruleForm.broadcastKind,
        targetDap: ruleForm.targetDap ? Number(ruleForm.targetDap) : null,
        minDap: ruleForm.minDap ? Number(ruleForm.minDap) : null,
        maxDap: ruleForm.maxDap ? Number(ruleForm.maxDap) : null,
        weekday: ruleForm.weekday ? Number(ruleForm.weekday) : null,
        dapTolerance: Number(ruleForm.dapTolerance) || 3,
        priority: Number(ruleForm.priority) || 50,
        active: ruleForm.active,
      }),
    });
    setEditRule(null);
    await load();
  }

  async function runBroadcasts() {
    if (!canWrite) return;
    setRunResult('');
    try {
      const d = await api<{ ok: boolean; result: unknown }>(`${base}/broadcasts/run`, {
        method: 'POST',
        body: JSON.stringify({ dryRun: runDryRun }),
      });
      setRunResult(JSON.stringify(d.result, null, 2));
      await load();
    } catch (e) {
      setRunResult(e instanceof Error ? e.message : 'Run failed');
    }
  }

  function archiveBroadcastRule(id: string) {
    setConfirmModal({
      title: 'Archive broadcast rule',
      body: 'Do you want to archive this broadcast rule?',
      action: async () => {
        await api(`${base}/broadcasts/rules/${id}`, { method: 'DELETE' });
        await load();
      },
    });
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading automation…</p>;
  }

  return (
    <div className="space-y-8">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canWrite ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-medium text-slate-900">Run broadcasts now</h2>
          <p className="mt-1 text-xs text-slate-500">Manual trigger bypasses IST morning window</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={runDryRun} onChange={(e) => setRunDryRun(e.target.checked)} />
            Dry run (no messages sent)
          </label>
          <button
            type="button"
            onClick={runBroadcasts}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Run
          </button>
          {runResult ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-50 p-3 text-xs">{runResult}</pre>
          ) : null}
        </section>
      ) : null}

      {canWrite ? (
        <form onSubmit={saveRule} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-medium text-slate-900">
            {editRule ? 'Edit broadcast rule' : 'Add broadcast rule'}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="text-slate-600">Crop</span>
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.cropType}
                onChange={(e) => setRuleForm((f) => ({ ...f, cropType: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Kind</span>
              <StaticSelect
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.broadcastKind}
                onChange={(value) =>
                  setRuleForm((f) => ({
                    ...f,
                    broadcastKind: value as (typeof BROADCAST_KINDS)[number],
                  }))
                }
                options={BROADCAST_KINDS.map((k) => ({ value: k, label: k }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Target DAP</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.targetDap}
                onChange={(e) => setRuleForm((f) => ({ ...f, targetDap: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Min DAP</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.minDap}
                onChange={(e) => setRuleForm((f) => ({ ...f, minDap: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Max DAP</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.maxDap}
                onChange={(e) => setRuleForm((f) => ({ ...f, maxDap: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Weekday (ISO 1–7)</span>
              <StaticSelect
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.weekday}
                onChange={(value) => setRuleForm((f) => ({ ...f, weekday: value }))}
                options={WEEKDAYS}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">DAP tolerance</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.dapTolerance}
                onChange={(e) => setRuleForm((f) => ({ ...f, dapTolerance: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Priority</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={ruleForm.priority}
                onChange={(e) => setRuleForm((f) => ({ ...f, priority: e.target.value }))}
              />
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleForm.active}
                onChange={(e) => setRuleForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              {editRule ? 'Update rule' : 'Save rule'}
            </button>
            {editRule ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setEditRule(null)}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <TableSection title="Broadcast rules">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Crop</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">DAP</th>
              <th className="px-4 py-3">Weekday</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Active</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRules.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{r.crop_type}</td>
                <td className="px-4 py-3">{r.broadcast_kind}</td>
                <td className="px-4 py-3">
                  {r.target_dap ?? `${r.min_dap ?? '—'}–${r.max_dap ?? '—'}`}
                </td>
                <td className="px-4 py-3">{r.weekday ?? '—'}</td>
                <td className="px-4 py-3">{r.priority}</td>
                <td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td>
                {canWrite ? (
                  <td className="px-4 py-3 space-x-2">
                    <button
                      type="button"
                      className="text-xs text-emerald-700 hover:underline"
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => archiveBroadcastRule(r.id)}
                    >
                      Archive
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No rules yet.</p>
        ) : null}
      </TableSection>

      <TableSection title="Recent deliveries">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Farmer</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleDeliveries.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-600">
                  {new Date(d.created_at).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  {d.farmers?.name ?? '—'}
                  <span className="block text-xs text-slate-500">{d.farmers?.phone}</span>
                </td>
                <td className="px-4 py-3">{d.broadcast_kind}</td>
                <td className="px-4 py-3 capitalize">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      {confirmModal ? (
        <Modal
          title={confirmModal.title}
          onClose={() => setConfirmModal(null)}
          onSave={async () => {
            await confirmModal.action();
            setConfirmModal(null);
          }}
          saveLabel="Confirm"
        >
          <p className="text-sm text-slate-700">{confirmModal.body}</p>
        </Modal>
      ) : null}
    </div>
  );
}
