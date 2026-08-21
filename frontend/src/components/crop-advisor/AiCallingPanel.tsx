import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Alert,
  Badge,
  Btn,
  EmptyState,
  Field,
  HubTabs,
  Input,
  Loading,
  Panel,
  Select,
  TBody,
  Td,
  Th,
  THead,
  TableWrap,
} from '../ui';

const base = '/morbeez-staff/api/v1/ai-calling';

type JobRow = {
  id: string;
  farmer_id: string;
  farmerName?: string;
  farmerPhone?: string | null;
  call_type: string;
  status: string;
  scheduled_at: string;
  assigned_agronomist_email: string | null;
  language: string | null;
  last_error: string | null;
};

type SessionRow = {
  id: string;
  farmerName?: string;
  call_type: string;
  channel: string;
  status: string;
  farmer_intent: string | null;
  outcome: string | null;
  summary: string | null;
  started_at: string;
};

type IdentityRow = {
  id: string;
  slot_number: number;
  agronomist_email: string | null;
  display_name: string;
  did_number: string | null;
  backup_identity_id: string | null;
  is_active: boolean;
  notes: string | null;
};

type EscalationRow = {
  id: string;
  farmerName?: string;
  assigned_agronomist_email: string | null;
  status: string;
  reason: string;
  priority: string;
};

type ConsolePayload = {
  ok: boolean;
  voicebotConfigured: boolean;
  whatsappFallback: boolean;
  pendingJobs: number;
  jobs: JobRow[];
  sessions: SessionRow[];
  identities: IdentityRow[];
  escalations: EscalationRow[];
};

type Tab = 'queue' | 'sessions' | 'identities' | 'escalations';

function statusTone(status: string): 'success' | 'warn' | 'neutral' | 'info' {
  if (status === 'completed' || status === 'resolved') return 'success';
  if (status === 'failed' || status === 'skipped_dnd' || status === 'urgent') return 'warn';
  if (status === 'awaiting_reply' || status === 'queued_for_agent') return 'info';
  return 'neutral';
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type Props = { canWrite: boolean };

export function AiCallingPanel({ canWrite }: Props) {
  const [tab, setTab] = useState<Tab>('queue');
  const [data, setData] = useState<ConsolePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [replyText, setReplyText] = useState('YES');
  const [replySessionId, setReplySessionId] = useState('');
  const [identityDraft, setIdentityDraft] = useState<Record<number, Partial<IdentityRow>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<ConsolePayload>(`${base}/console`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load calling console');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function processDue() {
    setBusy('process');
    setError('');
    try {
      await api(`${base}/jobs/process-due`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Process failed');
    } finally {
      setBusy('');
    }
  }

  async function simulateReply() {
    if (!replySessionId) return;
    setBusy('reply');
    setError('');
    try {
      await api(`${base}/sessions/${replySessionId}/simulate-reply`, {
        method: 'POST',
        body: JSON.stringify({ text: replyText }),
      });
      setReplyText('YES');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setBusy('');
    }
  }

  async function saveIdentity(slot: number, row: IdentityRow | undefined) {
    const draft = { ...(row ?? {}), ...(identityDraft[slot] ?? {}) };
    setBusy(`id-${slot}`);
    setError('');
    try {
      await api(`${base}/identities/${slot}`, {
        method: 'PUT',
        body: JSON.stringify({
          agronomistEmail: draft.agronomist_email || null,
          displayName: draft.display_name || 'Morbeez crop specialist',
          didNumber: draft.did_number || null,
          backupIdentityId: draft.backup_identity_id || null,
          isActive: draft.is_active ?? row?.is_active ?? false,
          notes: draft.notes || null,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save identity');
    } finally {
      setBusy('');
    }
  }

  if (loading && !data) return <Loading label="Loading AI calling…" />;

  const jobs = data?.jobs ?? [];
  const sessions = data?.sessions ?? [];
  const identities = data?.identities ?? [];
  const escalations = data?.escalations ?? [];
  const awaiting = sessions.filter((s) => s.status === 'awaiting_reply');

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Panel className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">AI Farmer Calling</h2>
            <p className="mt-1 text-sm text-ink-muted">
              One engine, agronomist DIDs 1–10. Automated voice is off until Sarvam TTS and an Exotel
              voicebot applet are configured — jobs fall back to WhatsApp or a staff script. The AI
              never prescribes chemicals.
            </p>
          </div>
          {canWrite ? (
            <Btn variant="primary" size="sm" disabled={busy === 'process'} onClick={() => void processDue()}>
              {busy === 'process' ? 'Processing…' : 'Process due jobs'}
            </Btn>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data?.voicebotConfigured ? 'success' : 'warn'}>
            {data?.voicebotConfigured ? 'Voicebot ready' : 'Voicebot not configured'}
          </Badge>
          <Badge tone={data?.whatsappFallback ? 'info' : 'neutral'}>
            WhatsApp fallback {data?.whatsappFallback ? 'on' : 'off'}
          </Badge>
          <Badge tone={(data?.pendingJobs ?? 0) > 0 ? 'warn' : 'neutral'}>
            {data?.pendingJobs ?? 0} open jobs
          </Badge>
        </div>
      </Panel>

      <HubTabs
        tabs={[
          { id: 'queue' as const, label: 'Queue', badge: data?.pendingJobs },
          { id: 'sessions' as const, label: 'Sessions' },
          { id: 'identities' as const, label: 'Agronomist numbers' },
          { id: 'escalations' as const, label: 'Call escalations', badge: escalations.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'queue' ? (
        <Panel>
          {jobs.length === 0 ? (
            <EmptyState>No calling jobs yet. New CRM leads enqueue a qualification job.</EmptyState>
          ) : (
            <TableWrap>
              <table className="min-w-full text-sm">
                <THead>
                  <tr>
                    <Th>Farmer</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>When</Th>
                    <Th>Owner</Th>
                  </tr>
                </THead>
                <TBody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <div className="font-medium text-ink">{job.farmerName}</div>
                        <div className="text-xs text-ink-muted">{job.farmerPhone ?? '—'}</div>
                      </Td>
                      <Td>{job.call_type.replace(/_/g, ' ')}</Td>
                      <Td>
                        <Badge tone={statusTone(job.status)}>{job.status.replace(/_/g, ' ')}</Badge>
                        {job.last_error ? (
                          <div className="mt-1 text-xs text-ink-muted">{job.last_error}</div>
                        ) : null}
                      </Td>
                      <Td>{formatWhen(job.scheduled_at)}</Td>
                      <Td>{job.assigned_agronomist_email ?? 'Unassigned'}</Td>
                    </tr>
                  ))}
                </TBody>
              </table>
            </TableWrap>
          )}
        </Panel>
      ) : null}

      {tab === 'sessions' ? (
        <div className="space-y-4">
          {canWrite && awaiting.length > 0 ? (
            <Panel className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Awaiting session">
                <Select
                  value={replySessionId}
                  onChange={(e) => setReplySessionId(e.target.value)}
                >
                  <option value="">Select session</option>
                  {awaiting.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.farmerName} · {s.call_type} · {s.channel}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Farmer reply (simulate / log)">
                <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} />
              </Field>
              <div className="flex items-end">
                <Btn
                  variant="primary"
                  size="sm"
                  disabled={!replySessionId || busy === 'reply'}
                  onClick={() => void simulateReply()}
                >
                  Record reply
                </Btn>
              </div>
            </Panel>
          ) : null}
          <Panel>
            {sessions.length === 0 ? (
              <EmptyState>No call sessions yet.</EmptyState>
            ) : (
              <TableWrap>
                <table className="min-w-full text-sm">
                  <THead>
                    <tr>
                      <Th>Farmer</Th>
                      <Th>Channel</Th>
                      <Th>Intent</Th>
                      <Th>Outcome</Th>
                      <Th>When</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <Td>
                          <div className="font-medium text-ink">{s.farmerName}</div>
                          <div className="text-xs text-ink-muted">{s.call_type.replace(/_/g, ' ')}</div>
                        </Td>
                        <Td>{s.channel}</Td>
                        <Td>{s.farmer_intent ?? '—'}</Td>
                        <Td>
                          <Badge tone={statusTone(s.status)}>{s.outcome ?? s.status}</Badge>
                        </Td>
                        <Td>{formatWhen(s.started_at)}</Td>
                      </tr>
                    ))}
                  </TBody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'identities' ? (
        <Panel className="space-y-4 p-4">
          <p className="text-sm text-ink-muted">
            Map 3–4 agronomists now; slots 5–10 stay ready. The AI discloses it is automated help — it
            does not impersonate a named agronomist. Ownership stays on the assigned identity.
          </p>
          <TableWrap>
            <table className="min-w-full text-sm">
              <THead>
                <tr>
                  <Th>Slot</Th>
                  <Th>Email</Th>
                  <Th>DID</Th>
                  <Th>Active</Th>
                  {canWrite ? <Th /> : null}
                </tr>
              </THead>
              <TBody>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((slot) => {
                  const row = identities.find((x) => x.slot_number === slot);
                  const draft = identityDraft[slot] ?? {};
                  return (
                    <tr key={slot}>
                      <Td>#{slot}</Td>
                      <Td>
                        <Input
                          disabled={!canWrite}
                          defaultValue={row?.agronomist_email ?? ''}
                          onChange={(e) =>
                            setIdentityDraft((prev) => ({
                              ...prev,
                              [slot]: { ...prev[slot], agronomist_email: e.target.value, is_active: row?.is_active },
                            }))
                          }
                        />
                      </Td>
                      <Td>
                        <Input
                          disabled={!canWrite}
                          defaultValue={row?.did_number ?? ''}
                          onChange={(e) =>
                            setIdentityDraft((prev) => ({
                              ...prev,
                              [slot]: { ...prev[slot], did_number: e.target.value, agronomist_email: draft.agronomist_email ?? row?.agronomist_email },
                            }))
                          }
                        />
                      </Td>
                      <Td>
                        <input
                          type="checkbox"
                          disabled={!canWrite}
                          defaultChecked={Boolean(row?.is_active)}
                          onChange={(e) =>
                            setIdentityDraft((prev) => ({
                              ...prev,
                              [slot]: { ...prev[slot], is_active: e.target.checked },
                            }))
                          }
                        />
                      </Td>
                      {canWrite ? (
                        <Td>
                          <Btn
                            size="sm"
                            disabled={busy === `id-${slot}`}
                            onClick={() => void saveIdentity(slot, row)}
                          >
                            Save
                          </Btn>
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </TBody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'escalations' ? (
        <Panel>
          {escalations.length === 0 ? (
            <EmptyState>No open calling escalations.</EmptyState>
          ) : (
            <TableWrap>
              <table className="min-w-full text-sm">
                <THead>
                  <tr>
                    <Th>Farmer</Th>
                    <Th>Priority</Th>
                    <Th>Status</Th>
                    <Th>Assigned</Th>
                    <Th>Reason</Th>
                  </tr>
                </THead>
                <TBody>
                  {escalations.map((e) => (
                    <tr key={e.id}>
                      <Td>{e.farmerName}</Td>
                      <Td>
                        <Badge tone={e.priority === 'urgent' ? 'warn' : 'neutral'}>{e.priority}</Badge>
                      </Td>
                      <Td>{e.status.replace(/_/g, ' ')}</Td>
                      <Td>{e.assigned_agronomist_email ?? 'Callback queue'}</Td>
                      <Td>{e.reason}</Td>
                    </tr>
                  ))}
                </TBody>
              </table>
            </TableWrap>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
