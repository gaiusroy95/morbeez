import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  Select,
  StatCard,
  TableWrap,
  TBody,
  Td,
  THead,
  Th,
} from '../components/ui';

const base = '/morbeez-staff/api/v1/partners';

type Tab = 'overview' | 'farmers' | 'orders' | 'earnings' | 'payouts' | 'activity' | 'documents';

type Partner = {
  id: string;
  fullName: string;
  partnerCode: string;
  mzpCode?: string;
  status: string;
  phone: string;
  email?: string;
  territory?: string;
  cropAdvisor?: string;
  kycStatus?: string;
  panNumber?: string;
  address?: string;
  partnerSince?: string;
  lastActivity?: string;
  currentActiveFarmers: number;
  inactiveFarmers?: number;
  totalAcres?: number;
  invoiceValueMtd?: number;
  eligibleSalesMtd?: number;
  earningsMtd?: number;
  kpiScore?: number;
  totalOrders?: number;
  totalSales?: number;
  reliabilityScore: number;
  performanceScore: number;
  tier: string;
};

type Introduction = Record<string, unknown>;
type Settlement = Record<string, unknown>;
type Payout = Record<string, unknown>;
type ActivityEvent = Record<string, unknown>;

const INR = (val: unknown) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function PartnerHeader({ partner, canWrite }: { partner: Partner; canWrite: boolean }) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface-elevated px-6 py-4">
      <div className="mb-2">
        <Link to="/partners" className="text-sm text-brand-600 hover:underline">
          ← Back to Partners
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-600 text-lg font-bold text-white">
            {initials(partner.fullName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">{partner.fullName}</h1>
              <Badge tone="neutral">{partner.partnerCode}</Badge>
              {partner.mzpCode && <Badge tone="neutral">{partner.mzpCode}</Badge>}
              <Badge tone={partner.status === 'active' ? 'active' : 'archived'}>{partner.status}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-ink-muted">
              {partner.phone && <span>{partner.phone}</span>}
              {partner.email && <span>{partner.email}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6 text-sm">
          <div>
            <span className="text-xs text-ink-muted">Territory</span>
            <p className="font-medium">{partner.territory || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Crop Advisor</span>
            <p className="font-medium">{partner.cropAdvisor || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">KYC Status</span>
            <Badge tone={partner.kycStatus === 'verified' ? 'success' : 'warn'}>{partner.kycStatus || 'Pending'}</Badge>
          </div>
          <div>
            <span className="text-xs text-ink-muted">PAN</span>
            <p className="font-medium">{partner.panNumber || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Address</span>
            <p className="max-w-[200px] font-medium">{partner.address || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Partner Since</span>
            <p className="font-medium">{partner.partnerSince || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-ink-muted">Last Activity</span>
            <p className="font-medium">{partner.lastActivity || '—'}</p>
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <Btn variant="primary" size="sm">Edit Partner</Btn>
            <Btn variant="secondary" size="sm">More Actions ▾</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ partner, introductions }: { partner: Partner; introductions: Introduction[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Farmers" value={String(partner.currentActiveFarmers + (partner.inactiveFarmers ?? 0))} />
        <StatCard label="Total Acres" value={String(partner.totalAcres ?? 0)} />
        <StatCard label="Invoice Value (MTD)" value={INR(partner.invoiceValueMtd)} />
        <StatCard label="Eligible Sales (MTD)" value={INR(partner.eligibleSalesMtd)} />
        <StatCard label="Earnings (MTD)" value={INR(partner.earningsMtd)} />
        <StatCard label="KPI Performance" value={partner.kpiScore != null ? String(partner.kpiScore) : '—'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Performance">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Invoice Value</span><span>{INR(partner.invoiceValueMtd)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Eligible Sales</span><span>{INR(partner.eligibleSalesMtd)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Earnings</span><span>{INR(partner.earningsMtd)}</span></div>
            <div className="mt-4 border-t border-border pt-4">
              <span className="text-xs text-ink-muted">KPI Score</span>
              <p className="text-3xl font-bold">{partner.kpiScore ?? '—'}</p>
            </div>
            <div className="flex gap-6 text-xs">
              <span>Active Farmers: {partner.currentActiveFarmers}</span>
              <span>Inactive: {partner.inactiveFarmers ?? 0}</span>
              <span>Orders: {partner.totalOrders ?? 0}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Sales Overview">
          <div className="flex h-48 items-center justify-center rounded border border-dashed border-border text-sm text-ink-muted">
            Sales chart — Invoice Value / Eligible Sales / Earnings trend
          </div>
        </Panel>

        <Panel title="Quick Actions">
          <div className="grid grid-cols-1 gap-2">
            <Btn variant="secondary" size="sm" disabled>Create Order for Farmer</Btn>
            <Btn variant="secondary" size="sm" disabled>Send Product (Wallet)</Btn>
            <Btn variant="secondary" size="sm" disabled>Partner Earnings Statement</Btn>
            <Btn variant="secondary" size="sm" disabled>Partner Monthly Report</Btn>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Recent Farmers" noPadding>
          <TableWrap>
            <DataTable>
              <THead>
                <tr>
                  <Th>Farmer Name</Th>
                  <Th>Crop</Th>
                  <Th>Acres</Th>
                  <Th>Crop Advisor</Th>
                  <Th>Last Activity</Th>
                  <Th>Orders</Th>
                  <Th>Invoice Value</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {introductions.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    <Td>{String(row.farmerName ?? row.farmer_name ?? '—')}</Td>
                    <Td>{String(row.crop ?? '—')}</Td>
                    <Td>{String(row.acreage ?? row.acres ?? '—')}</Td>
                    <Td>{String(row.cropAdvisor ?? row.crop_advisor ?? '—')}</Td>
                    <Td>{String(row.lastActivity ?? row.last_activity ?? '—')}</Td>
                    <Td>{String(row.orders ?? row.order_count ?? 0)}</Td>
                    <Td>{INR(row.invoiceValue ?? row.invoice_value ?? 0)}</Td>
                    <Td><Badge tone={row.status === 'active' ? 'active' : 'archived'}>{String(row.status ?? '—')}</Badge></Td>
                  </tr>
                ))}
                {introductions.length === 0 && (
                  <tr><Td colSpan={8}><EmptyState>No recent farmers</EmptyState></Td></tr>
                )}
              </TBody>
            </DataTable>
          </TableWrap>
        </Panel>

        <Panel title="Recent Orders" noPadding>
          <EmptyState>Recent orders coming soon</EmptyState>
        </Panel>
      </div>
    </div>
  );
}

function FarmersTab({ introductions, partnerId }: { introductions: Introduction[]; partnerId: string }) {
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerFarmer, setDrawerFarmer] = useState<Introduction | null>(null);

  const filtered = useMemo(() => {
    return introductions.filter((row) => {
      const name = String(row.farmerName ?? row.farmer_name ?? '').toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (statusFilter && String(row.status) !== statusFilter) return false;
      if (cropFilter && String(row.crop) !== cropFilter) return false;
      return true;
    });
  }, [introductions, search, statusFilter, cropFilter]);

  const crops = useMemo(() => {
    const set = new Set(introductions.map((r) => String(r.crop ?? '')).filter(Boolean));
    return Array.from(set);
  }, [introductions]);

  return (
    <div className="relative">
      <FilterBar>
        <Input placeholder="Search farmer..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
          <option value="">All Crops</option>
          {crops.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </FilterBar>

      <TableWrap>
        <DataTable>
          <THead>
            <tr>
              <Th>Farmer</Th>
              <Th>Mobile</Th>
              <Th>Crop</Th>
              <Th>Acres</Th>
              <Th>Crop Advisor</Th>
              <Th>Orders</Th>
              <Th>Invoice Value</Th>
              <Th>This Month</Th>
              <Th>Status</Th>
            </tr>
          </THead>
          <TBody>
            {filtered.map((row, i) => (
              <tr key={i} className="cursor-pointer hover:bg-surface-subtle" onClick={() => setDrawerFarmer(row)}>
                <Td>{String(row.farmerName ?? row.farmer_name ?? '—')}</Td>
                <Td>{String(row.mobile ?? row.phone ?? '—')}</Td>
                <Td>{String(row.crop ?? '—')}</Td>
                <Td>{String(row.acreage ?? row.acres ?? '—')}</Td>
                <Td>{String(row.cropAdvisor ?? row.crop_advisor ?? '—')}</Td>
                <Td>{String(row.orders ?? row.order_count ?? 0)}</Td>
                <Td>{INR(row.invoiceValue ?? row.invoice_value ?? 0)}</Td>
                <Td>{INR(row.thisMonth ?? row.this_month ?? 0)}</Td>
                <Td><Badge tone={row.status === 'active' ? 'active' : 'archived'}>{String(row.status ?? '—')}</Badge></Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><Td colSpan={9}><EmptyState>No farmers found</EmptyState></Td></tr>
            )}
          </TBody>
        </DataTable>
      </TableWrap>

      {drawerFarmer && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setDrawerFarmer(null)} />
          <div className="fixed right-0 top-0 z-40 h-full w-96 overflow-y-auto border-l border-border bg-surface-elevated p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Farmer Profile</h2>
              <Btn variant="ghost" size="sm" onClick={() => setDrawerFarmer(null)}>✕</Btn>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-xs text-ink-muted">Name</span><p className="font-medium">{String(drawerFarmer.farmerName ?? drawerFarmer.farmer_name ?? '—')}</p></div>
              <div><span className="text-xs text-ink-muted">Mobile</span><p>{String(drawerFarmer.mobile ?? drawerFarmer.phone ?? '—')}</p></div>
              <div><span className="text-xs text-ink-muted">Crop</span><p>{String(drawerFarmer.crop ?? '—')}</p></div>
              <div><span className="text-xs text-ink-muted">Acres</span><p>{String(drawerFarmer.acreage ?? drawerFarmer.acres ?? '—')}</p></div>
              <div><span className="text-xs text-ink-muted">Status</span><p>{String(drawerFarmer.status ?? '—')}</p></div>
            </div>
            <div className="mt-6 rounded border border-border p-4">
              <h3 className="mb-2 text-sm font-semibold">Purchase Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">Today</span><span>{INR(drawerFarmer.today ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">This Month</span><span>{INR(drawerFarmer.thisMonth ?? drawerFarmer.this_month ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Lifetime</span><span>{INR(drawerFarmer.invoiceValue ?? drawerFarmer.invoice_value ?? 0)}</span></div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Btn variant="primary" size="sm" disabled>Create Order</Btn>
              <Link to={`/farmers/${String(drawerFarmer.farmerId ?? drawerFarmer.farmer_id ?? '')}/360`}>
                <Btn variant="secondary" size="sm">Open Farmer CRM</Btn>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ORDER_STATUSES = ['All', 'Draft', 'Pending Approval', 'Approved', 'Rejected', 'Invoice Generated', 'Processing', 'Dispatched', 'Delivered', 'Returned'] as const;

function OrdersTab() {
  const [statusTab, setStatusTab] = useState('All');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((s) => (
          <Btn key={s} variant={statusTab === s ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusTab(s)}>{s}</Btn>
        ))}
      </div>
      <Panel title="Orders">
        <EmptyState>Orders are loaded from the Commerce module. Connect order data to enable this view.</EmptyState>
      </Panel>
    </div>
  );
}

function EarningsTab({ settlements }: { settlements: Settlement[] }) {
  const totals = useMemo(() => {
    let salesIncentive = 0, introCash = 0, walletCredits = 0, walletBalance = 0, pending = 0, paid = 0;
    for (const s of settlements) {
      salesIncentive += Number(s.salesEarning ?? s.sales_earning ?? 0);
      introCash += Number(s.cashReward ?? s.cash_reward ?? 0);
      walletCredits += Number(s.walletCredit ?? s.wallet_credit ?? 0);
      walletBalance += Number(s.walletBalance ?? s.wallet_balance ?? 0);
      if (s.status === 'paid') paid += Number(s.net ?? s.net_amount ?? 0);
      else pending += Number(s.net ?? s.net_amount ?? 0);
    }
    return { salesIncentive, introCash, walletCredits, walletBalance, pending, paid };
  }, [settlements]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Sales Incentive" value={INR(totals.salesIncentive)} />
        <StatCard label="Introduction Cash" value={INR(totals.introCash)} />
        <StatCard label="Wallet Credits" value={INR(totals.walletCredits)} />
        <StatCard label="Wallet Balance" value={INR(totals.walletBalance)} />
        <StatCard label="Pending" value={INR(totals.pending)} />
        <StatCard label="Paid" value={INR(totals.paid)} />
      </div>

      <Panel title="Farmer-wise Earnings" noPadding>
        <TableWrap>
          <DataTable>
            <THead>
              <tr>
                <Th>Farmer</Th>
                <Th>Invoice Value</Th>
                <Th>Eligible Value</Th>
                <Th>Partner %</Th>
                <Th>Sales Earning</Th>
                <Th>₹100 Reward</Th>
                <Th>₹400 Wallet</Th>
              </tr>
            </THead>
            <TBody>
              {settlements.map((row, i) => (
                <tr key={i}>
                  <Td>{String(row.farmerName ?? row.farmer_name ?? '—')}</Td>
                  <Td>{INR(row.invoiceValue ?? row.invoice_value ?? 0)}</Td>
                  <Td>{INR(row.eligibleValue ?? row.eligible_value ?? 0)}</Td>
                  <Td>{String(row.partnerPercent ?? row.partner_percent ?? '—')}%</Td>
                  <Td>{INR(row.salesEarning ?? row.sales_earning ?? 0)}</Td>
                  <Td>{INR(row.cashReward ?? row.cash_reward ?? 0)}</Td>
                  <Td>{INR(row.walletCredit ?? row.wallet_credit ?? 0)}</Td>
                </tr>
              ))}
              {settlements.length === 0 && (
                <tr><Td colSpan={7}><EmptyState>No earnings data</EmptyState></Td></tr>
              )}
            </TBody>
          </DataTable>
        </TableWrap>
      </Panel>

      <Panel title="Wallet">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-ink-muted">Wallet Balance</span>
            <p className="text-2xl font-bold">{INR(totals.walletBalance)}</p>
          </div>
          <Btn variant="secondary" size="sm" disabled>Send Product</Btn>
        </div>
        <EmptyState>Wallet transactions coming soon</EmptyState>
      </Panel>
    </div>
  );
}

function PayoutsTab({ payouts }: { payouts: Payout[] }) {
  const totals = useMemo(() => {
    let eligible = 0, approved = 0, settlement80 = 0, holdback20 = 0, paid = 0, pending = 0;
    for (const p of payouts) {
      eligible += Number(p.eligible ?? p.eligible_amount ?? 0);
      approved += Number(p.approved ?? p.approved_amount ?? 0);
      settlement80 += Number(p.settlement80 ?? p.settlement_80 ?? 0);
      holdback20 += Number(p.holdback20 ?? p.holdback_20 ?? 0);
      if (p.status === 'paid') paid += Number(p.amount ?? p.paid_amount ?? 0);
      else pending += Number(p.amount ?? p.pending_amount ?? 0);
    }
    return { eligible, approved, settlement80, holdback20, paid, pending };
  }, [payouts]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Eligible" value={INR(totals.eligible)} />
        <StatCard label="Approved" value={INR(totals.approved)} />
        <StatCard label="80% Settlement" value={INR(totals.settlement80)} />
        <StatCard label="20% Holdback" value={INR(totals.holdback20)} />
        <StatCard label="Paid" value={INR(totals.paid)} />
        <StatCard label="Pending" value={INR(totals.pending)} />
      </div>

      <Panel title="Payout History" noPadding>
        <TableWrap>
          <DataTable>
            <THead>
              <tr>
                <Th>Period</Th>
                <Th>Eligible Earning</Th>
                <Th>80%</Th>
                <Th>20%</Th>
                <Th>Paid</Th>
                <Th>Pending</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {payouts.map((row, i) => (
                <tr key={i}>
                  <Td>{String(row.period ?? '—')}</Td>
                  <Td>{INR(row.eligible ?? row.eligible_amount ?? 0)}</Td>
                  <Td>{INR(row.settlement80 ?? row.settlement_80 ?? 0)}</Td>
                  <Td>{INR(row.holdback20 ?? row.holdback_20 ?? 0)}</Td>
                  <Td>{INR(row.paid ?? row.paid_amount ?? 0)}</Td>
                  <Td>{INR(row.pending ?? row.pending_amount ?? 0)}</Td>
                  <Td><Badge tone={row.status === 'paid' ? 'success' : 'warn'}>{String(row.status ?? '—')}</Badge></Td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><Td colSpan={7}><EmptyState>No payout data</EmptyState></Td></tr>
              )}
            </TBody>
          </DataTable>
        </TableWrap>
      </Panel>
    </div>
  );
}

const ACTIVITY_TYPES = [
  'All', 'Farmer created', 'Order created', 'Order approved', 'Invoice', 'Payment',
  'Delivery', 'Introduction', 'Wallet', 'Earnings', 'Payout', 'Partner profile changes',
];

function ActivityTab({ events }: { events: ActivityEvent[] }) {
  const [typeFilter, setTypeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [farmerSearch, setFarmerSearch] = useState('');

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== 'All' && String(e.type ?? e.event_type ?? '') !== typeFilter) return false;
      if (farmerSearch) {
        const name = String(e.farmerName ?? e.farmer_name ?? '').toLowerCase();
        if (!name.includes(farmerSearch.toLowerCase())) return false;
      }
      if (dateFilter && String(e.date ?? e.created_at ?? '').slice(0, 10) !== dateFilter) return false;
      return true;
    });
  }, [events, typeFilter, dateFilter, farmerSearch]);

  return (
    <div className="space-y-4">
      <FilterBar>
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input placeholder="Search farmer..." value={farmerSearch} onChange={(e) => setFarmerSearch(e.target.value)} />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState>No activity found</EmptyState>
      ) : (
        <div className="relative ml-4 border-l-2 border-border pl-6">
          {filtered.map((evt, i) => (
            <div key={i} className="relative mb-6 last:mb-0">
              <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-brand-600 bg-surface-elevated" />
              <div className="text-xs text-ink-muted">
                {String(evt.date ?? evt.created_at ?? '—')}
                {evt.type && <Badge tone="info">{String(evt.type ?? evt.event_type)}</Badge>}
              </div>
              <p className="mt-1 text-sm">{String(evt.description ?? evt.message ?? '—')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  return (
    <div className="space-y-6">
      <Panel title="Documents" noPadding>
        <TableWrap>
          <DataTable>
            <THead>
              <tr>
                <Th>Document Type</Th>
                <Th>Number</Th>
                <Th>Status</Th>
                <Th>Uploaded</Th>
                <Th>Verified By</Th>
                <Th>Date</Th>
                <Th>Actions</Th>
              </tr>
            </THead>
            <TBody>
              <tr>
                <Td colSpan={7}>
                  <EmptyState>Document management coming soon. KYC documents will be managed here.</EmptyState>
                </Td>
              </tr>
            </TBody>
          </DataTable>
        </TableWrap>
      </Panel>

      <Panel title="Account Information">
        <p className="text-sm text-ink-muted">Partner ID, Reference Code, Login ID, Account Status, Created Date, Last Login — will be populated from partner data.</p>
      </Panel>
    </div>
  );
}

export function Partner360Page({ canWrite }: { canWrite: boolean }) {
  const { partnerId } = useParams<{ partnerId: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPartner = useCallback(async () => {
    if (!partnerId) return;
    setError('');
    try {
      const r = await api<{ ok: boolean; partner: Partner }>(`${base}/${partnerId}`);
      setPartner(r.partner);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { loadPartner(); }, [loadPartner]);

  useEffect(() => {
    if (!partnerId) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        if (tab === 'overview' || tab === 'farmers') {
          const r = await api<{ ok: boolean; introductions: Introduction[] }>(
            `${base}/introductions?partnerId=${partnerId}`
          );
          if (!ctrl.signal.aborted) setIntroductions(r.introductions ?? []);
        }
        if (tab === 'earnings') {
          const r = await api<{ ok: boolean; settlements: Settlement[] }>(
            `${base}/settlements?partyId=${partnerId}&partyType=partner`
          );
          if (!ctrl.signal.aborted) setSettlements(r.settlements ?? []);
        }
        if (tab === 'payouts') {
          const r = await api<{ ok: boolean; payouts: Payout[] }>(
            `${base}/payouts?partnerId=${partnerId}`
          );
          if (!ctrl.signal.aborted) setPayouts(r.payouts ?? []);
        }
        if (tab === 'activity') {
          const r = await api<{ ok: boolean; events: ActivityEvent[] }>(
            `${base}/events/list?partnerId=${partnerId}`
          );
          if (!ctrl.signal.aborted) setEvents(r.events ?? []);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to load tab data');
      }
    })();

    return () => ctrl.abort();
  }, [tab, partnerId]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-0">
      {error && <div className="px-6 pt-4"><Alert tone="error">{error}</Alert></div>}

      {partner && <PartnerHeader partner={partner} canWrite={canWrite} />}

      <div className="px-6 pt-4">
        <HubTabs
          tabs={[
            { id: 'overview' as Tab, label: 'Overview' },
            { id: 'farmers' as Tab, label: 'Farmers', badge: introductions.length || undefined },
            { id: 'orders' as Tab, label: 'Orders' },
            { id: 'earnings' as Tab, label: 'Earnings & Wallet' },
            { id: 'payouts' as Tab, label: 'Payouts' },
            { id: 'activity' as Tab, label: 'Activity Log' },
            { id: 'documents' as Tab, label: 'Documents' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-6 py-6">
        {tab === 'overview' && partner && <OverviewTab partner={partner} introductions={introductions} />}
        {tab === 'farmers' && partnerId && <FarmersTab introductions={introductions} partnerId={partnerId} />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'earnings' && <EarningsTab settlements={settlements} />}
        {tab === 'payouts' && <PayoutsTab payouts={payouts} />}
        {tab === 'activity' && <ActivityTab events={events} />}
        {tab === 'documents' && <DocumentsTab />}
      </div>
    </div>
  );
}
