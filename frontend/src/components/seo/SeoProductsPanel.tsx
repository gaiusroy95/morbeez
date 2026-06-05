import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  TableWrap,
  inputClass,
} from '../ui';
import { SEO_API } from './seo-api';

type ProductSeo = {
  shopifyProductId: string;
  title: string;
  handle: string;
  seoTitle: string;
  seoDescription: string;
  urlSlug: string;
  focusKeywords: string;
  complete: boolean;
  faqCount: number;
};

export function SeoProductsPanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<ProductSeo[]>([]);
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState<ProductSeo | null>(null);
  const [edit, setEdit] = useState({ seoTitle: '', seoDescription: '', urlSlug: '', focusKeywords: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (missingOnly) params.set('missingOnly', 'true');
      const d = await api<{ ok: boolean; products: ProductSeo[] }>(
        `${SEO_API}/products?${params}`
      );
      setRows(d.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, missingOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(p: ProductSeo) {
    setSelected(p);
    setEdit({
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      urlSlug: p.urlSlug || p.handle,
      focusKeywords: p.focusKeywords,
    });
    setMsg('');
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`${SEO_API}/products/${selected.shopifyProductId}`, {
        method: 'PUT',
        body: JSON.stringify(edit),
      });
      setMsg('SEO saved');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!selected || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; seo: Record<string, string> }>(
        `${SEO_API}/products/${selected.shopifyProductId}/generate`,
        { method: 'POST' }
      );
      setEdit({
        seoTitle: String(d.seo?.seoTitle ?? ''),
        seoDescription: String(d.seo?.seoDescription ?? ''),
        urlSlug: String(d.seo?.urlSlug ?? edit.urlSlug),
        focusKeywords: String(d.seo?.focusKeywords ?? ''),
      });
      setMsg('AI SEO generated — review and save');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function syncShopify() {
    if (!selected || !canWrite) return;
    setBusy(true);
    try {
      await api(`${SEO_API}/products/${selected.shopifyProductId}/sync`, { method: 'POST' });
      setMsg('Synced to Shopify');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seo-products">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {msg ? <Alert tone="success">{msg}</Alert> : null}

      <div className="seo-form-row">
        <input
          className={inputClass}
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
        <label className="flex flex-row items-center gap-2 text-sm">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Missing SEO only
        </label>
        <Btn size="sm" variant="secondary" onClick={() => void load()}>
          Search
        </Btn>
      </div>

      {loading ? <Loading /> : null}

      <div className="seo-editor-grid">
        <Panel title="Product SEO registry">
          {rows.length === 0 ? <EmptyState>No products found.</EmptyState> : null}
          {rows.length > 0 ? (
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SEO</th>
                    <th>FAQs</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.shopifyProductId}
                      className="commerce-order-row"
                      onClick={() => openEdit(p)}
                    >
                      <td>{p.title}</td>
                      <td>
                        <span
                          className={`seo-status-pill ${p.complete ? 'seo-status-pill--ok' : 'seo-status-pill--warn'}`}
                        >
                          {p.complete ? 'Complete' : 'Incomplete'}
                        </span>
                      </td>
                      <td>{p.faqCount}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          ) : null}
        </Panel>

        {selected ? (
          <Panel
            title={`Edit SEO — ${selected.title}`}
            actions={
              <Link
                to={toPath(`${paths.commerce}/products/${selected.shopifyProductId}/edit`)}
                className="commerce-warehouse-link"
              >
                Product wizard
              </Link>
            }
          >
            <label className="block mb-3">
              SEO title
              <input
                className={inputClass}
                value={edit.seoTitle}
                disabled={!canWrite}
                onChange={(e) => setEdit((s) => ({ ...s, seoTitle: e.target.value }))}
              />
              <span className={`seo-char-count ${edit.seoTitle.length > 60 ? 'seo-char-count--over' : ''}`}>
                {edit.seoTitle.length}/60
              </span>
            </label>
            <label className="block mb-3">
              Meta description
              <textarea
                className={inputClass}
                rows={3}
                value={edit.seoDescription}
                disabled={!canWrite}
                onChange={(e) => setEdit((s) => ({ ...s, seoDescription: e.target.value }))}
              />
              <span
                className={`seo-char-count ${edit.seoDescription.length > 160 ? 'seo-char-count--over' : ''}`}
              >
                {edit.seoDescription.length}/160
              </span>
            </label>
            <label className="block mb-3">
              URL slug
              <input
                className={inputClass}
                value={edit.urlSlug}
                disabled={!canWrite}
                onChange={(e) => setEdit((s) => ({ ...s, urlSlug: e.target.value }))}
              />
            </label>
            <label className="block mb-3">
              Focus keywords
              <input
                className={inputClass}
                value={edit.focusKeywords}
                disabled={!canWrite}
                onChange={(e) => setEdit((s) => ({ ...s, focusKeywords: e.target.value }))}
              />
            </label>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" onClick={() => void generate()} disabled={busy}>
                  Generate SEO (AI)
                </Btn>
                <Btn size="sm" variant="secondary" onClick={() => void save()} disabled={busy}>
                  Save
                </Btn>
                <Btn size="sm" variant="secondary" onClick={() => void syncShopify()} disabled={busy}>
                  Sync to Shopify
                </Btn>
              </div>
            ) : null}
          </Panel>
        ) : (
          <Panel title="Product editor">
            <p className="muted">Select a product to edit SEO fields, generate AI copy, or sync to Shopify.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
