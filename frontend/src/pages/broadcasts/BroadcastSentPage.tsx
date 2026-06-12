import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { BROADCAST_API, OPERATIONS_API, type BroadcastCampaign, type BroadcastDelivery } from '../../lib/broadcast-api';
import { useSyncConsoleSearch } from '../../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../../lib/console-page-search';
import { matchesSearch } from '../../lib/search-filter';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, DataTable, EmptyState, PageShell, Panel, TableWrap } from '../../components/ui';

export function BroadcastSentPage() {
  const [deliveries, setDeliveries] = useState<BroadcastDelivery[]>([]);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchDefaults = defaultsForPage('broadcasts-sent');
  useSyncConsoleSearch(search, setSearch, searchDefaults.placeholder ?? 'Search deliveries…');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ ok: boolean; deliveries: BroadcastDelivery[] }>(
        `${OPERATIONS_API}/broadcasts/deliveries?limit=200`
      ),
      api<{ ok: boolean; campaigns: BroadcastCampaign[] }>(`${BROADCAST_API}/campaigns?status=sent`),
    ])
      .then(([del, camp]) => {
        setDeliveries(del.deliveries ?? []);
        setCampaigns(camp.campaigns ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      deliveries.filter((d) =>
        matchesSearch(
          search,
          d.broadcast_kind,
          d.status,
          d.farmers?.name,
          d.farmers?.phone,
          d.skip_reason
        )
      ),
    [deliveries, search]
  );

  return (
    <div>
      <BroadcastSubNav />
      <div className="mb-4 flex justify-end">
        <a
          href={`${BROADCAST_API}/deliveries/export`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Export CSV
        </a>
      </div>
      <PageShell loading={loading} error={error || null}>
        <Panel title={`Recent deliveries (${visible.length})`}>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Farmer</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Delivered</th>
                  <th>Read</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id}>
                    <td className="text-xs">{new Date(d.created_at).toLocaleString('en-IN')}</td>
                    <td>
                      {d.farmers?.name ?? '—'}
                      <span className="block text-xs text-slate-500">{d.farmers?.phone}</span>
                    </td>
                    <td>{d.broadcast_kind}</td>
                    <td className="capitalize">{d.status}</td>
                    <td className="text-xs">
                      {d.delivered_at ? new Date(d.delivered_at).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="text-xs">
                      {d.read_at ? new Date(d.read_at).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          {visible.length === 0 ? <EmptyState>No deliveries yet.</EmptyState> : null}
        </Panel>
        {campaigns.length > 0 ? (
          <Panel title="Sent campaigns">
            <ul className="divide-y text-sm">
              {campaigns.slice(0, 20).map((c) => {
                const stats = c.statsJson as { sent?: number; failed?: number; skipped?: number };
                return (
                  <li key={c.id} className="flex justify-between py-2">
                    <span>{c.name}</span>
                    <span className="text-slate-500">
                      sent {stats.sent ?? 0} · skipped {stats.skipped ?? 0} · failed {stats.failed ?? 0}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}
      </PageShell>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
