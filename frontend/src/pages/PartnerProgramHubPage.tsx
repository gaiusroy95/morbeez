import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Alert, Badge, Btn, DataTable, EmptyState, FilterBar, HubTabs, Input, Loading, PageHeader, Panel, ReadOnlyBanner, Select, StatCard, TableWrap, TBody, Td, THead, Th } from '../components/ui';

const base = '/morbeez-staff/api/v1/partners';

type Tab = 'dashboard' | 'partners';

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

const prevMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

const fmt = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

const kpiBadgeTone = (score: number): 'success' | 'warn' | 'neutral' => score >= 80 ? 'success' : score >= 50 ? 'warn' : 'neutral';

export function PartnerProgramHubPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [territoryFilter, setTerritoryFilter] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'farmers' | 'orders' | 'earnings' | 'activity'>('overview');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [partnersRes, statsRes] = await Promise.all([
        api<{ ok: boolean; partners: PartnerRow[] }>(base),
        api<{ ok: boolean; stats: DashboardStats }>(`${base}/dashboard/stats`).catch(() => null),
      ]);
      setPartners(partnersRes.partners ?? []);
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

  const active = partners.filter((p) => p.status === 'active');
  const inactive = partners.filter((p) => p.status !== 'active');
  const totalFarmers = partners.reduce((s, p) => s + (p.totalFarmers ?? p.currentActiveFarmers ?? 0), 0);
  const totalAcres = partners.reduce((s, p) => s + (p.totalAcres ?? 0), 0);
  const totalInvoice = partners.reduce((s, p) => s + (p.invoiceValue ?? 0), 0);
  const totalSales = partners.reduce((s, p) => s + (p.eligibleSales ?? 0), 0);
  const avgKpi = partners.length ? Math.round(partners.reduce((s, p) => s + (p.performanceScore ?? 0), 0) / partners.length) : 0;
  const totalEarnings = partners.reduce((s, p) => s + (p.partnerEarnings ?? 0), 0);
  const pm = prevMonth();

  const topByEligibleSales = [...partners].sort((a, b) => (b.eligibleSales ?? 0) - (a.eligibleSales ?? 0)).slice(0, 5);
  const worstByKpi = [...partners].sort((a, b) => (a.performanceScore ?? 0) - (b.performanceScore ?? 0)).slice(0, 5);

  const filtered = partners.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.fullName.toLowerCase().includes(q) && !p.partnerCode.toLowerCase().includes(q) && !p.phone.includes(q)) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (territoryFilter && p.territory !== territoryFilter) return false;
    if (advisorFilter && p.cropAdvisor !== advisorFilter) return false;
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
    <div className="hub-page">
      <PageHeader
        title="Partner Program"
        actions={
          canWrite ? (
            <Link to="/partners/new">
              <Btn>+ Create Partner</Btn>
            </Link>
          ) : undefined
        }
      />
      {!canWrite && <ReadOnlyBanner />}
      {error && <Alert tone="error">{error}</Alert>}

      <HubTabs
        tabs={[
          { id: 'dashboard' as Tab, label: 'Dashboard' },
          { id: 'partners' as Tab, label: 'Partners', badge: partners.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 overflow-x-auto">
            <StatCard label="Total Partners" value={String(partners.length)} sub={`↑ ${stats?.deltaPartners ?? 18} vs ${pm}`} />
            <StatCard label="Total Farmers" value={String(totalFarmers)} sub={`↑ ${stats?.deltaFarmers ?? 120} vs ${pm}`} />
            <StatCard label="Total Acres" value={String(totalAcres)} sub={`↑ ${stats?.deltaAcres ?? 340} vs ${pm}`} />
            <StatCard label="Invoice Value" value={fmt(totalInvoice)} sub={`↑ ${fmt(stats?.deltaInvoice ?? 0)} vs ${pm}`} />
            <StatCard label="Eligible Sales" value={fmt(totalSales)} sub={`↑ ${fmt(stats?.deltaSales ?? 0)} vs ${pm}`} />
            <StatCard label="Avg KPI Performance" value={String(avgKpi)} sub={`↑ ${stats?.deltaKpi ?? 2} vs ${pm}`} />
            <StatCard label="New Partners (This Month)" value={String(stats?.newPartnersThisMonth ?? partners.filter((p) => p.status === 'active').length)} sub={`↑ ${stats?.deltaNew ?? 3} vs ${pm}`} />
            <StatCard label="Inactive Partners" value={String(inactive.length)} sub={`↑ ${stats?.deltaInactive ?? 1} vs ${pm}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Panel
              title="Top Partners (By Eligible Sales)"
              actions={<Link to="/partners?tab=partners" className="text-xs text-brand-600 hover:underline font-medium">View All</Link>}
            >
              <TableWrap>
                <DataTable>
                  <THead>
                    <tr>
                      <Th>#</Th><Th>Partner</Th><Th>Farmers</Th><Th>Acres</Th><Th>Eligible Sales</Th><Th>Earnings</Th><Th>KPI</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {topByEligibleSales.map((p, i) => (
                      <tr key={p.id}>
                        <Td>{i + 1}</Td>
                        <Td>
                          <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline font-medium">{p.fullName}</Link>
                        </Td>
                        <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                        <Td>{p.totalAcres ?? 0}</Td>
                        <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                        <Td>{fmt(p.partnerEarnings ?? 0)}</Td>
                        <Td>{p.performanceScore}%</Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              </TableWrap>
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel
                title="Worst Performing Partners (By KPI Score)"
                actions={<Link to="/partners?tab=partners" className="text-xs text-brand-600 hover:underline font-medium">View All</Link>}
              >
                <TableWrap>
                  <DataTable>
                    <THead>
                      <tr>
                        <Th>#</Th><Th>Partner</Th><Th>KPI</Th><Th>Eligible Sales</Th><Th>Farmers</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {worstByKpi.map((p, i) => (
                        <tr key={p.id}>
                          <Td>{i + 1}</Td>
                          <Td>
                            <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline font-medium">{p.fullName}</Link>
                          </Td>
                          <Td><Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}</Badge></Td>
                          <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                          <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                        </tr>
                      ))}
                    </TBody>
                  </DataTable>
                </TableWrap>
              </Panel>

              <Panel title="Sales Overview (This Month)">
                <div className="mb-3 flex gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-blue-500" /> Invoice Value</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-emerald-500" /> Eligible Sales</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-amber-500" /> Partner Earnings</span>
                </div>
                <div className="flex items-center justify-center h-24 rounded-lg bg-surface-subtle text-ink-muted text-xs">
                  Chart placeholder
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-ink-muted">Invoice Value</p>
                    <p className="text-sm font-bold">{fmt(totalInvoice)}</p>
                    <p className="text-xs text-emerald-600">↑ 18.6%</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Eligible Sales</p>
                    <p className="text-sm font-bold">{fmt(totalSales)}</p>
                    <p className="text-xs text-emerald-600">↑ 17.5%</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Partner Earnings</p>
                    <p className="text-sm font-bold">{fmt(totalEarnings)}</p>
                    <p className="text-xs text-emerald-600">↑ 16.8%</p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Panel
              title="Partner Performance Summary"
              className="lg:col-span-2"
              actions={<Link to="/partners?tab=partners" className="text-xs text-brand-600 hover:underline font-medium">View All</Link>}
            >
              <TableWrap>
                <DataTable>
                  <THead>
                    <tr>
                      <Th>Partner</Th><Th>Crop Advisor</Th><Th>Farmers</Th><Th>Acres</Th><Th>Invoice Value</Th><Th>Eligible Sales</Th><Th>Earnings</Th><Th>KPI</Th><Th>Active Farmers</Th><Th>Inactive Farmers</Th><Th />
                    </tr>
                  </THead>
                  <TBody>
                    {partners.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                              {p.fullName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </span>
                            <div>
                              <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline font-medium">{p.fullName}</Link>
                              <div className="text-xs text-ink-muted">{p.partnerCode}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>{p.cropAdvisor ?? '—'}</Td>
                        <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                        <Td>{p.totalAcres ?? 0}</Td>
                        <Td>{fmt(p.invoiceValue ?? 0)}</Td>
                        <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                        <Td>{fmt(p.partnerEarnings ?? 0)}</Td>
                        <Td><Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}%</Badge></Td>
                        <Td>{p.currentActiveFarmers} ({Math.round((p.currentActiveFarmers / Math.max(p.totalFarmers ?? p.currentActiveFarmers, 1)) * 100)}%)</Td>
                        <Td>{(p.totalFarmers ?? p.currentActiveFarmers) - p.currentActiveFarmers} ({Math.round(((p.totalFarmers ?? p.currentActiveFarmers) - p.currentActiveFarmers) / Math.max(p.totalFarmers ?? p.currentActiveFarmers, 1) * 100)}%)</Td>
                        <Td>
                          <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline text-sm">Details</Link>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              </TableWrap>
            </Panel>

            <Panel
              title="Recent Activity"
              actions={<Link to="/partners/audit-log" className="text-xs text-brand-600 hover:underline font-medium">View All</Link>}
            >
              {[
                { icon: '👤', text: 'New farmer added by Partner Prakash Kumar (F-1021)', time: '15m ago' },
                { icon: '🌾', text: 'Crop Advisor (Advisor 01) contacted Farmer F-1021', time: '25m ago' },
                { icon: '📦', text: 'Order ORD-2051 created for Farmer F-1021', time: '1h ago' },
                { icon: '✅', text: 'Order ORD-2051 approved by Agronomist', time: '1h 30m ago' },
                { icon: '🧾', text: 'Invoice INV-44821 generated', time: '2h ago' },
                { icon: '💰', text: 'Payment received for INV-44820', time: '3h ago' },
                { icon: '🚚', text: 'Product delivered to Farmer F-1015', time: '4h ago' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                  <span className="mt-0.5 text-base">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink leading-snug">{item.text}</p>
                  </div>
                  <span className="text-xs text-ink-muted whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </Panel>
          </div>

          <div className="mt-4 rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated shadow-[var(--shadow-card)] px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s Invoice Value</p>
                <p className="mt-1 text-lg font-bold text-ink">₹6,85,420</p>
                <p className="text-xs text-ink-muted">12 Orders</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s Eligible Sales</p>
                <p className="mt-1 text-lg font-bold text-ink">₹6,32,110</p>
                <p className="text-xs text-ink-muted">12 Orders</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s Earnings</p>
                <p className="mt-1 text-lg font-bold text-ink">₹60,345</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pending Orders</p>
                <p className="mt-1 text-lg font-bold text-ink">32</p>
                <p className="text-xs text-ink-muted">₹4,20,580</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Orders Awaiting Approval</p>
                <p className="mt-1 text-lg font-bold text-ink">18</p>
                <p className="text-xs text-ink-muted">₹2,35,450</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pending Payout</p>
                <p className="mt-1 text-lg font-bold text-ink">₹6,85,400</p>
                <p className="text-xs text-ink-muted">16 Partners</p>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'partners' && (
        <>
          <FilterBar>
            <Input placeholder="Search partner by name, code, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
            <Select value={territoryFilter} onChange={(e) => setTerritoryFilter(e.target.value)}>
              <option value="">All Territories</option>
              {territories.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
              <option value="">All Crop Advisors</option>
              {advisors.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select value={kycFilter} onChange={(e) => setKycFilter(e.target.value)}>
              <option value="">All KYC Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Partner Types</option>
              <option value="individual">Individual</option>
              <option value="retailer">Retailer</option>
            </Select>
            <Btn variant="ghost">More Filters</Btn>
            <Btn variant="ghost" onClick={resetFilters}>Reset</Btn>
          </FilterBar>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-4">
            <StatCard label="Total Partners" value={String(partners.length)} />
            <StatCard label="Active Partners" value={String(active.length)} />
            <StatCard label="New Partners" value={String(stats?.newPartnersThisMonth ?? 0)} />
            <StatCard label="Total Farmers" value={String(totalFarmers)} />
            <StatCard label="Total Acres" value={String(totalAcres)} />
            <StatCard label="Invoice Value" value={fmt(totalInvoice)} />
            <StatCard label="Eligible Sales" value={fmt(totalSales)} />
          </div>

          <div className="flex gap-4">
            <div className={selectedPartner ? 'flex-1 min-w-0' : 'w-full'}>
              <Panel title="Partners">
                <TableWrap>
                  <DataTable>
                    <THead>
                      <tr>
                        <Th>#</Th><Th>Partner Name</Th><Th>Territory</Th><Th>Crop Advisor</Th><Th>Farmers</Th><Th>Acres</Th><Th>Eligible Sales</Th><Th>KPI (Avg)</Th><Th>Status</Th><Th />
                      </tr>
                    </THead>
                    <TBody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-3"><EmptyState>No partners found.</EmptyState></td></tr>
                      ) : filtered.map((p, i) => (
                        <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedPartner(p); setDetailTab('overview'); }}>
                          <Td>{i + 1}</Td>
                          <Td>
                            <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>{p.fullName}</Link>
                            <div className="text-xs text-ink-muted">{p.partnerCode}</div>
                          </Td>
                          <Td>{p.territory ?? '—'}</Td>
                          <Td>{p.cropAdvisor ?? '—'}</Td>
                          <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                          <Td>{p.totalAcres ?? 0}</Td>
                          <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                          <Td><Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}</Badge></Td>
                          <Td><Badge tone={p.status === 'active' ? 'active' : p.status === 'suspended' ? 'warn' : 'archived'}>{p.status}</Badge></Td>
                          <Td>
                            <Link to={`/partners/${p.id}`} onClick={(e) => e.stopPropagation()}>
                              <Btn size="sm">Details</Btn>
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </TBody>
                  </DataTable>
                </TableWrap>
              </Panel>
            </div>

            {selectedPartner && (
              <div className="w-96 shrink-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto max-h-[80vh]">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-ink-muted">Partner Details</span>
                    <button className="text-ink-muted hover:text-ink text-lg leading-none" onClick={() => setSelectedPartner(null)}>×</button>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg">
                      {selectedPartner.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{selectedPartner.fullName}</span>
                        <Badge tone={selectedPartner.status === 'active' ? 'active' : 'warn'}>{selectedPartner.status}</Badge>
                      </div>
                      <div className="text-xs text-ink-muted">{selectedPartner.partnerCode}{selectedPartner.mzpCode ? ` | ${selectedPartner.mzpCode}` : ''} | {selectedPartner.territory ?? '—'}</div>
                      <div className="text-xs text-ink-muted">Joined on {selectedPartner.partnerSince ?? '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
                  <div className="text-center">
                    <div className="text-xs text-ink-muted">Total Farmers</div>
                    <div className="font-bold text-lg">{selectedPartner.totalFarmers ?? selectedPartner.currentActiveFarmers}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-ink-muted">Total Acres</div>
                    <div className="font-bold text-lg">{selectedPartner.totalAcres ?? 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-ink-muted">Eligible Sales</div>
                    <div className="font-bold text-lg">{fmt(selectedPartner.eligibleSales ?? 0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-ink-muted">Earnings (This Month)</div>
                    <div className="font-bold text-lg">{fmt(selectedPartner.partnerEarnings ?? 0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-ink-muted">KPI (Avg)</div>
                    <div className="font-bold text-lg">{selectedPartner.performanceScore}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-ink-muted">Wallet Balance</div>
                    <div className="font-bold text-lg">₹0</div>
                  </div>
                </div>

                <div className="px-4 pt-3">
                  <div className="flex gap-1 border-b border-slate-200 mb-3">
                    {(['overview', 'farmers', 'orders', 'earnings', 'activity'] as const).map((t) => (
                      <button
                        key={t}
                        className={`px-3 py-1.5 text-xs font-medium capitalize ${detailTab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-ink-muted hover:text-ink'}`}
                        onClick={() => setDetailTab(t)}
                      >
                        {t === 'overview' ? 'Overview' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>

                  {detailTab === 'overview' && (
                    <div className="space-y-2 text-sm pb-3">
                      <div className="flex justify-between"><span className="text-ink-muted">Crop Advisor</span><span>{selectedPartner.cropAdvisor ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Email</span><span className="text-xs">{selectedPartner.email ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Mobile</span><span>{selectedPartner.phone}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Territory</span><span>{selectedPartner.territory ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">KYC Status</span><span>{selectedPartner.kycStatus === 'verified' ? '✅ Verified' : selectedPartner.kycStatus ?? 'Pending'}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Partner Type</span><span>{selectedPartner.partnerType ?? 'Individual'}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Last Active</span><span>{selectedPartner.lastActivity ?? '—'}</span></div>
                    </div>
                  )}

                  {detailTab !== 'overview' && (
                    <div className="text-sm text-ink-muted text-center py-6">
                      <Link to={`/partners/${selectedPartner.id}`} className="text-brand-600 hover:underline">
                        View full {detailTab} in Partner 360 →
                      </Link>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1 p-3 border-t border-slate-200 bg-slate-50">
                  <Link to={`/partners/${selectedPartner.id}?tab=farmers`} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-white text-center">
                    <span className="text-lg">👥</span>
                    <span className="text-[10px] text-ink-muted leading-tight">View Farmers</span>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}?tab=orders`} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-white text-center">
                    <span className="text-lg">📦</span>
                    <span className="text-[10px] text-ink-muted leading-tight">Create Order</span>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}?tab=earnings`} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-white text-center">
                    <span className="text-lg">🏪</span>
                    <span className="text-[10px] text-ink-muted leading-tight">Send Product</span>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}`} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-white text-center">
                    <span className="text-lg">✏️</span>
                    <span className="text-[10px] text-ink-muted leading-tight">Edit Partner</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
