import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, inputClass } from '../Modal';
import { Alert, Btn, Loading } from '../ui';

const base = '/morbeez-staff/api/v1/os/telecaller';

type CatalogItem = {
  productId?: number;
  variantId?: number;
  title: string;
  sku?: string;
  price: number;
};

type CartLine = CatalogItem & {
  selected: boolean;
  qty: number;
  gstPercent: number;
  hsnCode: string;
};

type Props = {
  leadId: string;
  onClose: () => void;
  onCreated: () => void;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CreateEstimateModal({ leadId, onClose, onCreated }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ ok: boolean; items: CatalogItem[] }>(`${base}/orders/catalog`)
      .then((d) => setCatalog(d.items ?? []))
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalog;
    return catalog.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        (c.sku ?? '').toLowerCase().includes(term)
    );
  }, [catalog, search]);

  const selectedLines = useMemo(
    () => Object.values(cart).filter((c) => c.selected && c.qty > 0),
    [cart]
  );

  const subtotal = useMemo(
    () => selectedLines.reduce((s, l) => s + l.qty * l.price * (1 + l.gstPercent / 100), 0),
    [selectedLines]
  );

  const prepaid = Number(prepaidAmount) || 0;
  const codAmount = Math.max(0, subtotal - prepaid);

  function lineKey(item: CatalogItem) {
    return String(item.variantId ?? item.title);
  }

  function toggleItem(item: CatalogItem, checked: boolean) {
    const key = lineKey(item);
    setCart((prev) => {
      const existing = prev[key];
      if (!checked) {
        if (!existing) return prev;
        return { ...prev, [key]: { ...existing, selected: false } };
      }
      return {
        ...prev,
        [key]: {
          ...item,
          selected: true,
          qty: existing?.qty ?? 1,
          gstPercent: existing?.gstPercent ?? 18,
          hsnCode: existing?.hsnCode ?? '382499',
        },
      };
    });
  }

  function setQty(item: CatalogItem, qty: number) {
    const key = lineKey(item);
    setCart((prev) => {
      const row = prev[key];
      if (!row) return prev;
      return { ...prev, [key]: { ...row, qty: Math.max(1, qty) } };
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (!selectedLines.length) throw new Error('Select at least one product');
      await api(`${base}/leads/${leadId}/estimates`, {
        method: 'POST',
        body: JSON.stringify({
          prepaidAmount: prepaid > 0 ? prepaid : 0,
          paymentType: 'advance',
          lines: selectedLines.map((l) => ({
            variantId: l.variantId != null ? Number(l.variantId) : undefined,
            productId: l.productId != null ? Number(l.productId) : undefined,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unitPrice: Number(l.price),
            gstPercent: l.gstPercent,
            hsnCode: l.hsnCode,
          })),
        }),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create quote');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create quote" onClose={onClose} onSave={save} saveLabel="Create quote" saving={saving} wide>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="mb-3 text-sm text-slate-600">
        Farmer details are filled automatically from this lead. Select products below (multi-check, like add to cart).
      </p>
      <div className="quote-catalog-toolbar">
        <input
          className={inputClass}
          style={{ maxWidth: 280 }}
          placeholder="Search products or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="quote-selected-count">{selectedLines.length} selected</span>
      </div>
      {loadingCatalog ? <Loading label="Loading catalog…" /> : null}
      {!loadingCatalog ? (
        <div style={{ maxHeight: 340, overflow: 'auto' }}>
          <table className="quote-items-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Description / SKU</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>GST%</th>
                <th>Amount (incl. GST)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const key = lineKey(item);
                const row = cart[key];
                const selected = Boolean(row?.selected);
                const qty = row?.qty ?? 1;
                const gstPct = row?.gstPercent ?? 18;
                const lineTotal = qty * item.price * (1 + gstPct / 100);
                return (
                  <tr key={key}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => toggleItem(item, e.target.checked)}
                      />
                    </td>
                    <td>
                      <div>{item.title}</div>
                      {item.sku ? <div className="sku">{item.sku}</div> : null}
                      <div className="hsn">HSN: {row?.hsnCode ?? '382499'}</div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        style={{ width: 72 }}
                        disabled={!selected}
                        value={qty}
                        onChange={(e) => setQty(item, Number(e.target.value))}
                      />
                    </td>
                    <td>{formatInr(item.price)}</td>
                    <td>{gstPct}%</td>
                    <td>{selected ? formatInr(lineTotal) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="quote-summary">
        <div className="quote-summary-row">
          <span>Total (incl. GST)</span>
          <span className="quote-summary-total" style={{ border: 0, margin: 0, padding: 0 }}>
            {formatInr(subtotal)}
          </span>
        </div>
        <div className="quote-summary-row">
          <span>Prepaid (optional)</span>
          <input
            type="number"
            min={0}
            className={inputClass}
            style={{ width: 120 }}
            value={prepaidAmount}
            onChange={(e) => setPrepaidAmount(e.target.value)}
          />
        </div>
        <div className="quote-summary-row">
          <span>COD balance</span>
          <strong>{formatInr(codAmount)}</strong>
        </div>
        <p className="mt-2 text-xs text-slate-500">Quote valid for 48 hours.</p>
      </div>
    </Modal>
  );
}
