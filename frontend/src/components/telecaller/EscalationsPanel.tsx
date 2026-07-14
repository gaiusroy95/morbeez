import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Alert,
  Badge,
  Btn,
  DataTable,
  EmptyState,
  HubTabs,
  Loading,
  Panel,
  TBody,
  Td,
  Th,
  THead,
  TableWrap,
} from '../ui';
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

function workflowBadgeTone(
  workflow: EscalationListRow['workflowStatus']
): 'success' | 'warn' | 'neutral' {
  if (workflow === 'completed') return 'success';
  if (workflow === 'agronomist_review') return 'warn';
  return 'neutral';
}

function priorityBadgeTone(p: string): 'warn' | 'neutral' {
  if (p === 'urgent' || p === 'high') return 'warn';
  return 'neutral';
}

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Agronomist escalations</h2>
          <p className="text-sm text-ink-secondary">
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
            className="mb-0"
          />
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Panel bodyClassName="p-0">
        {loading ? (
          <Loading label="Loading escalations…" />
        ) : items.length === 0 ? (
          <EmptyState>
            {escTab === 'open'
              ? 'No open escalations — all caught up.'
              : 'No completed escalations yet.'}
          </EmptyState>
        ) : (
          <TableWrap>
            <DataTable>
              <THead>
                <tr>
                  <Th>Farmer</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th>Crop</Th>
                  <Th>Priority</Th>
                  <Th>Date</Th>
                  {escTab === 'completed' && canWrite ? (
                    <Th className="text-right">Action</Th>
                  ) : null}
                </tr>
              </THead>
              <TBody>
                {items.map((e) => {
                  const workflow = workflowFromStatus(e.status);
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
                      className="cursor-pointer transition hover:bg-brand-50/50"
                      onClick={() => setSelected(row)}
                    >
                      <Td>
                        <p className="font-semibold text-ink">{e.farmerName}</p>
                        <p className="text-xs text-ink-muted">{e.farmerPhone}</p>
                      </Td>
                      <Td className="max-w-xs">{e.reason.slice(0, 100)}</Td>
                      <Td>
                        <Badge tone={workflowBadgeTone(workflow)}>{row.statusLabel}</Badge>
                      </Td>
                      <Td className="text-xs">{e.cropType ?? '—'}</Td>
                      <Td>
                        <Badge tone={priorityBadgeTone(e.priority)}>{e.priority}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{dateLabel ?? '—'}</Td>
                      {escTab === 'completed' && canWrite ? (
                        <Td className="text-right" onClick={(ev) => ev.stopPropagation()}>
                          <Btn
                            size="sm"
                            variant="secondary"
                            disabled={clearingId === e.id || clearingAll}
                            onClick={() => void clearEscalation(e.id, e.farmerName)}
                          >
                            {clearingId === e.id ? 'Clearing…' : 'Clear'}
                          </Btn>
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </TBody>
            </DataTable>
          </TableWrap>
        )}
      </Panel>

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
