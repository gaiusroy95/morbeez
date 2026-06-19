import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Alert, Btn, HubTabs, Panel, ReadOnlyBanner, TableWrap, inputClass } from '../components/ui';

const base = '/morbeez-staff/api/v1/partners';

type Tab =
  | 'partners'
  | 'applications'
  | 'settings'
  | 'commission'
  | 'events'
  | 'onboarding'
  | 'controlTower';

type PartnerRow = {
  id: string;
  partnerCode: string;
  fullName: string;
  phone: string;
  status: string;
  tier: string;
  reliabilityScore: number;
  performanceScore: number;
  currentActiveFarmers: number;
};

const ONBOARDING_STAGES = [
  'application',
  'screening',
  'interview',
  'training',
  'certification',
  'trial',
  'active',
];

export function PartnerProgramHubPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('partners');
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [applications, setApplications] = useState<Array<Record<string, unknown>>>([]);
  const [settings, setSettings] = useState<Array<Record<string, unknown>>>([]);
  const [commissionRules, setCommissionRules] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [trainingModules, setTrainingModules] = useState<Array<Record<string, unknown>>>([]);
  const [towerFarmerId, setTowerFarmerId] = useState('');
  const [towerData, setTowerData] = useState<Record<string, unknown> | null>(null);
  const [assignPartnerId, setAssignPartnerId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'partners') {
        const r = await api<{ ok: boolean; partners: PartnerRow[] }>(base);
        setPartners(r.partners ?? []);
      } else if (tab === 'applications') {
        const r = await api<{ ok: boolean; applications: Array<Record<string, unknown>> }>(
          `${base}/applications/list`
        );
        setApplications(r.applications ?? []);
      } else if (tab === 'onboarding') {
        const [appsRes, modRes] = await Promise.all([
          api<{ ok: boolean; applications: Array<Record<string, unknown>> }>(
            `${base}/applications/list`
          ),
          api<{ ok: boolean; modules: Array<Record<string, unknown>> }>(
            `${base}/training/modules`
          ),
        ]);
        setApplications(appsRes.applications ?? []);
        setTrainingModules(modRes.modules ?? []);
      } else if (tab === 'settings') {
        const r = await api<{ ok: boolean; settings: Array<Record<string, unknown>> }>(
          `${base}/settings/list`
        );
        setSettings(r.settings ?? []);
      } else if (tab === 'commission') {
        const r = await api<{ ok: boolean; rules: Array<Record<string, unknown>> }>(
          `${base}/commission/list`
        );
        setCommissionRules(r.rules ?? []);
      } else if (tab === 'events') {
        const r = await api<{ ok: boolean; events: Array<Record<string, unknown>> }>(
          `${base}/events/list`
        );
        setEvents(r.events ?? []);
      } else if (tab === 'controlTower') {
        const r = await api<{ ok: boolean; partners: PartnerRow[] }>(base);
        setPartners(r.partners ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function activatePartner(id: string) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await api(`${base}/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active', reason: 'Admin activation' }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setBusy(false);
    }
  }

  async function approveApplication(id: string) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await api(`${base}/applications/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function advanceStage(id: string, stage: string) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await api(`${base}/applications/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stage update failed');
    } finally {
      setBusy(false);
    }
  }

  async function approveEvent(id: string) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await api(`${base}/events/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadControlTower() {
    if (!towerFarmerId.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ ok: boolean } & Record<string, unknown>>(
        `${base}/control-tower/${towerFarmerId.trim()}`
      );
      setTowerData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Control tower load failed');
      setTowerData(null);
    } finally {
      setBusy(false);
    }
  }

  async function assignFarmerPartner() {
    if (!canWrite || !towerFarmerId.trim() || !assignPartnerId) return;
    setBusy(true);
    setError('');
    try {
      await api(`${base}/farmers/${towerFarmerId.trim()}/assign`, {
        method: 'POST',
        body: JSON.stringify({ partnerId: assignPartnerId, reason: 'control_tower_assign' }),
      });
      await loadControlTower();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  const fraudSignals = (towerData?.fraudSignals as Array<Record<string, unknown>>) ?? [];
  const towerAttributions =
    (towerData?.attributions as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="hub-page">
      <h1>Partner Program</h1>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <HubTabs
        tabs={[
          { id: 'partners', label: 'Active partners' },
          { id: 'applications', label: 'Applications' },
          { id: 'onboarding', label: 'Onboarding' },
          { id: 'commission', label: 'Commission' },
          { id: 'events', label: 'Events' },
          { id: 'controlTower', label: 'Control tower' },
          { id: 'settings', label: 'Settings' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === 'partners' ? (
        <Panel title="Partners">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Tier</th>
                  <th>Reliability</th>
                  <th>Farmers</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td>{p.partnerCode}</td>
                    <td>{p.fullName}</td>
                    <td>{p.phone}</td>
                    <td>{p.status}</td>
                    <td>{p.tier}</td>
                    <td>{p.reliabilityScore}</td>
                    <td>{p.currentActiveFarmers}</td>
                    <td>
                      {canWrite && p.status !== 'active' ? (
                        <Btn size="sm" disabled={busy} onClick={() => void activatePartner(p.id)}>
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
      ) : null}

      {tab === 'applications' ? (
        <Panel title="Pending applications">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>District</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={String(a.id)}>
                    <td>{String(a.full_name ?? '')}</td>
                    <td>{String(a.phone ?? '')}</td>
                    <td>{String(a.district ?? '')}</td>
                    <td>{String(a.status ?? '')}</td>
                    <td>
                      {canWrite && a.status === 'pending' ? (
                        <Btn size="sm" disabled={busy} onClick={() => void approveApplication(String(a.id))}>
                          Approve
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

      {tab === 'onboarding' ? (
        <>
          <Panel title="7-stage pipeline">
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={String(a.id)}>
                      <td>{String(a.full_name ?? '')}</td>
                      <td>{String(a.onboarding_stage ?? 'application')}</td>
                      <td>{String(a.status ?? '')}</td>
                      <td>
                        {canWrite
                          ? ONBOARDING_STAGES.map((stage) => (
                              <Btn
                                key={stage}
                                size="sm"
                                disabled={busy}
                                onClick={() => void advanceStage(String(a.id), stage)}
                              >
                                {stage}
                              </Btn>
                            ))
                          : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
          <Panel title="Training modules">
            <pre style={{ fontSize: 12, overflow: 'auto' }}>
              {JSON.stringify(trainingModules, null, 2)}
            </pre>
          </Panel>
        </>
      ) : null}

      {tab === 'commission' ? (
        <Panel title="Commission master (read-only list; edit via API)">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Rule</th>
                  <th>Rate</th>
                  <th>Min reliability</th>
                </tr>
              </thead>
              <tbody>
                {commissionRules.map((r) => (
                  <tr key={String(r.category_key)}>
                    <td>{String(r.category_key)}</td>
                    <td>{String(r.rule_type)}</td>
                    <td>
                      {r.rate_pct != null ? `${r.rate_pct}%` : ''}
                      {r.fixed_inr != null ? `₹${r.fixed_inr}` : ''}
                    </td>
                    <td>{String(r.requires_reliability_min ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'events' ? (
        <Panel title="Partner events">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={String(e.id)}>
                    <td>{String(e.event_code ?? '')}</td>
                    <td>{String(e.name ?? '')}</td>
                    <td>{String(e.status ?? '')}</td>
                    <td>
                      {canWrite && e.status === 'pending' ? (
                        <Btn size="sm" disabled={busy} onClick={() => void approveEvent(String(e.id))}>
                          Approve
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

      {tab === 'controlTower' ? (
        <>
          <Panel title="Farmer team view">
            <label className="mb-2 block text-sm font-medium text-slate-700">Farmer ID</label>
            <input
              className={inputClass}
              value={towerFarmerId}
              onChange={(e) => setTowerFarmerId(e.target.value)}
              placeholder="Farmer UUID"
            />
            <div className="mt-3">
              <Btn disabled={busy} onClick={() => void loadControlTower()}>
                Load
              </Btn>
            </div>
          </Panel>
          {towerData ? (
            <>
              <Panel title="Ownership & assignments">
                <pre style={{ fontSize: 12, overflow: 'auto' }}>
                  {JSON.stringify(
                    {
                      farmer: towerData.farmer,
                      ownership: towerData.ownership,
                      partnerReliability: towerData.partnerReliability,
                      attributions: towerAttributions,
                    },
                    null,
                    2
                  )}
                </pre>
                {canWrite ? (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Assign to partner
                      </label>
                      <select
                        className={inputClass}
                        value={assignPartnerId}
                        onChange={(e) => setAssignPartnerId(e.target.value)}
                      >
                        <option value="">Select partner…</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} ({p.partnerCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Btn disabled={busy || !assignPartnerId} onClick={() => void assignFarmerPartner()}>
                      Assign farmer
                    </Btn>
                  </div>
                ) : null}
              </Panel>
              <Panel title="Fraud / reliability signals">
                {fraudSignals.length ? (
                  <pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(fraudSignals, null, 2)}</pre>
                ) : (
                  <p className="text-sm text-slate-600">No fraud flags for assigned partner.</p>
                )}
              </Panel>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'settings' ? (
        <Panel title="Program settings (configurable thresholds)">
          {settings.map((s) => (
            <pre key={String(s.setting_key)} style={{ fontSize: 12, overflow: 'auto' }}>
              {String(s.setting_key)}: {JSON.stringify(s.setting_value, null, 2)}
            </pre>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}
