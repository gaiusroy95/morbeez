import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { BROADCAST_API, type BroadcastCampaign, type BroadcastTemplate } from '../../lib/broadcast-api';
import { useSyncConsoleSearch } from '../../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../../lib/console-page-search';
import { matchesSearch } from '../../lib/search-filter';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, PageShell, Panel, ReadOnlyBanner } from '../../components/ui';

export function BroadcastAdminPage({ canWrite }: { canWrite: boolean }) {
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<BroadcastCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchDefaults = defaultsForPage('broadcasts-admin');
  useSyncConsoleSearch(search, setSearch, searchDefaults.placeholder ?? 'Search approvals…');

  const load = () => {
    setLoading(true);
    Promise.all([
      api<{ ok: boolean; campaigns: BroadcastCampaign[]; templates: BroadcastTemplate[] }>(
        `${BROADCAST_API}/approvals/pending`
      ),
      api<{ ok: boolean; campaigns: BroadcastCampaign[] }>(`${BROADCAST_API}/campaigns?limit=50`),
    ])
      .then(([pending, all]) => {
        setCampaigns(pending.campaigns ?? []);
        setTemplates(pending.templates ?? []);
        setAllCampaigns(all.campaigns ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const visibleCampaigns = useMemo(
    () => allCampaigns.filter((c) => matchesSearch(search, c.name, c.status, c.category)),
    [allCampaigns, search]
  );

  async function approveCampaign(id: string) {
    await api(`${BROADCAST_API}/campaigns/${id}/approve`, { method: 'POST', body: '{}' });
    load();
  }

  async function cancelCampaign(id: string) {
    await api(`${BROADCAST_API}/campaigns/${id}/cancel`, { method: 'POST', body: '{}' });
    load();
  }

  async function approveTemplate(id: string) {
    await api(`${BROADCAST_API}/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
    load();
  }

  async function archiveTemplate(id: string) {
    await api(`${BROADCAST_API}/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    });
    load();
  }

  return (
    <div>
      <BroadcastSubNav />
      {!canWrite ? <ReadOnlyBanner /> : null}
      <PageShell loading={loading} error={error || null}>
        <Panel title="Approval queue — campaigns">
          {campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">No campaigns pending approval.</p>
          ) : (
            <ul className="divide-y text-sm">
              {campaigns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{c.name}</span>
                  {canWrite ? (
                    <span className="space-x-2">
                      <button
                        type="button"
                        className="text-xs text-emerald-700 hover:underline"
                        onClick={() => void approveCampaign(c.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => void cancelCampaign(c.id)}
                      >
                        Reject
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Approval queue — templates">
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">No templates pending approval.</p>
          ) : (
            <ul className="divide-y text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {t.name} · {t.cropType} · DAP {t.targetDap ?? '—'}
                  </span>
                  {canWrite ? (
                    <span className="space-x-2">
                      <button
                        type="button"
                        className="text-xs text-emerald-700 hover:underline"
                        onClick={() => void approveTemplate(t.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => void archiveTemplate(t.id)}
                      >
                        Reject
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Campaign management">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Name</th>
                <th>Status</th>
                <th>Sent</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.slice(0, 30).map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="py-2">{c.name}</td>
                  <td className="capitalize">{c.status}</td>
                  <td className="text-xs">
                    {c.sentAt ? new Date(c.sentAt).toLocaleString('en-IN') : '—'}
                  </td>
                  {canWrite ? (
                    <td>
                      {c.status === 'scheduled' || c.status === 'draft' ? (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => void cancelCampaign(c.id)}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </PageShell>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
