import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { BROADCAST_API, type BroadcastCampaign } from '../../lib/broadcast-api';
import { useSyncConsoleSearch } from '../../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../../lib/console-page-search';
import { matchesSearch } from '../../lib/search-filter';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, DataTable, EmptyState, PageShell, Panel, TableWrap } from '../../components/ui';

export function BroadcastScheduledPage() {
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchDefaults = defaultsForPage('broadcasts-scheduled');
  useSyncConsoleSearch(search, setSearch, searchDefaults.placeholder ?? 'Search scheduled…');

  useEffect(() => {
    setLoading(true);
    api<{ ok: boolean; campaigns: BroadcastCampaign[] }>(`${BROADCAST_API}/campaigns?status=scheduled`)
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => campaigns.filter((c) => matchesSearch(search, c.name, c.category, c.status)),
    [campaigns, search]
  );

  return (
    <div>
      <BroadcastSubNav />
      <PageShell loading={loading} error={error || null}>
        <Panel title="Scheduled campaigns">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Scheduled (IST)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.category}</td>
                    <td>
                      {c.scheduledAt
                        ? new Date(c.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : '—'}
                    </td>
                    <td className="capitalize">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          {visible.length === 0 ? <EmptyState>No scheduled campaigns.</EmptyState> : null}
        </Panel>
      </PageShell>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
