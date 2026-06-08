import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  SearchSelect,
  TableWrap,
  inputClass,
} from '../ui';

type BannerTab = 'all' | 'active' | 'upcoming' | 'expired';

type Banner = {
  id: string;
  title: string;
  badge: string | null;
  placementLabel: string;
  placement: string;
  schedule: string;
  ctaLabel: string;
  ctaUrl: string | null;
  imageUrl: string | null;
  status: string;
  active: boolean;
  sortOrder: number;
};

const TABS: Array<{ id: BannerTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'expired', label: 'Expired / off' },
];

const PLACEMENTS = [
  { value: 'home_hero', label: 'Homepage hero' },
  { value: 'collection_top', label: 'Collection top' },
  { value: 'promo_strip', label: 'Promo strip' },
] as const;

function toIsoFromLocal(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function statusClass(status: string): string {
  if (status === 'active') return 'offer-status offer-status-active';
  if (status === 'upcoming') return 'offer-status offer-status-upcoming';
  return 'offer-status offer-status-expired';
}

type Props = { canWrite: boolean };

const emptyForm = {
  title: '',
  badge: '',
  description: '',
  imageUrl: '',
  ctaLabel: 'Shop now',
  ctaUrl: '',
  placement: 'home_hero' as (typeof PLACEMENTS)[number]['value'],
  startsAt: '',
  endsAt: '',
  sortOrder: 0,
};

export function CommerceBannersPanel({ canWrite }: Props) {
  const [tab, setTab] = useState<BannerTab>('all');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [tabCounts, setTabCounts] = useState({ all: 0, active: 0, upcoming: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<{
        ok: boolean;
        banners: Banner[];
        tabCounts: typeof tabCounts;
      }>(`/morbeez-staff/api/v1/banners?tab=${tab}`);
      setBanners(d.banners ?? []);
      setTabCounts(d.tabCounts ?? { all: 0, active: 0, upcoming: 0, expired: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({
      title: b.title,
      badge: b.badge ?? '',
      description: '',
      imageUrl: b.imageUrl ?? '',
      ctaLabel: b.ctaLabel,
      ctaUrl: b.ctaUrl ?? '',
      placement: b.placement as typeof emptyForm.placement,
      startsAt: '',
      endsAt: '',
      sortOrder: b.sortOrder,
    });
    void api<{ ok: boolean; banner: Banner & { startsAt: string; endsAt: string; description?: string } }>(
      `/morbeez-staff/api/v1/banners/${b.id}`
    ).then((d) => {
      const row = d.banner;
      const toLocal = (iso: string) => {
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      };
      setForm((f) => ({
        ...f,
        description: row.description ?? '',
        startsAt: toLocal(row.startsAt),
        endsAt: toLocal(row.endsAt),
      }));
    });
    setModalOpen(true);
  }

  async function saveBanner() {
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      badge: form.badge.trim() || undefined,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      ctaLabel: form.ctaLabel.trim() || undefined,
      ctaUrl: form.ctaUrl.trim() || undefined,
      placement: form.placement,
      startsAt: toIsoFromLocal(form.startsAt),
      endsAt: toIsoFromLocal(form.endsAt),
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (editing) {
        await api(`/morbeez-staff/api/v1/banners/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/morbeez-staff/api/v1/banners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save banner');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Banner) {
    if (!canWrite) return;
    try {
      await api(`/morbeez-staff/api/v1/banners/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !b.active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update banner');
    }
  }

  return (
    <div className="commerce-banners route-offers">
      <Alert tone="info" className="commerce-registry-banner">
        Banners are stored in Morbeez for scheduling and copy. The Shopify theme still uses its own
        sections until you wire a sync (metaobjects or theme API).
      </Alert>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}

      {!loading ? (
        <Panel
          title="Storefront banners"
          actions={
            canWrite ? (
              <Btn variant="primary" onClick={openCreate}>
                + New banner
              </Btn>
            ) : null
          }
        >
          <div className="commerce-subtabs offers-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`commerce-subtab ${tab === t.id ? 'commerce-subtab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label} ({tabCounts[t.id] ?? 0})
              </button>
            ))}
          </div>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Placement</th>
                  <th>Schedule</th>
                  <th>CTA</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {banners.length ? (
                  banners.map((b) => (
                    <tr key={b.id}>
                      <td className="col-offer-name">
                        <strong>{b.title}</strong>
                        {b.badge ? (
                          <>
                            <br />
                            <small className="muted">{b.badge}</small>
                          </>
                        ) : null}
                      </td>
                      <td>{b.placementLabel}</td>
                      <td className="col-validity">{b.schedule}</td>
                      <td>
                        {b.ctaLabel}
                        {b.ctaUrl ? (
                          <>
                            <br />
                            <small className="muted truncate max-w-[180px] inline-block">
                              {b.ctaUrl}
                            </small>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <span className={statusClass(b.status)}>{b.status}</span>
                      </td>
                      <td>
                        {canWrite ? (
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand-700 hover:underline"
                              onClick={() => openEdit(b)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs text-slate-600 hover:underline"
                              onClick={() => void toggleActive(b)}
                            >
                              {b.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState>No banners in this tab.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>
      ) : null}

      {modalOpen ? (
        <Modal
          title={editing ? 'Edit banner' : 'New banner'}
          onClose={() => setModalOpen(false)}
          onSave={saveBanner}
          saving={saving}
          wide
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Title
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Badge (optional)
              <input
                className={inputClass}
                value={form.badge}
                onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Placement
              <SearchSelect
                className={inputClass}
                value={form.placement}
                onChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    placement: value as typeof f.placement,
                  }))
                }
                options={PLACEMENTS.map((p) => ({ value: p.value, label: p.label }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Description
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Image URL
              <input
                className={inputClass}
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              CTA label
              <input
                className={inputClass}
                value={form.ctaLabel}
                onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              CTA URL
              <input
                className={inputClass}
                value={form.ctaUrl}
                onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Sort order
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Starts
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Ends
              <input
                type="datetime-local"
                className={inputClass}
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
