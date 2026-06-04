import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import { Alert, Btn, DataTable, EmptyState, Loading, TableWrap, inputClass } from '../ui';
import { CommerceRegistryBanner } from './CommerceRegistryBanner';
import { CommercePromoHeader } from './CommercePromoHeader';
import { CommerceEditIcon } from './CommerceEditIcon';
type Combo = {
  id: string;
  name: string;
  productsLabel: string;
  mrp: number;
  comboPrice: number;
  discountLabel: string;
  status: 'active' | 'inactive';
  description: string | null;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const PAGE_SIZE = 10;

function comboSubtitle(c: Combo): string {
  if (c.description?.trim()) return c.description.trim();
  if (/pest/i.test(c.name)) return 'Control Combo';
  if (/disease/i.test(c.name)) return 'Control Combo';
  if (/crop|recovery/i.test(c.name)) return 'Recovery Combo';
  if (/yield|booster/i.test(c.name)) return 'Booster Combo';
  return 'Agri combo pack';
}

function thumbHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

type Props = { canWrite: boolean };

export function CommerceCombosPanel({ canWrite }: Props) {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewCombo, setViewCombo] = useState<Combo | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    productCount: 3,
    mrp: 0,
    comboPrice: 0,
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    try {
      const d = await api<{
        ok: boolean;
        combos: Combo[];
        pagination: Pagination;
      }>(`/morbeez-staff/api/v1/combos?${params}`);
      setCombos(d.combos ?? []);
      setPagination(d.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load combos');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCombo() {
    setSaving(true);
    try {
      await api('/morbeez-staff/api/v1/combos', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          productCount: Number(form.productCount) || 1,
          mrp: Number(form.mrp) || 0,
          comboPrice: Number(form.comboPrice) || 0,
          description: form.description.trim() || undefined,
        }),
      });
      setCreateOpen(false);
      setForm({ name: '', productCount: 3, mrp: 0, comboPrice: 0, description: '' });
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create combo');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(combo: Combo) {
    if (!canWrite) return;
    const next = combo.status === 'active' ? 'inactive' : 'active';
    try {
      await api(`/morbeez-staff/api/v1/combos/${combo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update combo');
    }
  }

  return (
    <div className="commerce-promo route-combos">
      <CommerceRegistryBanner />
      {error ? <Alert tone="error">{error}</Alert> : null}

      <CommercePromoHeader
        title="Combos"
        createLabel="+ Create Combo"
        onCreate={() => setCreateOpen(true)}
        canWrite={canWrite}
      />

      {loading ? (
        <Loading />
      ) : (
        <div className="commerce-promo__table-card">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Combo Name</th>
                  <th>Products</th>
                  <th>MRP (₹)</th>
                  <th>Combo Price (₹)</th>
                  <th>Discount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {combos.length ? (
                  combos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="commerce-promo__combo-cell">
                          <span
                            className="commerce-promo__thumb commerce-promo__thumb--placeholder"
                            style={{
                              background: `linear-gradient(135deg, hsl(${thumbHue(c.name)}, 42%, 88%) 0%, hsl(${thumbHue(c.name)}, 38%, 72%) 100%)`,
                            }}
                            aria-hidden
                          />
                          <div>
                            <div className="commerce-promo__name">{c.name}</div>
                            <div className="commerce-promo__combo-sub">{comboSubtitle(c)}</div>
                          </div>
                        </div>
                      </td>
                      <td>{c.productsLabel}</td>
                      <td>{c.mrp.toLocaleString('en-IN')}</td>
                      <td className="commerce-promo__price-green">
                        {c.comboPrice.toLocaleString('en-IN')}
                      </td>
                      <td>{c.discountLabel}</td>
                      <td>
                        <span
                          className={
                            c.status === 'active'
                              ? 'commerce-promo__status-pill commerce-promo__status-pill--active'
                              : 'commerce-promo__status-pill commerce-promo__status-pill--inactive'
                          }
                        >
                          {c.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <CommerceEditIcon onClick={() => setViewCombo(c)} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="commerce-promo__empty">
                        <EmptyState>No combos yet. Create your first combo pack.</EmptyState>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableWrap>
          {pagination.pages > 1 ? (
            <div className="commerce-promo__pagination">
              <Btn
                variant="secondary"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Btn>
              <span className="text-sm text-slate-600">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Btn
                variant="secondary"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Btn>
            </div>
          ) : null}
        </div>
      )}

      {createOpen ? (
        <Modal title="Create combo" onClose={() => setCreateOpen(false)} onSave={createCombo} saving={saving}>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">
              Combo name
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pest Control Combo"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Subtitle / description
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Control Combo"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Number of products
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.productCount}
                onChange={(e) => setForm((f) => ({ ...f, productCount: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              MRP (₹)
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.mrp}
                onChange={(e) => setForm((f) => ({ ...f, mrp: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Combo price (₹)
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.comboPrice}
                onChange={(e) => setForm((f) => ({ ...f, comboPrice: Number(e.target.value) }))}
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {viewCombo ? (
        <Modal
          title={viewCombo.name}
          onClose={() => setViewCombo(null)}
          onSave={canWrite ? () => void toggleStatus(viewCombo) : undefined}
          saveLabel={viewCombo.status === 'active' ? 'Deactivate' : 'Activate'}
        >
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-slate-500">Subtitle</dt>
              <dd>{comboSubtitle(viewCombo)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Products</dt>
              <dd>{viewCombo.productsLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">MRP</dt>
              <dd>₹{viewCombo.mrp.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Combo price</dt>
              <dd>₹{viewCombo.comboPrice.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Discount</dt>
              <dd>{viewCombo.discountLabel}</dd>
            </div>
          </dl>
        </Modal>
      ) : null}
    </div>
  );
}
