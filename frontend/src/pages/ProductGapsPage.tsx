import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../lib/api';
import { useSyncConsoleSearch } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { matchesSearch } from '../lib/search-filter';
import { Alert, DataTable, EmptyState, PageShell, Panel, TableWrap, Btn } from '../components/ui';

type Gap = {
  id: string;
  technical_name: string;
  crop_type: string | null;
  district: string | null;
  recommendation_count: number;
  urgency: string;
  status?: string;
};

type Eta = { availableQty: number; etaDays: number | null; warehouse?: string };

type Alt = { technicalName: string; reason: string; availableQty?: number };

export function ProductGapsPage() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [etas, setEtas] = useState<Record<string, Eta | null>>({});
  const [alts, setAlts] = useState<Record<string, Alt[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchDefaults = defaultsForPage('gaps');
  useSyncConsoleSearch(
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search technical name, crop, district…'
  );
  const visibleGaps = useMemo(
    () =>
      gaps.filter((g) =>
        matchesSearch(search, g.technical_name, g.crop_type, g.district, g.urgency)
      ),
    [gaps, search]
  );

  useEffect(() => {
    setLoading(true);
    setError('');
    api<{ ok: boolean; gaps: Gap[] }>('/morbeez-staff/api/v1/os/product-gaps')
      .then(async (d) => {
        const list = d.gaps ?? [];
        setGaps(list);
        const etaMap: Record<string, Eta | null> = {};
        await Promise.all(
          list.slice(0, 30).map(async (g) => {
            try {
              const r = await api<{ ok: boolean; eta: Eta | null }>(
                `/morbeez-staff/api/v1/os/product-gaps/${encodeURIComponent(g.technical_name)}/inventory-eta`
              );
              etaMap[g.id] = r.eta;
            } catch {
              etaMap[g.id] = null;
            }
          })
        );
        setEtas(etaMap);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function setStatus(id: string, status: 'open' | 'reviewing' | 'sourcing' | 'resolved') {
    await api(`/morbeez-staff/api/v1/os/product-gaps/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const d = await api<{ ok: boolean; gaps: Gap[] }>('/morbeez-staff/api/v1/os/product-gaps');
    setGaps(d.gaps ?? []);
  }

  async function loadAlternatives(g: Gap) {
    if (alts[g.id]) {
      setExpanded(expanded === g.id ? null : g.id);
      return;
    }
    const r = await api<{ ok: boolean; alternatives: Alt[] }>(
      `/morbeez-staff/api/v1/os/product-gaps/${encodeURIComponent(g.technical_name)}/alternatives?crop=${encodeURIComponent(g.crop_type ?? '')}`
    );
    setAlts((m) => ({ ...m, [g.id]: r.alternatives ?? [] }));
    setExpanded(g.id);
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Technicals requested ≥5 times — portfolio sourcing signal
      </p>
      <PageShell loading={loading} error={error || null} loadingLabel="Loading product gaps…">
      <Panel title="Product gap queue">
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Technical</th>
                <th>Crop</th>
                <th>District</th>
                <th>Count</th>
                <th>Stock / ETA</th>
                <th>Urgency</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleGaps.map((g) => {
                const eta = etas[g.id];
                return (
                <Fragment key={g.id}>
                <tr>
                  <td>
                    <strong>{g.technical_name}</strong>
                  </td>
                  <td>{g.crop_type ?? '—'}</td>
                  <td>{g.district ?? '—'}</td>
                  <td>{g.recommendation_count}</td>
                  <td>
                    {eta
                      ? `${eta.availableQty} units${eta.etaDays != null ? ` · ${eta.etaDays}d` : ''}`
                      : '—'}
                  </td>
                  <td className="capitalize">{g.urgency}</td>
                  <td className="capitalize">{g.status ?? 'open'}</td>
                  <td>
                    <Btn size="sm" variant="secondary" onClick={() => void setStatus(g.id, 'sourcing')}>
                      Source
                    </Btn>
                    <Btn size="sm" variant="ghost" className="ml-1" onClick={() => void loadAlternatives(g)}>
                      Alts
                    </Btn>
                  </td>
                </tr>
                {expanded === g.id ? (
                  <tr key={`${g.id}-alts`}>
                    <td colSpan={8}>
                      <ul className="text-sm pl-4">
                        {(alts[g.id] ?? []).map((a) => (
                          <li key={a.technicalName}>
                            {a.technicalName} — {a.reason}
                            {a.availableQty != null ? ` · stock ${a.availableQty}` : ''}
                          </li>
                        ))}
                        {!alts[g.id]?.length ? <li className="muted">No alternatives found.</li> : null}
                      </ul>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
              })}
            </tbody>
          </DataTable>
        </TableWrap>
        {gaps.length === 0 ? <EmptyState>No gaps at threshold yet.</EmptyState> : null}
      </Panel>
      </PageShell>
    </div>
  );
}
