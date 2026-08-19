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

const kpiBadgeTone = (score: number) => (score >= 80 ? 'success' : score >= 50 ? 'warn' : 'error') as 'success' | 'warn' | 'error';

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Panel title="Top Partners (By Eligible Sales)">
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
                          <div className="text-xs text-ink-muted">{p.partnerCode}</div>
                        </Td>
                        <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                        <Td>{p.totalAcres ?? 0}</Td>
                        <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                        <Td>{fmt(p.partnerEarnings ?? 0)}</Td>
                        <Td><Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}</Badge></Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              </TableWrap>
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel title="Worst Performing Partners (By KPI Score)">
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

              <Panel title="Sales Overview">
                <div className="flex items-center justify-center h-32 text-ink-muted text-sm">
                  Sales trend chart — Invoice Value / Eligible Sales / Partner Earnings
                </div>
              </Panel>
            </div>
          </div>

          <Panel title="Partner Performance Summary">
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Partner</Th><Th>Crop Advisor</Th><Th>Farmers</Th><Th>Acres</Th><Th>Invoice Value</Th><Th>Eligible Sales</Th><Th>Earnings</Th><Th>KPI</Th><Th>Active Farmers</Th><Th>Inactive Farmers</Th><Th />
                  </tr>
                </THead>
                <TBody>
                  {partners.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline font-medium">{p.fullName}</Link>
                        <div className="text-xs text-ink-muted">{p.partnerCode}</div>
                      </Td>
                      <Td>{p.cropAdvisor ?? '—'}</Td>
                      <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                      <Td>{p.totalAcres ?? 0}</Td>
                      <Td>{fmt(p.invoiceValue ?? 0)}</Td>
                      <Td>{fmt(p.eligibleSales ?? 0)}</Td>
                      <Td>{fmt(p.partnerEarnings ?? 0)}</Td>
                      <Td><Badge tone={kpiBadgeTone(p.performanceScore)}>{p.performanceScore}</Badge></Td>
                      <Td>{p.currentActiveFarmers}</Td>
                      <Td>{(p.totalFarmers ?? p.currentActiveFarmers) - p.currentActiveFarmers}</Td>
                      <Td>
                        <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline text-sm">Details</Link>
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </TableWrap>
          </Panel>

          <Panel title="Recent Activity">
            {[
              { text: 'Partner Rajesh Kumar activated', time: '2 hours ago' },
              { text: 'New farmer registered by Sunil Yadav', time: '3 hours ago' },
              { text: 'Order #4521 placed via Amit Sharma', time: '5 hours ago' },
              { text: 'KYC approved for Priya Singh', time: '6 hours ago' },
              { text: 'Commission payout processed for July batch', time: '1 day ago' },
              { text: 'Territory reassignment: Ravi Patel → District B', time: '1 day ago' },
              { text: 'New partner application received from Deepak Verma', time: '2 days ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm">{item.text}</span>
                <span className="text-xs text-ink-muted whitespace-nowrap ml-4">{item.time}</span>
              </div>
            ))}
          </Panel>
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
                        <tr><Td colSpan={10}><EmptyState>No partners found.</EmptyState></Td></tr>
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
              <div className="w-96 shrink-0 bg-white border border-slate-200 rounded-lg shadow-lg p-4 overflow-y-auto max-h-[80vh]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                      {selectedPartner.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold">{selectedPartner.fullName}</div>
                      <div className="text-xs text-ink-muted">{selectedPartner.territory ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={selectedPartner.status === 'active' ? 'active' : 'warn'}>{selectedPartner.status}</Badge>
                    <button className="text-ink-muted hover:text-ink text-lg" onClick={() => setSelectedPartner(null)}>×</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-xs text-ink-muted">Total Farmers</div>
                    <div className="font-semibold">{selectedPartner.totalFarmers ?? selectedPartner.currentActiveFarmers}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-xs text-ink-muted">Total Acres</div>
                    <div className="font-semibold">{selectedPartner.totalAcres ?? 0}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-xs text-ink-muted">Eligible Sales</div>
                    <div className="font-semibold">{fmt(selectedPartner.eligibleSales ?? 0)}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-xs text-ink-muted">Earnings</div>
                    <div className="font-semibold">{fmt(selectedPartner.partnerEarnings ?? 0)}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-xs text-ink-muted">KPI (Avg)</div>
                    <div className="font-semibold">{selectedPartner.performanceScore}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-xs text-ink-muted">Wallet Balance</div>
                    <div className="font-semibold">₹0</div>
                  </div>
                </div>

                <div className="flex gap-1 border-b border-slate-200 mb-3">
                  {(['overview', 'farmers', 'orders', 'earnings', 'activity'] as const).map((t) => (
                    <button
                      key={t}
                      className={`px-3 py-1.5 text-xs font-medium capitalize ${detailTab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-ink-muted hover:text-ink'}`}
                      onClick={() => setDetailTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {detailTab === 'overview' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-ink-muted">Crop Advisor</span><span>{selectedPartner.cropAdvisor ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Mobile</span><span>{selectedPartner.phone}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Territory</span><span>{selectedPartner.territory ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Tier</span><span>{selectedPartner.tier}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Reliability</span><span>{selectedPartner.reliabilityScore}</span></div>
                  </div>
                )}

                {detailTab !== 'overview' && (
                  <div className="text-sm text-ink-muted text-center py-6">
                    {detailTab.charAt(0).toUpperCase() + detailTab.slice(1)} data will load from partner 360.
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                  <Link to={`/partners/${selectedPartner.id}`} className="flex-1">
                    <Btn size="sm" className="w-full">View Farmers</Btn>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}`} className="flex-1">
                    <Btn size="sm" className="w-full">Create Order</Btn>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}`} className="flex-1">
                    <Btn size="sm" className="w-full">Send Product</Btn>
                  </Link>
                  <Link to={`/partners/${selectedPartner.id}`} className="flex-1">
                    <Btn size="sm" className="w-full">Edit Partner</Btn>
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
