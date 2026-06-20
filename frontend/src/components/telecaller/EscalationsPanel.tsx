import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Btn, HubTabs } from '../ui';
import { EscalationDetailModal, type EscalationListRow } from './EscalationDetailModal';

const base = '/morbeez-staff/api/v1/os/telecaller';

type EscalationTab = 'open' | 'completed';

type EscRow = {
  id: string;
  farmerName: string;
  farmerPhone: string | null;
  cropType: string | null;
  reason: string;
  priority: string;
  status: string;
  createdLabel: string;
  resolvedLabel?: string | null;
};

type Props = {
  canWrite: boolean;
  onBadgeRefresh?: () => void;
};

export function EscalationsPanel({ canWrite, onBadgeRefresh }: Props) {
  const [escTab, setEscTab] = useState<EscalationTab>('open');
  const [items, setItems] = useState<EscRow[]>([]);
  const [selected, setSelected] = useState<EscalationListRow | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const status = escTab === 'open' ? 'open' : 'completed';
      const data = await api<{ ok: boolean; items: EscRow[] }>(
        `${base}/escalations?status=${encodeURIComponent(status)}&limit=50`
      );
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load escalations');
    } finally {
      setLoading(false);
    }
  }, [escTab]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setSelected(null);
  }, [escTab]);

  function priorityClass(p: string) {
    if (p === 'urgent') return 'bg-red-100 text-red-800';
    if (p === 'high') return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-700';
  }

  function workflowFromStatus(status: string): EscalationListRow['workflowStatus'] {
    if (status === 'resolved' || status === 'closed') return 'completed';
    if (status === 'in_review' || status === 'assigned') return 'agronomist_review';
    return 'pending';
  }

  function statusLabelFor(status: string): string {
    const w = workflowFromStatus(status);
    if (w === 'completed') return 'Completed';
    if (w === 'agronomist_review') return 'Needs agronomist review';
    return 'Pending';
  }

  function handleSaved(opts?: { completed?: boolean; cleared?: boolean }) {
    void loadList();
    onBadgeRefresh?.();
    if ((opts?.completed && escTab === 'open') || opts?.cleared) {
      setSelected(null);
    }
  }

  async function clearEscalation(id: string, farmerName: string) {
    if (!canWrite) return;
    if (!window.confirm(`Clear escalation for ${farmerName}? It will be removed from this list.`)) return;
    setClearingId(id);
    setError('');
    try {
      await api(`${base}/escalations/${encodeURIComponent(id)}/clear`, { method: 'POST' });
      if (selected?.id === id) setSelected(null);
      await loadList();
      onBadgeRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear escalation');
    } finally {
      setClearingId(null);
    }
  }

  async function clearAllCompleted() {
    if (!canWrite || items.length === 0) return;
    if (
      !window.confirm(
        `Clear all ${items.length} completed escalation(s)? They will be removed from this list.`
      )
    ) {
      return;
    }
    setClearingAll(true);
    setError('');
    try {
      await api(`${base}/escalations/clear-completed`, { method: 'POST' });
      setSelected(null);
      await loadList();
      onBadgeRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear escalations');
    } finally {
      setClearingAll(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Agronomist escalations</h2>
          <p className="text-sm text-slate-600">
            {escTab === 'open'
              ? 'Open cases needing review. Mark completed to move them off this list.'
              : 'Completed cases you can clear when no longer needed in the queue.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {escTab === 'completed' && canWrite && items.length > 0 ? (
            <Btn
              variant="secondary"
              disabled={clearingAll}
              onClick={() => void clearAllCompleted()}
            >
              {clearingAll ? 'Clearing…' : 'Clear all completed'}
            </Btn>
          ) : null}
          <HubTabs
          tabs={[
            { id: 'open' as const, label: 'Open escalations' },
            { id: 'completed' as const, label: 'Completed escalations' },
          ]}
          active={escTab}
          onChange={setEscTab}
        />
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Crop</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Date</th>
                {escTab === 'completed' && canWrite ? (
                  <th className="px-4 py-3 text-right">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const workflow = workflowFromStatus(e.status);
                const badgeClass =
                  workflow === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : workflow === 'agronomist_review'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-100 text-slate-800';
                const dateLabel =
                  escTab === 'completed' ? e.resolvedLabel ?? e.createdLabel : e.createdLabel;
                const row: EscalationListRow = {
                  id: e.id,
                  summary: e.reason.slice(0, 160),
                  reason: e.reason,
                  workflowStatus: workflow,
                  statusLabel: statusLabelFor(e.status),
                  priority: e.priority,
                  createdLabel: e.createdLabel,
                };
                return (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/60"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.farmerName}</p>
                      <p className="text-xs text-slate-500">{e.farmerPhone}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3">{e.reason.slice(0, 100)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{e.cropType ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs capitalize ${priorityClass(e.priority)}`}
                      >
                        {e.priority}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {dateLabel ?? '—'}
                    </td>
                    {escTab === 'completed' && canWrite ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          disabled={clearingId === e.id || clearingAll}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void clearEscalation(e.id, e.farmerName);
                          }}
                        >
                          {clearingId === e.id ? 'Clearing…' : 'Clear'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && items.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            {escTab === 'open'
              ? 'No open escalations — all caught up.'
              : 'No completed escalations yet.'}
          </p>
        ) : null}
      </div>

      {selected ? (
        <EscalationDetailModal
          row={selected}
          canWrite={canWrite}
          onSaved={handleSaved}
          onCleared={() => handleSaved({ cleared: true })}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
