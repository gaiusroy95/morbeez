import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  Alert,
  Badge,
  Btn,
  HubTabs,
  Panel,
  ReadOnlyBanner,
  TableWrap,
  inputClass,
  textareaClass,
} from '../components/ui';

const base = '/morbeez-staff/api/v1/kpi-control';

type Tab = 'rules' | 'cases' | 'qa' | 'locks' | 'fraud' | 'disputes' | 'drilldown';

type RuleRow = {
  id: string;
  rule_type: string;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  status: string;
  payload: Record<string, unknown>;
  change_reason: string;
  created_by: string | null;
  approved_by: string | null;
};

type CaseRow = {
  id: string;
  source_type: string;
  source_id: string;
  agronomist_email: string | null;
  qualified: boolean;
  missing_reasons: string[];
  evaluated_at: string;
};

type QaRow = {
  id: string;
  source_type: string;
  agronomist_email: string | null;
  status: string;
  notes: string | null;
};

type LockRow = {
  id: string;
  period_month: string;
  rule_type: string;
  rule_version_id: string;
  frozen_at: string;
  frozen_by: string | null;
};

const RULE_LABELS: Record<string, string> = {
  partner_kpi_factor: 'Partner KPI factor bands',
  agronomist_sales_slab: 'Agronomist sales slabs',
  settlement_80_20: '80/20 settlement',
  eligible_sale: 'Eligible sale window',
  farmer_introduction: 'Farmer introduction',
  partner_kpi_weights: 'Partner KPI weights',
  agronomist_kpi: 'Agronomist KPI',
  qualified_case: 'Qualified case gates',
  diagnosis_qa: 'Diagnosis QA sample',
};

const DEFAULT_PAYLOADS: Record<string, unknown> = {
  partner_kpi_weights: {
    parameters: [
      { key: 'eligible_sales', label: 'Eligible Delivered Sales', weightPct: 30, target: 100000, unit: 'inr' },
      { key: 'farmer_retention', label: 'Farmer Retention', weightPct: 20, target: 80, unit: 'pct' },
      { key: 'field_service', label: 'Field Service', weightPct: 15, target: 80, unit: 'pct' },
      { key: 'territory', label: 'Territory Penetration', weightPct: 15, target: 80, unit: 'pct' },
      { key: 'collections', label: 'Collections', weightPct: 10, target: 90, unit: 'pct' },
      { key: 'advocacy', label: 'Advocacy / Digital', weightPct: 5, target: 50, unit: 'pct' },
      { key: 'lead_response', label: 'Lead Response', weightPct: 3, target: 80, unit: 'pct' },
      { key: 'reporting', label: 'Reporting', weightPct: 2, target: 80, unit: 'pct' },
    ],
  },
  qualified_case: {
    requireFarmerVerified: true,
    requireCrop: true,
    requireCropStage: true,
    requireProblem: true,
    requireDiagnosis: true,
    requireRecommendation: true,
    requireEvidence: true,
  },
  diagnosis_qa: { sampleRatePct: 10, sampleCap: 30 },
};

function thisMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function statusTone(status: string): 'active' | 'warn' | 'info' | 'archived' | 'success' {
  if (status === 'active') return 'active';
  if (status === 'approved' || status === 'accurate') return 'success';
  if (status === 'submitted' || status === 'scheduled' || status === 'pending') return 'info';
  if (status === 'draft' || status === 'inaccurate') return 'warn';
  return 'archived';
}

export function KpiControlCenterPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('rules');
  const [month, setMonth] = useState(thisMonth);
  const [ruleTypes, setRuleTypes] = useState<string[]>(Object.keys(RULE_LABELS));
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [caseTotals, setCaseTotals] = useState({ qualified: 0, total: 0 });
  const [qa, setQa] = useState<QaRow[]>([]);
  const [qaSummary, setQaSummary] = useState<Record<string, number>>({});
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [flags, setFlags] = useState<Array<Record<string, unknown>>>([]);
  const [disputes, setDisputes] = useState<Array<Record<string, unknown>>>([]);
  const [drilldown, setDrilldown] = useState<{
    months: Array<{ month: string; earned: number; held: number; due: number; paid: number }>;
    dueNow: number;
    heldNow: number;
  } | null>(null);
  const [partyType, setPartyType] = useState<'partner' | 'employee'>('partner');
  const [partyId, setPartyId] = useState('');
  const [flagType, setFlagType] = useState('manual');
  const [flagReason, setFlagReason] = useState('');
  const [disputeSource, setDisputeSource] = useState('partner_ledger');
  const [disputeEarningId, setDisputeEarningId] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [newType, setNewType] = useState('partner_kpi_weights');
  const [newFrom, setNewFrom] = useState(`${thisMonth()}-01`);
  const [newReason, setNewReason] = useState('KPI Control Center revision');
  const [newPayload, setNewPayload] = useState(JSON.stringify(DEFAULT_PAYLOADS.partner_kpi_weights, null, 2));

  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'rules') {
        const r = await api<{ ok: boolean; rules: RuleRow[]; ruleTypes: string[] }>(`${base}/rules`);
        setRules(r.rules ?? []);
        if (r.ruleTypes?.length) setRuleTypes(r.ruleTypes);
      } else if (tab === 'cases') {
        const r = await api<{ ok: boolean; cases: CaseRow[]; qualified: number; total: number }>(
          `${base}/qualified-cases?month=${month}`
        );
        setCases(r.cases ?? []);
        setCaseTotals({ qualified: r.qualified ?? 0, total: r.total ?? 0 });
      } else if (tab === 'qa') {
        const r = await api<{
          ok: boolean;
          samples: QaRow[];
          summary: Record<string, number>;
        }>(`${base}/diagnosis-qa?month=${month}`);
        setQa(r.samples ?? []);
        setQaSummary(r.summary ?? {});
      } else if (tab === 'fraud') {
        const r = await api<{ ok: boolean; flags: Array<Record<string, unknown>> }>(`${base}/fraud-flags`);
        setFlags(r.flags ?? []);
      } else if (tab === 'disputes') {
        const r = await api<{ ok: boolean; disputes: Array<Record<string, unknown>> }>(`${base}/disputes`);
        setDisputes(r.disputes ?? []);
      } else if (tab === 'drilldown') {
        if (partyId) {
          const r = await api<{
            ok: boolean;
            months: Array<{ month: string; earned: number; held: number; due: number; paid: number }>;
            dueNow: number;
            heldNow: number;
          }>(`${base}/drilldown?partyType=${partyType}&partyId=${partyId}`);
          setDrilldown(r);
        } else {
          setDrilldown(null);
        }
      } else if (tab === 'locks') {
        const r = await api<{ ok: boolean; locks: LockRow[] }>(`${base}/locks?month=${month}`);
        setLocks(r.locks ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [tab, month, partyId, partyType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const preset = DEFAULT_PAYLOADS[newType];
    if (preset) setNewPayload(JSON.stringify(preset, null, 2));
  }, [newType]);

  async function run(label: string, fn: () => Promise<void>) {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(label);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : label);
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(newPayload) as Record<string, unknown>;
    } catch {
      setError('Payload must be valid JSON');
      return;
    }
    await run('Draft created', async () => {
      await api(`${base}/rules`, {
        method: 'POST',
        body: JSON.stringify({
          ruleType: newType,
          payload,
          effectiveFrom: newFrom,
          changeReason: newReason,
        }),
      });
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RuleRow[]>();
    for (const row of rules) {
      const list = map.get(row.rule_type) ?? [];
      list.push(row);
      map.set(row.rule_type, list);
    }
    return [...map.entries()];
  }, [rules]);

  return (
    <div className="hub-page">
      <h1>KPI Control Center</h1>
      <p className="mb-4 max-w-3xl text-sm text-ink-muted">
        Versioned targets, weights, qualified-case gates, and diagnosis QA. Active rows are never
        overwritten. A frozen month keeps using that version even if later months change the targets.
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Month
          <input
            className={`${inputClass} mt-1 w-40`}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {canWrite ? (
          <Btn
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run('KPI recomputed', async () => {
                await api(`${base}/recompute`, { method: 'POST', body: JSON.stringify({ month }) });
              })
            }
          >
            Recompute KPI
          </Btn>
        ) : null}
      </div>

      <HubTabs
        tabs={[
          { id: 'rules', label: 'Rule versions' },
          { id: 'cases', label: 'Qualified cases' },
          { id: 'qa', label: 'Diagnosis QA' },
          { id: 'locks', label: 'Month freeze' },
          { id: 'fraud', label: 'Fraud holds' },
          { id: 'disputes', label: 'Disputes' },
          { id: 'drilldown', label: '3-month earnings' },
        ]}
        active={tab}
        onChange={(id) => setTab(id)}
      />

      {tab === 'rules' ? (
        <>
          {canWrite ? (
            <Panel title="New draft version" className="mb-5">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  Rule type
                  <select
                    className={`${inputClass} mt-1`}
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    {ruleTypes.map((t) => (
                      <option key={t} value={t}>
                        {RULE_LABELS[t] ?? t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Effective from
                  <input
                    className={`${inputClass} mt-1`}
                    type="date"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Change reason
                  <input
                    className={`${inputClass} mt-1`}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                  />
                </label>
              </div>
              <label className="mt-3 block text-sm">
                Payload
                <textarea
                  className={`${textareaClass} mt-1 font-mono text-xs`}
                  value={newPayload}
                  onChange={(e) => setNewPayload(e.target.value)}
                />
              </label>
              <div className="mt-3">
                <Btn variant="primary" disabled={busy} onClick={() => void createDraft()}>
                  Create draft
                </Btn>
              </div>
            </Panel>
          ) : null}

          {grouped.map(([type, rows]) => (
            <Panel key={type} title={RULE_LABELS[type] ?? type} className="mb-4" noPadding>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Effective</th>
                      <th>Reason</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>v{row.version_number}</td>
                        <td>
                          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                        </td>
                        <td>
                          {row.effective_from}
                          {row.effective_to ? ` → ${row.effective_to}` : ''}
                        </td>
                        <td className="max-w-xs truncate">{row.change_reason}</td>
                        <td className="whitespace-nowrap">
                          {canWrite && row.status === 'draft' ? (
                            <Btn
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                run('Submitted', async () => {
                                  await api(`${base}/rules/${row.id}/submit`, { method: 'POST' });
                                })
                              }
                            >
                              Submit
                            </Btn>
                          ) : null}
                          {canWrite && row.status === 'submitted' ? (
                            <Btn
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() =>
                                run('Approved', async () => {
                                  await api(`${base}/rules/${row.id}/approve`, { method: 'POST' });
                                })
                              }
                            >
                              Approve
                            </Btn>
                          ) : null}
                          {canWrite && (row.status === 'approved' || row.status === 'scheduled') ? (
                            <Btn
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() =>
                                run('Activated', async () => {
                                  await api(`${base}/rules/${row.id}/activate`, { method: 'POST' });
                                })
                              }
                            >
                              Activate
                            </Btn>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          ))}
        </>
      ) : null}

      {tab === 'cases' ? (
        <Panel
          title={`Qualified cases ${caseTotals.qualified}/${caseTotals.total}`}
          description="A case row is not enough. Farmer, crop, stage, problem, diagnosis, recommendation, and evidence must all be present."
          actions={
            canWrite ? (
              <Btn
                disabled={busy}
                onClick={() =>
                  run('Cases scanned', async () => {
                    await api(`${base}/qualified-cases/scan`, {
                      method: 'POST',
                      body: JSON.stringify({ month }),
                    });
                  })
                }
              >
                Scan month
              </Btn>
            ) : null
          }
        >
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Agronomist</th>
                  <th>Qualified</th>
                  <th>Missing</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.source_type} · {String(row.source_id).slice(0, 8)}
                    </td>
                    <td>{row.agronomist_email ?? '—'}</td>
                    <td>
                      <Badge tone={row.qualified ? 'success' : 'warn'}>
                        {row.qualified ? 'yes' : 'no'}
                      </Badge>
                    </td>
                    <td className="text-xs text-ink-muted">
                      {(row.missing_reasons ?? []).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'qa' ? (
        <Panel
          title={`Diagnosis QA · accuracy ${qaSummary.accuracyPct ?? 0}%`}
          description="Sample size is MIN(10% of qualified cases, 30) from the active diagnosis QA rule."
          actions={
            canWrite ? (
              <Btn
                disabled={busy}
                onClick={() =>
                  run('QA sample drawn', async () => {
                    await api(`${base}/diagnosis-qa/draw`, {
                      method: 'POST',
                      body: JSON.stringify({ month }),
                    });
                  })
                }
              >
                Draw sample
              </Btn>
            ) : null
          }
        >
          <p className="mb-3 text-sm text-ink-muted">
            Sampled {qaSummary.sampled ?? 0} · pending {qaSummary.pending ?? 0} · accurate{' '}
            {qaSummary.accurate ?? 0} · inaccurate {qaSummary.inaccurate ?? 0}
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Agronomist</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {qa.map((row) => (
                  <tr key={row.id}>
                    <td>{row.source_type}</td>
                    <td>{row.agronomist_email ?? '—'}</td>
                    <td>
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      {canWrite && row.status === 'pending' ? (
                        <>
                          <Btn
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              run('Marked accurate', async () => {
                                await api(`${base}/diagnosis-qa/${row.id}/audit`, {
                                  method: 'POST',
                                  body: JSON.stringify({ status: 'accurate' }),
                                });
                              })
                            }
                          >
                            Accurate
                          </Btn>{' '}
                          <Btn
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() =>
                              run('Marked inaccurate', async () => {
                                await api(`${base}/diagnosis-qa/${row.id}/audit`, {
                                  method: 'POST',
                                  body: JSON.stringify({ status: 'inaccurate' }),
                                });
                              })
                            }
                          >
                            Inaccurate
                          </Btn>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'locks' ? (
        <Panel
          title="Frozen rule versions"
          description="August never recalculates on September targets. Freeze copies the effective version for that month."
          actions={
            canWrite ? (
              <Btn
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run('Month frozen', async () => {
                    await api(`${base}/locks/freeze`, {
                      method: 'POST',
                      body: JSON.stringify({ month }),
                    });
                  })
                }
              >
                Freeze this month
              </Btn>
            ) : null
          }
        >
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Rule</th>
                  <th>Frozen at</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {locks.map((row) => (
                  <tr key={row.id}>
                    <td>{row.period_month}</td>
                    <td>{RULE_LABELS[row.rule_type] ?? row.rule_type}</td>
                    <td>{row.frozen_at?.slice(0, 16)?.replace('T', ' ')}</td>
                    <td>{row.frozen_by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'fraud' ? (
        <Panel
          title="Fraud flags"
          description="Open or confirmed flags hold unpaid 80/20 settlements. Original earnings are never deleted."
          actions={
            canWrite ? (
              <Btn
                disabled={busy}
                onClick={() =>
                  run('Fraud signals scanned', async () => {
                    await api(`${base}/fraud-flags/scan`, { method: 'POST' });
                  })
                }
              >
                Scan signals
              </Btn>
            ) : null
          }
        >
          {canWrite ? (
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <select
                className={inputClass}
                value={partyType}
                onChange={(e) => setPartyType(e.target.value as 'partner' | 'employee')}
              >
                <option value="partner">Partner</option>
                <option value="employee">Employee</option>
              </select>
              <input
                className={inputClass}
                placeholder="Party UUID"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
              />
              <select className={inputClass} value={flagType} onChange={(e) => setFlagType(e.target.value)}>
                <option value="manual">Manual</option>
                <option value="order_fraud">Order fraud</option>
                <option value="introduction_fraud">Introduction fraud</option>
                <option value="fake_visit">Fake visit</option>
                <option value="fake_km">Fake KM</option>
                <option value="duplicate_claim">Duplicate claim</option>
                <option value="gps_missing">GPS missing</option>
              </select>
              <input
                className={inputClass}
                placeholder="Reason"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
              />
              <Btn
                variant="primary"
                disabled={busy || !partyId || flagReason.length < 3}
                onClick={() =>
                  run('Flag opened — payout held', async () => {
                    await api(`${base}/fraud-flags`, {
                      method: 'POST',
                      body: JSON.stringify({ partyType, partyId, flagType, reason: flagReason }),
                    });
                  })
                }
              >
                Open flag
              </Btn>
            </div>
          ) : null}
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flags.map((row) => (
                  <tr key={String(row.id)}>
                    <td>
                      {String(row.party_type)} · {String(row.party_id).slice(0, 8)}
                    </td>
                    <td>{String(row.flag_type)}</td>
                    <td>
                      <Badge tone={statusTone(String(row.status))}>{String(row.status)}</Badge>
                    </td>
                    <td className="max-w-xs truncate">{String(row.reason ?? '')}</td>
                    <td className="whitespace-nowrap">
                      {canWrite && row.status === 'open' ? (
                        <Btn
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run('Confirmed', async () => {
                              await api(`${base}/fraud-flags/${row.id}/confirm`, { method: 'POST' });
                            })
                          }
                        >
                          Confirm
                        </Btn>
                      ) : null}{' '}
                      {canWrite && (row.status === 'open' || row.status === 'confirmed') ? (
                        <Btn
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run('Cleared — payout unblocked', async () => {
                              await api(`${base}/fraud-flags/${row.id}/clear`, { method: 'POST' });
                            })
                          }
                        >
                          Clear
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'disputes' ? (
        <Panel
          title="Earning disputes"
          description="Upholding writes a negative adjustment row and recovers from unpaid 80/20 tranches. The original earning stays."
        >
          {canWrite ? (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <select
                className={inputClass}
                value={partyType}
                onChange={(e) => setPartyType(e.target.value as 'partner' | 'employee')}
              >
                <option value="partner">Partner</option>
                <option value="employee">Employee</option>
              </select>
              <input
                className={inputClass}
                placeholder="Party UUID"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
              />
              <select
                className={inputClass}
                value={disputeSource}
                onChange={(e) => setDisputeSource(e.target.value)}
              >
                <option value="partner_ledger">Partner ledger</option>
                <option value="agronomist_ledger">Agronomist ledger</option>
              </select>
              <input
                className={inputClass}
                placeholder="Earning UUID"
                value={disputeEarningId}
                onChange={(e) => setDisputeEarningId(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Amount ₹"
                value={disputeAmount}
                onChange={(e) => setDisputeAmount(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Reason"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
              <Btn
                variant="primary"
                disabled={busy || !partyId || !disputeEarningId || disputeReason.length < 3}
                onClick={() =>
                  run('Dispute opened', async () => {
                    await api(`${base}/disputes`, {
                      method: 'POST',
                      body: JSON.stringify({
                        partyType,
                        partyId,
                        earningSource: disputeSource,
                        earningId: disputeEarningId,
                        amountInr: Number(disputeAmount),
                        reason: disputeReason,
                      }),
                    });
                  })
                }
              >
                Open dispute
              </Btn>
            </div>
          ) : null}
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {disputes.map((row) => (
                  <tr key={String(row.id)}>
                    <td>
                      {String(row.party_type)} · {String(row.earning_source)}
                    </td>
                    <td>₹{Number(row.amount_inr ?? 0).toLocaleString('en-IN')}</td>
                    <td>
                      <Badge tone={statusTone(String(row.status))}>{String(row.status)}</Badge>
                    </td>
                    <td className="max-w-xs truncate">{String(row.reason ?? '')}</td>
                    <td className="whitespace-nowrap">
                      {canWrite && row.status === 'open' ? (
                        <>
                          <Btn
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              run('Upheld — adjustment written', async () => {
                                await api(`${base}/disputes/${row.id}/uphold`, { method: 'POST' });
                              })
                            }
                          >
                            Uphold
                          </Btn>{' '}
                          <Btn
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              run('Rejected', async () => {
                                await api(`${base}/disputes/${row.id}/reject`, { method: 'POST' });
                              })
                            }
                          >
                            Reject
                          </Btn>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'drilldown' ? (
        <Panel
          title="Three-month earnings"
          description="HR and payouts only see due amounts. Held rows stay on the ledger until the flag is cleared."
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              className={inputClass}
              value={partyType}
              onChange={(e) => setPartyType(e.target.value as 'partner' | 'employee')}
            >
              <option value="partner">Partner</option>
              <option value="employee">Employee</option>
            </select>
            <input
              className={`${inputClass} w-72`}
              placeholder="Party UUID"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            />
            <Btn disabled={!partyId} onClick={() => void load()}>
              Load
            </Btn>
          </div>
          {drilldown ? (
            <>
              <p className="mb-3 text-sm text-ink-muted">
                Due now ₹{drilldown.dueNow.toLocaleString('en-IN')} · held ₹
                {drilldown.heldNow.toLocaleString('en-IN')}
              </p>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Earned</th>
                      <th>Held</th>
                      <th>Due</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.months.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>₹{row.earned.toLocaleString('en-IN')}</td>
                        <td>₹{row.held.toLocaleString('en-IN')}</td>
                        <td>₹{row.due.toLocaleString('en-IN')}</td>
                        <td>₹{row.paid.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Enter a partner or employee id to see the last three months.</p>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
