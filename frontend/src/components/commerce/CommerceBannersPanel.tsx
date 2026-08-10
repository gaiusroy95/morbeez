import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { readFileAsBase64 } from '../../lib/readFileAsBase64';
import { Modal } from '../Modal';
import { CommerceShopifySyncBanner } from './CommerceShopifySyncBanner';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  StaticSelect,
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

  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

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

  async function uploadBannerImage(file: File) {
    setUploadingImage(true);
    setError('');
    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await api<{ ok: boolean; url: string }>('/morbeez-staff/api/v1/banners/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          dataBase64,
          bannerId: editing?.id,
        }),
      });
      setForm((f) => ({ ...f, imageUrl: res.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload image');
    } finally {
      setUploadingImage(false);
    }
  }

  function formatShopifySync(sync?: { ok?: boolean; error?: string; heroSlides?: number }) {
    if (!sync) return '';
    if (sync.ok) {
      const slides = sync.heroSlides ?? 0;
      return `Shopify theme updated (${slides} hero slide${slides === 1 ? '' : 's'}).`;
    }
    return sync.error ? `Banner saved, but Shopify sync failed: ${sync.error}` : '';
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
      let shopifySync: { ok?: boolean; error?: string; heroSlides?: number } | undefined;
      if (editing) {
        const d = await api<{ ok: boolean; shopifySync?: typeof shopifySync }>(
          `/morbeez-staff/api/v1/banners/${editing.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
        shopifySync = d.shopifySync;
      } else {
        const d = await api<{ ok: boolean; shopifySync?: typeof shopifySync }>(
          '/morbeez-staff/api/v1/banners',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        shopifySync = d.shopifySync;
      }
      setSyncMessage(formatShopifySync(shopifySync));
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
      const d = await api<{ ok: boolean; shopifySync?: { ok?: boolean; error?: string; heroSlides?: number } }>(
        `/morbeez-staff/api/v1/banners/${b.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ active: !b.active }),
        }
      );
      setSyncMessage(formatShopifySync(d.shopifySync));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update banner');
    }
  }

  async function pushToShopify() {
    if (!canWrite) return;
    setPushing(true);
    setError('');
    setSyncMessage('');
    try {
      const d = await api<{ ok: boolean; heroSlides?: number; error?: string }>(
        '/morbeez-staff/api/v1/banners/sync-to-theme',
        { method: 'POST' }
      );
      setSyncMessage(`Shopify theme updated (${d.heroSlides ?? 0} hero slides).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sync banners to Shopify');
    } finally {
      setPushing(false);
    }
  }

  async function importFromTheme() {
    if (!canWrite) return;
    setSyncing(true);
    setError('');
    try {
      const d = await api<{
        ok: boolean;
        imported: number;
        created: number;
        updated: number;
        banners: Banner[];
        tabCounts: typeof tabCounts;
      }>('/morbeez-staff/api/v1/banners/sync-from-theme', { method: 'POST' });
      setBanners(d.banners ?? []);
      setTabCounts(d.tabCounts ?? { all: 0, active: 0, upcoming: 0, expired: 0 });
      if ((d.imported ?? 0) === 0) {
        setError('No hero or seasonal sections found in the live Shopify theme.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import from Shopify theme');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="commerce-banners route-offers">
      <CommerceShopifySyncBanner label="Banners" />
      {syncMessage ? <Alert tone="success">{syncMessage}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}

      {!loading ? (
        <Panel
          title="Storefront banners"
          actions={
            canWrite ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <Btn variant="secondary" onClick={() => void importFromTheme()} disabled={syncing || pushing}>
                  {syncing ? 'Importing…' : 'Import from Shopify theme'}
                </Btn>
                <Btn variant="secondary" onClick={() => void pushToShopify()} disabled={syncing || pushing}>
                  {pushing ? 'Syncing…' : 'Sync to Shopify'}
                </Btn>
                <Btn variant="primary" onClick={openCreate}>
                  + New banner
                </Btn>
              </div>
            ) : null
          }
        >
          <p className="text-sm text-slate-600 mb-3">
            Active banners here are pushed to your live Shopify homepage automatically when you save.
            <strong> Homepage hero</strong> banners become hero carousel slides; <strong>Promo strip</strong>{' '}
            banners update the seasonal campaign section. Use <strong>Sync to Shopify</strong> to retry manually.
          </p>
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
                      <EmptyState>
                        No banners in this tab.
                        {canWrite ? ' Import from your Shopify theme or create a new banner.' : null}
                      </EmptyState>
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
              <StaticSelect
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
              Banner image
              <div className="mt-1 flex flex-col gap-2">
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {uploadingImage ? 'Uploading…' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadBannerImage(file);
                    }}
                  />
                </label>
                <input
                  className={inputClass}
                  placeholder="Or paste image URL"
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                />
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Banner preview"
                    className="max-h-40 w-full rounded-lg border border-slate-200 object-cover"
                  />
                ) : null}
              </div>
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
