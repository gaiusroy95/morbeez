import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import { Alert, Btn, DataTable, EmptyState, Loading, TableWrap, inputClass } from '../ui';
import { CommerceRegistryBanner } from './CommerceRegistryBanner';
import { CommercePromoHeader } from './CommercePromoHeader';
import { FlashSaleStatusCell } from './FlashSaleStatusCell';
type FlashSale = {
  id: string;
  productName: string;
  imageUrl: string | null;
  flashPrice: number;
  originalPrice: number;
  status: string;
  startLabel: string;
  endLabel: string;
  startsAt: string;
  endsAt: string;
  stockTotal: number;
  stockSold: number;
};

function toIsoFromLocal(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

type Props = { canWrite: boolean };

export function CommerceFlashSalesPanel({ canWrite }: Props) {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    productName: '',
    imageUrl: '',
    flashPrice: 0,
    originalPrice: 0,
    startsAt: '',
    endsAt: '',
    stockTotal: 500,
    shopifyProductId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<{
        ok: boolean;
        sales: FlashSale[];
        pagination: { page: number; pages: number };
      }>(`/morbeez-staff/api/v1/flash-sales?tab=all&page=${page}&limit=20`);
      setSales(d.sales ?? []);
      setPages(d.pagination?.pages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flash sales');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSale() {
    setSaving(true);
    try {
      await api('/morbeez-staff/api/v1/flash-sales', {
        method: 'POST',
        body: JSON.stringify({
          productName: form.productName.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          flashPrice: Number(form.flashPrice) || 0,
          originalPrice: Number(form.originalPrice) || 0,
          startsAt: toIsoFromLocal(form.startsAt),
          endsAt: toIsoFromLocal(form.endsAt),
          stockTotal: Number(form.stockTotal) || 100,
          shopifyProductId: form.shopifyProductId.trim() || undefined,
        }),
      });
      setCreateOpen(false);
      setForm({
        productName: '',
        imageUrl: '',
        flashPrice: 0,
        originalPrice: 0,
        startsAt: '',
        endsAt: '',
        stockTotal: 500,
        shopifyProductId: '',
      });
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create flash sale');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="commerce-promo route-flash-sales">
      <CommerceRegistryBanner />
      {error ? <Alert tone="error">{error}</Alert> : null}

      <CommercePromoHeader
        title="Flash Sales"
        createLabel="+ Create Flash Sale"
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
                  <th>Product</th>
                  <th>Flash Price</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Stock Limit</th>
                  <th>Sold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.length ? (
                  sales.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="commerce-promo__product-cell">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt="" className="commerce-promo__thumb" />
                          ) : (
                            <span
                              className="commerce-promo__thumb commerce-promo__thumb--placeholder"
                              aria-hidden
                            />
                          )}
                          <span className="commerce-promo__name">{s.productName}</span>
                        </div>
                      </td>
                      <td className="commerce-promo__discount">
                        ₹{s.flashPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="commerce-promo__validity">{s.startLabel}</td>
                      <td className="commerce-promo__validity">{s.endLabel}</td>
                      <td>{s.stockTotal.toLocaleString('en-IN')}</td>
                      <td>{s.stockSold.toLocaleString('en-IN')}</td>
                      <td>
                        <FlashSaleStatusCell status={s.status} endsAt={s.endsAt} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="commerce-promo__empty">
                        <EmptyState>No flash sales yet.</EmptyState>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableWrap>
          {pages > 1 ? (
            <div className="commerce-promo__pagination">
              <Btn variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Btn>
              <span className="text-sm text-slate-600">
                Page {page} of {pages}
              </span>
              <Btn variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Btn>
            </div>
          ) : null}
        </div>
      )}

      {createOpen ? (
        <Modal
          title="Create flash sale"
          onClose={() => setCreateOpen(false)}
          onSave={createSale}
          saving={saving}
          wide
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Product name
              <input
                className={inputClass}
                value={form.productName}
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Image URL (optional)
              <input
                className={inputClass}
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Flash price (₹)
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.flashPrice}
                onChange={(e) => setForm((f) => ({ ...f, flashPrice: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Original price (₹)
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.originalPrice}
                onChange={(e) => setForm((f) => ({ ...f, originalPrice: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Stock limit
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.stockTotal}
                onChange={(e) => setForm((f) => ({ ...f, stockTotal: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Shopify product ID (optional)
              <input
                className={inputClass}
                value={form.shopifyProductId}
                onChange={(e) => setForm((f) => ({ ...f, shopifyProductId: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Start time
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              End time
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
