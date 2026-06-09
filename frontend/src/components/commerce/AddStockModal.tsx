import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Field, Modal, inputClass } from '../Modal';
import { SearchSelect } from '../ui';

type CommerceStockBatch = {
  id: string;
  batchCode: string;
  mfgDate: string | null;
  expiryDate: string | null;
  qty: number;
};

type VariantDetail = {
  productId: string;
  variantId: string;
  title: string;
  variant: string;
  sku: string;
  barcode: string | null;
  currentStock: number;
  batches: CommerceStockBatch[];
};

type ProductOption = {
  id: string;
  title: string;
  variants: Array<{ id: string; label: string; sku: string }>;
};

type Props = {
  onClose: () => void;
  onSaved: () => void;
  initialVariantId?: string;
};

function formatDateInput(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function defaultBatchCode(sku: string): string {
  const clean = (sku || 'BATCH').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${clean || 'BATCH'}-${stamp}`;
}

export function AddStockModal({ onClose, onSaved, initialVariantId }: Props) {
  const [scanCode, setScanCode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId ?? '');
  const [detail, setDetail] = useState<VariantDetail | null>(null);
  const [batchCode, setBatchCode] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [newStock, setNewStock] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async (variantId: string) => {
    if (!variantId) return;
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; detail: VariantDetail }>(
        `/morbeez-staff/api/v1/inventory/lookup?variantId=${encodeURIComponent(variantId)}`
      );
      setDetail(d.detail);
      setBatchCode((prev) => prev || defaultBatchCode(d.detail.sku));
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : 'Could not load product');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialVariantId) {
      void loadDetail(initialVariantId);
    }
  }, [initialVariantId, loadDetail]);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const d = await api<{
            ok: boolean;
            products: Array<{
              id: string;
              title: string;
              variants: Array<{ id: string; option1?: string; packSize?: string; unit?: string; sku?: string }>;
            }>;
          }>(
            `/morbeez-staff/api/v1/products?search=${encodeURIComponent(productSearch.trim())}&limit=20`
          );
          setProductOptions(
            (d.products ?? []).map((p) => ({
              id: p.id,
              title: p.title,
              variants: (p.variants ?? []).map((v) => ({
                id: v.id,
                label: v.option1 || `${v.packSize || ''} ${v.unit || ''}`.trim() || 'Default',
                sku: v.sku || '',
              })),
            }))
          );
        } catch {
          setProductOptions([]);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const selectedProduct = useMemo(
    () => productOptions.find((p) => p.id === selectedProductId) ?? null,
    [productOptions, selectedProductId]
  );

  const totalBalance = useMemo(() => {
    const current = detail?.currentStock ?? 0;
    const incoming = Number(newStock);
    if (!Number.isFinite(incoming) || incoming <= 0) return current;
    return current + incoming;
  }, [detail?.currentStock, newStock]);

  async function lookupByScan() {
    const code = scanCode.trim();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; detail: VariantDetail }>(
        `/morbeez-staff/api/v1/inventory/lookup?sku=${encodeURIComponent(code)}&barcode=${encodeURIComponent(code)}`
      );
      setDetail(d.detail);
      setSelectedVariantId(d.detail.variantId);
      setSelectedProductId(d.detail.productId);
      setBatchCode(defaultBatchCode(d.detail.sku || code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No product found for that SKU or barcode');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!detail) {
      setError('Select a product variant first');
      return;
    }
    const qty = Number(newStock);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a valid new stock quantity');
      return;
    }
    if (!batchCode.trim()) {
      setError('Batch number is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api('/morbeez-staff/api/v1/inventory/add-stock', {
        method: 'POST',
        body: JSON.stringify({
          variantId: detail.variantId,
          batchCode: batchCode.trim(),
          mfgDate: mfgDate || null,
          expiryDate: expiryDate || null,
          qty,
        }),
      });
      const refreshed = await api<{ ok: boolean; detail: VariantDetail }>(
        `/morbeez-staff/api/v1/inventory/lookup?variantId=${encodeURIComponent(detail.variantId)}`
      );
      setDetail(refreshed.detail);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add stock');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add incoming stock"
      wide
      onClose={onClose}
      onSave={() => void save()}
      saveLabel="Add stock"
      saving={saving}
    >
      <div className="commerce-inventory-add">
        {error ? (
          <p className="commerce-inventory-add__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="commerce-inventory-add__scan-row">
          <Field label="SKU / barcode scan">
            <div className="commerce-inventory-add__scan-wrap">
              <input
                className={inputClass}
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void lookupByScan()}
                placeholder="Scan or type SKU / barcode"
                autoFocus
              />
              <button
                type="button"
                className="commerce-inventory-add__scan-btn"
                onClick={() => void lookupByScan()}
                disabled={loading || !scanCode.trim()}
              >
                Lookup
              </button>
            </div>
          </Field>
        </div>

        <div className="commerce-inventory-add__grid">
          <Field label="Search product">
            <input
              className={inputClass}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Type product name…"
            />
          </Field>
          <Field label="Product">
            <SearchSelect
              className={inputClass}
              value={selectedProductId}
              onChange={(value) => {
                setSelectedProductId(value);
                setSelectedVariantId('');
                setDetail(null);
              }}
              options={[
                { value: '', label: 'Select product' },
                ...productOptions.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          </Field>
          <Field label="Variant">
            <SearchSelect
              className={inputClass}
              value={selectedVariantId}
              disabled={!selectedProduct}
              onChange={(id) => {
                setSelectedVariantId(id);
                if (id) void loadDetail(id);
              }}
              options={[
                { value: '', label: 'Select variant' },
                ...(selectedProduct?.variants ?? []).map((v) => ({
                  value: v.id,
                  label: `${v.label}${v.sku ? ` · ${v.sku}` : ''}`,
                })),
              ]}
            />
          </Field>
        </div>

        {loading ? <p className="commerce-inventory-add__hint">Loading product…</p> : null}

        {detail ? (
          <>
            <div className="commerce-inventory-add__summary">
              <div>
                <span className="commerce-inventory-add__summary-label">Product</span>
                <strong>{detail.title}</strong>
              </div>
              <div>
                <span className="commerce-inventory-add__summary-label">Variant</span>
                <strong>{detail.variant}</strong>
              </div>
              <div>
                <span className="commerce-inventory-add__summary-label">SKU</span>
                <strong>{detail.sku || '—'}</strong>
              </div>
              <div>
                <span className="commerce-inventory-add__summary-label">Barcode</span>
                <strong>{detail.barcode || '—'}</strong>
              </div>
              <div>
                <span className="commerce-inventory-add__summary-label">Current stock</span>
                <strong>{detail.currentStock.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {detail.batches.length ? (
              <div className="commerce-inventory-add__batches">
                <p className="commerce-inventory-add__section-title">Existing batches</p>
                <table className="commerce-inventory-add__batch-table">
                  <thead>
                    <tr>
                      <th>Batch No.</th>
                      <th>Batch date</th>
                      <th>Expiry</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.batches.map((b) => (
                      <tr key={b.id}>
                        <td>{b.batchCode}</td>
                        <td>{formatDateInput(b.mfgDate)}</td>
                        <td>{formatDateInput(b.expiryDate)}</td>
                        <td>{b.qty.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="commerce-inventory-add__hint">No saved batches yet for this variant.</p>
            )}

            <div className="commerce-inventory-add__grid">
              <Field label="New stock">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  step={1}
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder="Units to add"
                />
              </Field>
              <Field label="Batch No.">
                <input
                  className={inputClass}
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  placeholder="Batch number"
                />
              </Field>
              <Field label="Batch date">
                <input
                  className={inputClass}
                  type="date"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                />
              </Field>
              <Field label="Expiry date">
                <input
                  className={inputClass}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </Field>
            </div>

            <div className="commerce-inventory-add__balance">
              <span>Total balance after receipt</span>
              <strong>{totalBalance.toLocaleString('en-IN')} units</strong>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
