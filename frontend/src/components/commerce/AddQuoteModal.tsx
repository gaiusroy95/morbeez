import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Field, Modal, inputClass } from '../Modal';
import { Alert, Btn, Loading } from '../ui';

type CatalogItem = {
  productId?: number;
  variantId?: number;
  title: string;
  sku?: string;
  price: number;
  stock?: number;
};

type CartLine = CatalogItem & {
  selected: boolean;
  qty: number;
  gstPercent: number;
  hsnCode: string;
};

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AddQuoteModal({ onClose, onCreated }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerState, setCustomerState] = useState('Karnataka');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ ok: boolean; items: CatalogItem[] }>('/morbeez-staff/api/v1/quotes/catalog')
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
    () => selectedLines.reduce((s, l) => s + l.qty * l.price, 0),
    [selectedLines]
  );

  const gstEstimate = useMemo(() => subtotal * 0.18, [subtotal]);
  const totalInclGst = useMemo(() => subtotal + gstEstimate, [subtotal, gstEstimate]);

  const prepaid = Number(prepaidAmount) || 0;
  const codAmount = Math.max(0, totalInclGst - prepaid);

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
      if (!customerName.trim()) throw new Error('Customer name is required');
      if (!selectedLines.length) throw new Error('Select at least one product');

      await api('/morbeez-staff/api/v1/quotes', {
        method: 'POST',
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          customerState: customerState.trim(),
          paymentType: prepaid > 0 ? 'advance' : 'advance',
          prepaidAmount: prepaid > 0 ? prepaid : 0,
          shippingAddress: {
            address: address.trim() || undefined,
            address1: address.trim() || undefined,
            city: city.trim() || undefined,
            state: customerState.trim(),
            pincode: pincode.trim() || undefined,
          },
          lines: selectedLines.map((l) => ({
            variantId: l.variantId,
            productId: l.productId,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unitPrice: l.price,
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
    <Modal title="New quote" onClose={onClose} onSave={save} saveLabel="Create quote" saving={saving} wide>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name">
            <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={customerState} onChange={(e) => setCustomerState(e.target.value)} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Pincode">
            <input className={inputClass} value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </Field>
        </div>

        <div>
          <h4 className="mb-2 font-semibold text-slate-800">Items — multi-select (like add to cart)</h4>
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
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
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
                    const lineBase = qty * item.price;
                    const lineTotal = lineBase * (1 + gstPct / 100);
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
        </div>

        <div className="quote-summary">
          <div className="quote-summary-row">
            <span>Subtotal</span>
            <span>{formatInr(subtotal)}</span>
          </div>
          <div className="quote-summary-row">
            <span>Total Amount (incl. GST)</span>
            <span className="quote-summary-total" style={{ border: 0, margin: 0, padding: 0 }}>
              {formatInr(totalInclGst)}
            </span>
          </div>
          <div className="quote-summary-row">
            <span>Payment type</span>
            <span>Advance</span>
          </div>
          <div className="quote-summary-row">
            <span>Prepaid amount (optional)</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              style={{ width: 120 }}
              value={prepaidAmount}
              onChange={(e) => setPrepaidAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="quote-summary-row">
            <span>COD amount</span>
            <strong>{formatInr(codAmount)}</strong>
          </div>
          <p className="mt-2 text-xs text-slate-500">Quote expires in 48 hours if unpaid.</p>
        </div>
      </div>
    </Modal>
  );
}
