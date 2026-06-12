import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Modal, StaticSelect, TableWrap, inputClass } from '../ui';

type PeriodDays = 7 | 30 | 90;

type FunnelRow = {
  leads: number;
  connected: number;
  interested: number;
  booked: number;
  paid: number;
  revenueInr: number;
  conversionPct: number;
  suggestedBonusInr?: number;
  spendInr?: number;
  roi?: number | null;
};

type MarketerRow = FunnelRow & {
  marketerId: string | null;
  marketerName: string;
};

type CampaignRow = FunnelRow & {
  campaign: string;
  channel: string | null;
  spendInr: number;
  roi: number | null;
};

type SpendEntry = {
  id: string;
  month_year: string;
  channel: string;
  amount_inr: number;
  campaign_name?: string | null;
  spend_date?: string | null;
  notes?: string | null;
};

const LEAD_CHANNELS = [
  { value: '', label: 'All channels' },
  { value: 'meta', label: 'Meta' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'field', label: 'Field' },
  { value: 'referral', label: 'Referral' },
  { value: 'organic', label: 'Organic' },
  { value: 'other', label: 'Other' },
];

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

type Props = { canWrite: boolean };

export function MarketingPerformancePanel({ canWrite }: Props) {
  const [days, setDays] = useState<PeriodDays>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [funnel, setFunnel] = useState<FunnelRow | null>(null);
  const [marketers, setMarketers] = useState<MarketerRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [queueHealth, setQueueHealth] = useState<{
    newMetaLeadsWaiting: number;
    oldestWaitingHours: number | null;
    slaTargetHours: number;
  } | null>(null);
  const [unattributedCount, setUnattributedCount] = useState(0);
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>([]);
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  const [spendForm, setSpendForm] = useState({
    monthYear: new Date().toISOString().slice(0, 7),
    channel: 'meta',
    amountInr: '',
    campaignName: '',
    spendDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [importForm, setImportForm] = useState({
    csv: '',
    campaignSource: '',
    marketingOwnerName: '',
  });

  const query = useMemo(() => `days=${days}`, [days]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, marketerRes, campaignRes, spendRes] = await Promise.all([
        api<{
          ok: boolean;
          funnel: FunnelRow;
          queueHealth: typeof queueHealth;
          unattributedCount: number;
        }>(`/morbeez-staff/api/v1/marketing/performance/overview?${query}`),
        api<{ ok: boolean; marketers: MarketerRow[] }>(
          `/morbeez-staff/api/v1/marketing/performance/by-marketer?${query}`
        ),
        api<{ ok: boolean; campaigns: CampaignRow[] }>(
          `/morbeez-staff/api/v1/marketing/performance/by-campaign?${query}`
        ),
        api<{ ok: boolean; entries: SpendEntry[] }>(
          `/morbeez-staff/api/v1/marketing/spend?monthYear=${new Date().toISOString().slice(0, 7)}`
        ),
      ]);
      setFunnel(overviewRes.funnel);
      setQueueHealth(overviewRes.queueHealth);
      setUnattributedCount(overviewRes.unattributedCount);
      setMarketers(marketerRes.marketers ?? []);
      setCampaigns(campaignRes.campaigns ?? []);
      setSpendEntries(spendRes.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketing performance');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSpend() {
    setSaving(true);
    setError('');
    try {
      await api('/morbeez-staff/api/v1/marketing/spend', {
        method: 'POST',
        body: JSON.stringify({
          monthYear: spendForm.monthYear,
          channel: spendForm.channel,
          amountInr: Number(spendForm.amountInr),
          campaignName: spendForm.campaignName.trim() || undefined,
          spendDate: spendForm.spendDate,
          notes: spendForm.notes.trim() || undefined,
        }),
      });
      setShowSpendModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save spend');
    } finally {
      setSaving(false);
    }
  }

  async function importMetaCsv() {
    setSaving(true);
    setImportResult('');
    setError('');
    try {
      const res = await api<{ ok: boolean; imported: number; skipped: number; errors: string[] }>(
        '/morbeez-staff/api/v1/marketing/leads/import-meta-csv',
        {
          method: 'POST',
          body: JSON.stringify({
            csv: importForm.csv,
            leadChannel: 'meta',
            campaignSource: importForm.campaignSource.trim() || undefined,
            marketingOwnerName: importForm.marketingOwnerName.trim() || undefined,
          }),
        }
      );
      setImportResult(
        `Imported ${res.imported} leads (${res.skipped} skipped)${
          res.errors?.length ? `. ${res.errors.length} row errors.` : '.'
        }`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !funnel) return <Loading label="Loading marketing performance…" />;

  return (
    <div className="commerce-marketing-panel space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Marketing performance</h2>
          <p className="text-sm text-slate-600">
            First-touch attribution by channel, campaign, and marketer. Revenue uses ledger gross profit
            within 90 days of lead creation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StaticSelect
            className={inputClass}
            value={String(days)}
            onChange={(v) => setDays(Number(v) as PeriodDays)}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
          {canWrite ? (
            <>
              <Btn variant="secondary" onClick={() => setShowImportModal(true)}>
                Import Meta CSV
              </Btn>
              <Btn variant="primary" onClick={() => setShowSpendModal(true)}>
                Log ad spend
              </Btn>
            </>
          ) : null}
        </div>
      </div>

      {queueHealth ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Telecaller queue:</strong> New Meta leads waiting: {queueHealth.newMetaLeadsWaiting}
          {queueHealth.newMetaLeadsWaiting > 0 && queueHealth.oldestWaitingHours != null ? (
            <>
              {' '}
              · Oldest: {queueHealth.oldestWaitingHours}h · Target: call within{' '}
              {queueHealth.slaTargetHours}h
            </>
          ) : (
            ' · Queue clear'
          )}
        </div>
      ) : null}

      {funnel ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            ['Leads', funnel.leads],
            ['Connected', funnel.connected],
            ['Interested', funnel.interested],
            ['Booked', funnel.booked],
            ['Paid', funnel.paid],
            ['Revenue', inr(funnel.revenueInr)],
            ['Conv %', `${funnel.conversionPct}%`],
            ['Suggested bonus', inr(funnel.suggestedBonusInr ?? 0)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase text-slate-500">{label}</p>
              <p className="text-xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {funnel?.spendInr != null && funnel.spendInr > 0 ? (
        <p className="text-sm text-slate-600">
          Meta spend (period): {inr(funnel.spendInr)}
          {funnel.roi != null ? ` · ROI (gross profit ÷ spend): ${funnel.roi}x` : null}
        </p>
      ) : null}

      {unattributedCount > 0 ? (
        <p className="text-sm text-slate-500">
          {unattributedCount} leads in period lack channel + campaign — excluded from marketer scorecards
          (Unattributed bucket).
        </p>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">By marketer</h3>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Marketer</th>
                <th>Leads</th>
                <th>Connected</th>
                <th>Booked</th>
                <th>Paid</th>
                <th>Revenue</th>
                <th>Conv %</th>
                <th>Suggested bonus</th>
              </tr>
            </thead>
            <tbody>
              {marketers.length ? (
                marketers.map((m) => (
                  <tr key={m.marketerId ?? m.marketerName}>
                    <td>{m.marketerName}</td>
                    <td>{m.leads}</td>
                    <td>{m.connected}</td>
                    <td>{m.booked}</td>
                    <td>{m.paid}</td>
                    <td>{inr(m.revenueInr)}</td>
                    <td>{m.conversionPct}%</td>
                    <td>{inr(m.suggestedBonusInr ?? 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState>No attributed marketer leads in this period.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableWrap>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">By campaign</h3>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Leads</th>
                <th>Paid</th>
                <th>Revenue</th>
                <th>Spend</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length ? (
                campaigns.map((c) => (
                  <tr key={`${c.channel}-${c.campaign}`}>
                    <td>{c.campaign}</td>
                    <td>{c.channel ?? '—'}</td>
                    <td>{c.leads}</td>
                    <td>{c.paid}</td>
                    <td>{inr(c.revenueInr)}</td>
                    <td>{c.spendInr ? inr(c.spendInr) : '—'}</td>
                    <td>{c.roi != null ? `${c.roi}x` : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState>No attributed campaigns in this period.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableWrap>
      </section>

      {spendEntries.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Recent spend entries</h3>
          <ul className="divide-y rounded-lg border border-slate-200 bg-white text-sm">
            {spendEntries.slice(0, 8).map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  {e.campaign_name ?? e.channel} · {e.month_year}
                </span>
                <span className="font-medium">{inr(Number(e.amount_inr))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showSpendModal ? (
        <Modal title="Log marketing spend" onClose={() => setShowSpendModal(false)} onSave={() => void saveSpend()} saving={saving}>
          <div className="grid gap-3">
            <label className="block text-sm">
              Month (YYYY-MM)
              <input
                className={`${inputClass} mt-1`}
                value={spendForm.monthYear}
                onChange={(e) => setSpendForm((f) => ({ ...f, monthYear: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Spend date
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={spendForm.spendDate}
                onChange={(e) => setSpendForm((f) => ({ ...f, spendDate: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Channel
              <StaticSelect
                className={`${inputClass} mt-1`}
                value={spendForm.channel}
                onChange={(v) => setSpendForm((f) => ({ ...f, channel: v }))}
                options={LEAD_CHANNELS.filter((c) => c.value)}
              />
            </label>
            <label className="block text-sm">
              Campaign name
              <input
                className={`${inputClass} mt-1`}
                value={spendForm.campaignName}
                onChange={(e) => setSpendForm((f) => ({ ...f, campaignName: e.target.value }))}
                placeholder="Must match leads.campaign_source for ROI"
              />
            </label>
            <label className="block text-sm">
              Amount (INR)
              <input
                className={`${inputClass} mt-1`}
                value={spendForm.amountInr}
                onChange={(e) => setSpendForm((f) => ({ ...f, amountInr: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                className={`${inputClass} mt-1`}
                rows={2}
                value={spendForm.notes}
                onChange={(e) => setSpendForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {showImportModal ? (
        <Modal
          title="Import Meta lead CSV"
          onClose={() => setShowImportModal(false)}
          onSave={() => void importMetaCsv()}
          saving={saving}
          wide
        >
          <p className="mb-2 text-sm text-slate-600">
            Paste a Meta Lead Ads export (CSV). Phone column required; campaign_name or utm_campaign used
            when present.
          </p>
          {importResult ? <p className="mb-2 text-sm text-emerald-700">{importResult}</p> : null}
          <label className="block text-sm">
            Default campaign (optional)
            <input
              className={`${inputClass} mt-1`}
              value={importForm.campaignSource}
              onChange={(e) => setImportForm((f) => ({ ...f, campaignSource: e.target.value }))}
            />
          </label>
          <label className="block text-sm mt-2">
            External marketer name (optional)
            <input
              className={`${inputClass} mt-1`}
              value={importForm.marketingOwnerName}
              onChange={(e) => setImportForm((f) => ({ ...f, marketingOwnerName: e.target.value }))}
            />
          </label>
          <label className="block text-sm mt-2">
            CSV content
            <textarea
              className={`${inputClass} mt-1 font-mono text-xs`}
              rows={12}
              value={importForm.csv}
              onChange={(e) => setImportForm((f) => ({ ...f, csv: e.target.value }))}
            />
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
