import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Btn, PageShell } from '../components/ui';

type EscRow = {
  id: string;
  farmerName?: string;
  reason?: string;
  priority?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
};

type AiCase = {
  id: string;
  issueName?: string;
  status?: string;
  createdAt?: string;
};

type SlaPolicy = { warnHours: number; breachHours: number };

const DEFAULT_SLA: SlaPolicy = { warnHours: 24, breachHours: 72 };
const SLA_STORAGE_KEY = 'morbeez.escalationSlaPolicy';

function loadSlaPolicy(): SlaPolicy {
  try {
    const raw = localStorage.getItem(SLA_STORAGE_KEY);
    if (!raw) return DEFAULT_SLA;
    const parsed = JSON.parse(raw) as SlaPolicy;
    if (typeof parsed.warnHours === 'number' && typeof parsed.breachHours === 'number') return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_SLA;
}

function slaHours(
  createdAt: string | undefined,
  policy: SlaPolicy
): { hours: number; label: string; tone: string } {
  if (!createdAt) return { hours: 0, label: '—', tone: 'muted' };
  const hours = Math.round((Date.now() - new Date(createdAt).getTime()) / 3600000);
  const label = hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
  const tone =
    hours >= policy.breachHours ? 'sla-breach' : hours >= policy.warnHours ? 'sla-warn' : 'sla-ok';
  return { hours, label, tone };
}

export function EscalationCommandCenterPage() {
  const [tele, setTele] = useState<EscRow[]>([]);
  const [ai, setAi] = useState<AiCase[]>([]);
  const [policy, setPolicy] = useState<SlaPolicy>(() => loadSlaPolicy());
  const [draft, setDraft] = useState<SlaPolicy>(() => loadSlaPolicy());

  useEffect(() => {
    void api<{ ok: boolean; telecallerEscalations: EscRow[]; aiReviewCases: AiCase[] }>(
      '/morbeez-staff/api/v1/os/escalations/unified'
    ).then((r) => {
      setTele((r.telecallerEscalations as EscRow[]) ?? []);
      setAi((r.aiReviewCases as AiCase[]) ?? []);
    });
  }, []);

  const breachCount = useMemo(() => {
    const all = [
      ...tele.map((r) => r.created_at ?? r.createdAt),
      ...ai.map((r) => r.createdAt),
    ];
    return all.filter((at) => slaHours(at, policy).hours >= policy.breachHours).length;
  }, [tele, ai, policy]);

  function savePolicy() {
    localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(draft));
    setPolicy(draft);
  }

  return (
    <PageShell title="Escalation command center">
      <div className="mb-4 p-3 border rounded max-w-lg">
        <h3 className="font-semibold mb-2">SLA policy</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <label className="text-sm">
            Warn (hours)
            <input
              className="block border rounded px-2 py-1 mt-1"
              type="number"
              min={1}
              value={draft.warnHours}
              onChange={(e) => setDraft((d) => ({ ...d, warnHours: Number(e.target.value) }))}
            />
          </label>
          <label className="text-sm">
            Breach (hours)
            <input
              className="block border rounded px-2 py-1 mt-1"
              type="number"
              min={1}
              value={draft.breachHours}
              onChange={(e) => setDraft((d) => ({ ...d, breachHours: Number(e.target.value) }))}
            />
          </label>
          <Btn size="sm" onClick={savePolicy}>
            Save policy
          </Btn>
        </div>
        <p className="muted text-sm mt-2">
          Active: warn ≥{policy.warnHours}h · breach ≥{policy.breachHours}h · {breachCount} breaches now
        </p>
      </div>

      <h3 className="font-semibold mb-2">Telecaller escalations ({tele.length})</h3>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Reason</th>
            <th>Priority</th>
            <th>SLA age</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tele.slice(0, 25).map((row) => {
            const created = row.created_at ?? row.createdAt;
            const sla = slaHours(created, policy);
            return (
              <tr key={row.id}>
                <td>{row.farmerName ?? row.id.slice(0, 8)}</td>
                <td>{row.reason ?? '—'}</td>
                <td>{row.priority ?? '—'}</td>
                <td className={sla.tone}>{sla.label}</td>
                <td>{row.status ?? 'open'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="font-semibold mb-2">AI review queue ({ai.length})</h3>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Issue</th>
            <th>SLA age</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ai.slice(0, 25).map((row) => {
            const sla = slaHours(row.createdAt, policy);
            return (
              <tr key={row.id}>
                <td>{row.issueName ?? row.id.slice(0, 8)}</td>
                <td className={sla.tone}>{sla.label}</td>
                <td>{row.status ?? 'open'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PageShell>
  );
}
