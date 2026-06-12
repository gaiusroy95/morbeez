import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { BROADCAST_API, CAMPAIGN_CATEGORIES, type BroadcastTemplate } from '../../lib/broadcast-api';
import { paths, toPath } from '../../lib/routes';
import { useSyncConsoleSearch } from '../../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../../lib/console-page-search';
import { matchesSearch } from '../../lib/search-filter';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, DataTable, EmptyState, PageShell, Panel, ReadOnlyBanner, StaticSelect, TableWrap } from '../../components/ui';

export function BroadcastTemplatesPage({ canWrite }: { canWrite: boolean }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'custom_message',
    cropType: 'ginger',
    targetDap: '',
    title: '',
    body: '',
  });
  const searchDefaults = defaultsForPage('broadcasts-templates');
  useSyncConsoleSearch(search, setSearch, searchDefaults.placeholder ?? 'Search templates…');

  const load = () => {
    setLoading(true);
    api<{ ok: boolean; templates: BroadcastTemplate[] }>(`${BROADCAST_API}/templates`)
      .then((d) => setTemplates(d.templates ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () =>
      templates.filter((t) =>
        matchesSearch(search, t.name, t.category, t.cropType, t.body, t.status)
      ),
    [templates, search]
  );

  async function saveTemplate(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    await api(`${BROADCAST_API}/templates`, {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        category: form.category,
        cropType: form.cropType || undefined,
        targetDap: form.targetDap ? Number(form.targetDap) : undefined,
        title: form.title || undefined,
        body: form.body,
      }),
    });
    setShowForm(false);
    load();
  }

  async function cloneToCampaign(id: string) {
    const d = await api<{ ok: boolean; campaign: { id: string } }>(
      `${BROADCAST_API}/templates/${id}/clone-to-campaign`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    navigate(toPath(paths.broadcastsNew), { state: { campaignId: d.campaign.id } });
  }

  return (
    <div>
      <BroadcastSubNav />
      {!canWrite ? <ReadOnlyBanner /> : null}
      {canWrite ? (
        <button
          type="button"
          className="mb-4 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : 'New template'}
        </button>
      ) : null}
      {showForm && canWrite ? (
        <form onSubmit={saveTemplate} className="mb-6 space-y-3 rounded-xl border bg-white p-4">
          <input
            className="w-full rounded border px-2 py-1.5 text-sm"
            placeholder="Template name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <StaticSelect
            className="w-full max-w-md rounded border px-2 py-1.5 text-sm"
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={CAMPAIGN_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded border px-2 py-1.5 text-sm"
              placeholder="Crop"
              value={form.cropType}
              onChange={(e) => setForm((f) => ({ ...f, cropType: e.target.value }))}
            />
            <input
              type="number"
              className="rounded border px-2 py-1.5 text-sm"
              placeholder="Target DAP"
              value={form.targetDap}
              onChange={(e) => setForm((f) => ({ ...f, targetDap: e.target.value }))}
            />
            <input
              className="rounded border px-2 py-1.5 text-sm"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <textarea
            className="min-h-[120px] w-full rounded border px-2 py-1.5 font-mono text-sm"
            placeholder="Body with {{FarmerName}} variables"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            required
          />
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">
            Save draft template
          </button>
        </form>
      ) : null}
      <PageShell loading={loading} error={error || null}>
        <Panel title="Template library">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Crop</th>
                  <th>DAP</th>
                  <th>Status</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.category}</td>
                    <td>{t.cropType ?? '—'}</td>
                    <td>{t.targetDap ?? '—'}</td>
                    <td className="capitalize">{t.status}</td>
                    {canWrite ? (
                      <td>
                        <button
                          type="button"
                          className="text-xs text-emerald-700 hover:underline"
                          onClick={() => void cloneToCampaign(t.id)}
                        >
                          Use in campaign
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          {visible.length === 0 ? <EmptyState>No templates yet.</EmptyState> : null}
        </Panel>
      </PageShell>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
