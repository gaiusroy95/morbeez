import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Alert,
  Badge,
  Btn,
  DataTable,
  EmptyState,
  FilterBar,
  HubTabs,
  Input,
  Loading,
  PageHeader,
  Panel,
  ReadOnlyBanner,
  Select,
  SideDrawer,
  StatCard,
  StatGrid,
  TableWrap,
  TBody,
  Td,
  THead,
  Th,
} from '../components/ui';

const base = '/morbeez-staff/api/v1/partners';

type Tab = 'dashboard' | 'partners';
type DetailTab = 'overview' | 'farmers' | 'orders' | 'earnings' | 'activity';

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
  territory?: string;
  cropAdvisor?: string;
  totalFarmers?: number;
  totalAcres?: number;
  eligibleSales?: number;
  invoiceValue?: number;
  partnerEarnings?: number;
  mzpCode?: string;
  email?: string;
  kycStatus?: string;
  partnerType?: string;
  partnerSince?: string;
  lastActivity?: string;
};

type DashboardStats = {
  totalPartners: number;
  totalFarmers: number;
  totalAcres: number;
  invoiceValue: number;
  eligibleSales: number;
  avgKpi: number;
  newPartnersThisMonth: number;
  inactivePartners: number;
  deltaPartners: number;
  deltaFarmers: number;
  deltaAcres: number;
  deltaInvoice: number;
  deltaSales: number;
  deltaKpi: number;
  deltaNew: number;
  deltaInactive: number;
};

type PendingApplication = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  status: string;
  created_at?: string;
};

const prevMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

const fmt = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

const kpiBadgeTone = (score: number): 'success' | 'warn' | 'neutral' =>
  score >= 80 ? 'success' : score >= 50 ? 'warn' : 'neutral';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PartnerProgramHubPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [pendingApps, setPendingApps] = useState<PendingApplication[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [territoryFilter, setTerritoryFilter] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [partnersRes, statsRes, appsRes] = await Promise.all([
        api<{ ok: boolean; partners: PartnerRow[] }>(base),
        api<{ ok: boolean; stats: DashboardStats }>(`${base}/dashboard/stats`).catch(() => null),
        api<{ ok: boolean; applications: PendingApplication[] }>(
          `${base}/applications/list?status=pending`
        ).catch(() => ({ ok: true, applications: [] as PendingApplication[] })),
      ]);
      setPartners(partnersRes.partners ?? []);
      setPendingApps(appsRes.applications ?? []);
      if (statsRes?.stats) setStats(statsRes.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approvePending(appId: string) {
    if (!canWrite) return;
    setApprovingId(appId);
    setError('');
    try {
      await api(`${base}/applications/${appId}/approve`, { method: 'POST', body: '{}' });
      await load();
      setTab('partners');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to activate partner');
    } finally {
      setApprovingId(null);
    }
  }

  const active = partners.filter((p) => p.status === 'active');
  const inactive = partners.filter((p) => p.status !== 'active');
  const totalFarmers = partners.reduce((s, p) => s + (p.totalFarmers ?? p.currentActiveFarmers ?? 0), 0);
  const totalAcres = partners.reduce((s, p) => s + (p.totalAcres ?? 0), 0);
  const totalInvoice = partners.reduce((s, p) => s + (p.invoiceValue ?? 0), 0);
  const totalSales = partners.reduce((s, p) => s + (p.eligibleSales ?? 0), 0);
  const avgKpi = partners.length
    ? Math.round(partners.reduce((s, p) => s + (p.performanceScore ?? 0), 0) / partners.length)
    : 0;
  const totalEarnings = partners.reduce((s, p) => s + (p.partnerEarnings ?? 0), 0);
  const pm = prevMonth();

  const topByEligibleSales = [...partners]
    .sort((a, b) => (b.eligibleSales ?? 0) - (a.eligibleSales ?? 0))
    .slice(0, 5);
  const worstByKpi = [...partners]
    .sort((a, b) => (a.performanceScore ?? 0) - (b.performanceScore ?? 0))
    .slice(0, 5);

  const filtered = partners.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.fullName.toLowerCase().includes(q) &&
        !p.partnerCode.toLowerCase().includes(q) &&
        !p.phone.includes(q)
      )
        return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (territoryFilter && p.territory !== territoryFilter) return false;
    if (advisorFilter && p.cropAdvisor !== advisorFilter) return false;
    if (typeFilter && (p.partnerType ?? '') !== typeFilter) return false;
    if (kycFilter && (p.kycStatus ?? '') !== kycFilter) return false;
    return true;
  });

  const territories = [...new Set(partners.map((p) => p.territory).filter(Boolean))] as string[];
  const advisors = [...new Set(partners.map((p) => p.cropAdvisor).filter(Boolean))] as string[];

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTerritoryFilter('');
    setAdvisorFilter('');
    setKycFilter('');
    setTypeFilter('');
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Partner Program"
        description="Manage partners, farmers, sales, earnings and performance."
        actions={
          canWrite ? (
            <Link to="/partners/new">
              <Btn variant="primary">+ Create Partner</Btn>
            </Link>
          ) : undefined
        }
      />
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <HubTabs
        tabs={[
          { id: 'dashboard' as Tab, label: 'Dashboard' },
          { id: 'partners' as Tab, label: 'Partners', badge: partners.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'dashboard' && (
        <div className="space-y-5">
          <StatGrid compact>
            <StatCard compact label="Total Partners" value={String(partners.length)} sub={`↑ ${stats?.deltaPartners ?? 0} vs ${pm}`} />
            <StatCard compact label="Total Farmers" value={String(totalFarmers)} sub={`↑ ${stats?.deltaFarmers ?? 0} vs ${pm}`} />
            <StatCard compact label="Total Acres" value={String(totalAcres)} sub={`↑ ${stats?.deltaAcres ?? 0} vs ${pm}`} />
            <StatCard compact label="Invoice Value" value={fmt(totalInvoice)} sub={`vs ${pm}`} />
            <StatCard compact label="Eligible Sales" value={fmt(totalSales)} sub={`vs ${pm}`} />
            <StatCard compact label="Avg KPI" value={`${avgKpi}%`} sub={`↑ ${stats?.deltaKpi ?? 0} vs ${pm}`} />
            <StatCard
              compact
              label="New Partners"
              value={String(stats?.newPartnersThisMonth ?? 0)}
              sub={`↑ ${stats?.deltaNew ?? 0} vs ${pm}`}
            />
            <StatCard compact label="Inactive" value={String(inactive.length)} sub={`↑ ${stats?.deltaInactive ?? 0} vs ${pm}`} />
          </StatGrid>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Top Partners"
              description="By eligible sales"
              actions={
                <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setTab('partners')}>
                  View all
                </button>
              }
            >
              <TableWrap>
                <DataTable>
                  <THead>
                    <tr>
                      <Th>#</Th>
                      <Th>Partner</Th>
                      <Th>Farmers</Th>
                      <Th>Eligible Sales</Th>
                      <Th>KPI</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {topByEligibleSales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-3">
                          <EmptyState>No partner data yet</EmptyState>
                        </td>
                      </tr>
                    ) : (
                      topByEligibleSales.map((p, i) => (
                        <tr key={p.id} className="hover:bg-surface-subtle/60">
                          <Td>{i + 1}</Td>
                          <Td>
                            <Link to={`/partners/${p.id}`} className="font-medium text-brand-600 hover:underline">
                              {p.fullName}
                            </Link>
                          </Td>
                          <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                          <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                          <Td>{p.performanceScore}%</Td>
                        </tr>
                      ))
                    )}
                  </TBody>
                </DataTable>
              </TableWrap>
            </Panel>

            <Panel title="Needs Attention" description="Lowest KPI scores">
              <TableWrap>
                <DataTable>
                  <THead>
                    <tr>
                      <Th>#</Th>
                      <Th>Partner</Th>
                      <Th>KPI</Th>
                      <Th>Eligible Sales</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {worstByKpi.map((p, i) => (
                      <tr key={p.id} className="hover:bg-surface-subtle/60">
                        <Td>{i + 1}</Td>
                        <Td>
                          <Link to={`/partners/${p.id}`} className="font-medium text-brand-600 hover:underline">
                            {p.fullName}
                          </Link>
                        </Td>
                        <Td>
                          <Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}%</Badge>
                        </Td>
                        <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              </TableWrap>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Sales Overview" description="This month" className="lg:col-span-1">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-ink-muted">Invoice Value</span>
                  <span className="font-semibold text-ink">{fmt(totalInvoice)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-muted">Eligible Sales</span>
                  <span className="font-semibold text-ink">{fmt(totalSales)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-muted">Partner Earnings</span>
                  <span className="font-semibold text-ink">{fmt(totalEarnings)}</span>
                </div>
                <div className="mt-4 flex h-28 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border bg-surface-subtle text-xs text-ink-muted">
                  Trend chart coming soon
                </div>
              </div>
            </Panel>

            <Panel
              title="Performance Summary"
              className="lg:col-span-2"
              actions={
                <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setTab('partners')}>
                  View all
                </button>
              }
              noPadding
            >
              <TableWrap>
                <DataTable>
                  <THead>
                    <tr>
                      <Th>Partner</Th>
                      <Th>Advisor</Th>
                      <Th>Farmers</Th>
                      <Th>Eligible Sales</Th>
                      <Th>KPI</Th>
                      <Th />
                    </tr>
                  </THead>
                  <TBody>
                    {partners.slice(0, 6).map((p) => (
                      <tr key={p.id} className="hover:bg-surface-subtle/60">
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                              {initials(p.fullName)}
                            </span>
                            <div className="min-w-0">
                              <Link to={`/partners/${p.id}`} className="font-medium text-brand-600 hover:underline">
                                {p.fullName}
                              </Link>
                              <div className="text-xs text-ink-muted">{p.partnerCode}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>{p.cropAdvisor ?? '—'}</Td>
                        <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                        <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                        <Td>
                          <Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}%</Badge>
                        </Td>
                        <Td>
                          <Link to={`/partners/${p.id}`} className="text-sm text-brand-600 hover:underline">
                            Details
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              </TableWrap>
            </Panel>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border/80 bg-surface-subtle/60 px-4 py-3 sm:px-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Today's Invoice", value: fmt(0), sub: '—' },
                { label: "Today's Eligible Sales", value: fmt(0), sub: '—' },
                { label: "Today's Earnings", value: fmt(0) },
                { label: 'Pending Orders', value: '—', sub: fmt(0) },
                { label: 'Awaiting Approval', value: '—' },
                { label: 'Pending Payout', value: fmt(0) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.label}</p>
                  <p className="mt-1 text-base font-bold text-ink">{item.value}</p>
                  {item.sub ? <p className="text-xs text-ink-muted">{item.sub}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'partners' && (
        <div className="space-y-5">
          <FilterBar>
            <Input
              className="min-w-[220px] flex-1"
              placeholder="Search partner by name, code, mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
            <Select value={territoryFilter} onChange={(e) => setTerritoryFilter(e.target.value)}>
              <option value="">All Territories</option>
              {territories.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
              <option value="">All Crop Advisors</option>
              {advisors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Select value={kycFilter} onChange={(e) => setKycFilter(e.target.value)}>
              <option value="">All KYC</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="individual">Individual</option>
              <option value="retailer">Retailer</option>
            </Select>
            <Btn variant="ghost" onClick={resetFilters}>
              Reset
            </Btn>
          </FilterBar>

          {pendingApps.length > 0 ? (
            <Panel title="Pending applications" description="Activate to add them to the Partners list and send WhatsApp invite">
              <div className="space-y-2">
                {pendingApps.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border bg-surface-subtle/50 px-3 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium text-ink">{app.full_name}</span>
                      <span className="ml-2 text-ink-muted">{app.phone}</span>
                      {app.email ? <span className="ml-2 text-ink-muted">{app.email}</span> : null}
                    </div>
                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={!canWrite || approvingId === app.id}
                      onClick={() => void approvePending(app.id)}
                    >
                      {approvingId === app.id ? 'Activating…' : 'Activate & Send Invite'}
                    </Btn>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <StatGrid>
            <StatCard compact label="Total Partners" value={String(partners.length)} />
            <StatCard compact label="Active Partners" value={String(active.length)} />
            <StatCard compact label="New Partners" value={String(stats?.newPartnersThisMonth ?? 0)} />
            <StatCard compact label="Total Farmers" value={String(totalFarmers)} />
            <StatCard compact label="Total Acres" value={String(totalAcres)} />
            <StatCard compact label="Invoice Value" value={fmt(totalInvoice)} />
            <StatCard compact label="Eligible Sales" value={fmt(totalSales)} />
          </StatGrid>

          <Panel title="Partners" noPadding>
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>#</Th>
                    <Th>Partner</Th>
                    <Th>Territory</Th>
                    <Th>Crop Advisor</Th>
                    <Th>Farmers</Th>
                    <Th>Acres</Th>
                    <Th>Eligible Sales</Th>
                    <Th>KPI</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </THead>
                <TBody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-3">
                        <EmptyState>No partners found.</EmptyState>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, i) => (
                      <tr
                        key={p.id}
                        className="cursor-pointer hover:bg-surface-subtle/70"
                        onClick={() => {
                          setSelectedPartner(p);
                          setDetailTab('overview');
                        }}
                      >
                        <Td>{i + 1}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                              {initials(p.fullName)}
                            </span>
                            <div>
                              <Link
                                to={`/partners/${p.id}`}
                                className="font-medium text-brand-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {p.fullName}
                              </Link>
                              <div className="text-xs text-ink-muted">{p.partnerCode}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>{p.territory ?? '—'}</Td>
                        <Td>{p.cropAdvisor ?? '—'}</Td>
                        <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                        <Td>{p.totalAcres ?? 0}</Td>
                        <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                        <Td>
                          <Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}%</Badge>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              p.status === 'active' ? 'active' : p.status === 'suspended' ? 'warn' : 'archived'
                            }
                          >
                            {p.status}
                          </Badge>
                        </Td>
                        <Td>
                          <Link to={`/partners/${p.id}`} onClick={(e) => e.stopPropagation()}>
                            <Btn size="sm">Open</Btn>
                          </Link>
                        </Td>
                      </tr>
                    ))
                  )}
                </TBody>
              </DataTable>
            </TableWrap>
          </Panel>

          <SideDrawer
            open={Boolean(selectedPartner)}
            onClose={() => setSelectedPartner(null)}
            title={selectedPartner?.fullName ?? 'Partner'}
            subtitle={
              selectedPartner
                ? `${selectedPartner.partnerCode}${selectedPartner.mzpCode ? ` · ${selectedPartner.mzpCode}` : ''} · ${selectedPartner.territory ?? '—'}`
                : undefined
            }
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'farmers', label: 'Farmers' },
              { id: 'orders', label: 'Orders' },
              { id: 'earnings', label: 'Earnings' },
              { id: 'activity', label: 'Activity' },
            ]}
            activeTab={detailTab}
            onTabChange={(id) => setDetailTab(id as DetailTab)}
            footer={
              selectedPartner ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link to={`/partners/${selectedPartner.id}?tab=farmers`}>
                    <Btn size="sm" className="w-full">
                      View Farmers
                    </Btn>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}?tab=orders`}>
                    <Btn size="sm" className="w-full">
                      Orders
                    </Btn>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}?tab=earnings`}>
                    <Btn size="sm" className="w-full">
                      Earnings
                    </Btn>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}`}>
                    <Btn size="sm" variant="primary" className="w-full">
                      Open Partner
                    </Btn>
                  </Link>
                </div>
              ) : null
            }
          >
            {selectedPartner ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {initials(selectedPartner.fullName)}
                  </div>
                  <div>
                    <Badge tone={selectedPartner.status === 'active' ? 'active' : 'warn'}>
                      {selectedPartner.status}
                    </Badge>
                    <p className="mt-1 text-xs text-ink-muted">Joined {selectedPartner.partnerSince ?? '—'}</p>
                  </div>
                </div>

                <StatGrid className="mb-4 !grid-cols-2">
                  <StatCard compact label="Farmers" value={String(selectedPartner.totalFarmers ?? selectedPartner.currentActiveFarmers)} />
                  <StatCard compact label="Acres" value={String(selectedPartner.totalAcres ?? 0)} />
                  <StatCard compact label="Eligible Sales" value={fmt(selectedPartner.eligibleSales ?? 0)} />
                  <StatCard compact label="Earnings" value={fmt(selectedPartner.partnerEarnings ?? 0)} />
                  <StatCard compact label="KPI" value={`${selectedPartner.performanceScore}%`} />
                  <StatCard compact label="Wallet" value="₹0" />
                </StatGrid>

                {detailTab === 'overview' ? (
                  <div className="space-y-2.5 text-sm">
                    {[
                      ['Crop Advisor', selectedPartner.cropAdvisor ?? '—'],
                      ['Email', selectedPartner.email ?? '—'],
                      ['Mobile', selectedPartner.phone],
                      ['Territory', selectedPartner.territory ?? '—'],
                      ['KYC', selectedPartner.kycStatus === 'verified' ? 'Verified' : selectedPartner.kycStatus ?? 'Pending'],
                      ['Partner Type', selectedPartner.partnerType ?? 'Individual'],
                      ['Last Active', selectedPartner.lastActivity ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
                        <span className="text-ink-muted">{label}</span>
                        <span className="text-right font-medium text-ink">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>
                    <Link to={`/partners/${selectedPartner.id}`} className="font-medium text-brand-600 hover:underline">
                      Open full {detailTab} view
                    </Link>
                  </EmptyState>
                )}
              </>
            ) : null}
          </SideDrawer>
        </div>
      )}
    </div>
  );
}
