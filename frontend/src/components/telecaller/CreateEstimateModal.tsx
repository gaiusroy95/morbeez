import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Modal, Field, inputClass } from '../Modal';
import { Alert, Btn, Loading } from '../ui';

const base = '/morbeez-staff/api/v1/os/telecaller';

type CatalogItem = {
  productId?: number;
  variantId?: number;
  title: string;
  sku?: string;
  price: number;
};

type QuoteLine = {
  key: string;
  variantId?: number;
  productId?: number;
  title: string;
  sku?: string;
  price: number;
  qty: number;
  gstPercent: number;
  hsnCode: string;
};

type Props = {
  leadId: string;
  estimateId?: string;
  onClose: () => void;
  onCreated: () => void;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lineTotal(line: QuoteLine) {
  return line.qty * line.price * (1 + line.gstPercent / 100);
}

import { openQuoteSendLinks } from '../../lib/quoteSend';

export function CreateEstimateModal({ leadId, estimateId, onClose, onCreated }: Props) {
  const { admin } = useAuth();
  const isEdit = Boolean(estimateId);

  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(isEdit);
  const [error, setError] = useState('');

  const [showAddSearch, setShowAddSearch] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const name = admin?.fullName?.trim() || admin?.email?.split('@')[0] || '';
    setPreparedBy(name);
  }, [admin]);

  useEffect(() => {
    if (!estimateId) return;
    setLoadingQuote(true);
    api<{
      ok: boolean;
      quote: {
        prepaidAmount: number;
        preparedByName: string | null;
        lineItems: Array<{
          variantId?: number;
          productId?: number;
          title: string;
          sku?: string;
          qty: number;
          unitPrice: number;
          gstPercent: number;
          hsnCode?: string;
        }>;
      };
    }>(`${base}/leads/${leadId}/estimates/${estimateId}`)
      .then((d) => {
        const q = d.quote;
        setPrepaidAmount(q.prepaidAmount > 0 ? String(q.prepaidAmount) : '');
        if (q.preparedByName) setPreparedBy(q.preparedByName);
        setLines(
          (q.lineItems ?? []).map((li, i) => ({
            key: `edit-${i}-${li.variantId ?? li.title}`,
            variantId: li.variantId,
            productId: li.productId,
            title: li.title,
            sku: li.sku,
            price: li.unitPrice,
            qty: li.qty,
            gstPercent: li.gstPercent ?? 18,
            hsnCode: li.hsnCode ?? '382499',
          }))
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load quote'))
      .finally(() => setLoadingQuote(false));
  }, [estimateId, leadId]);

  useEffect(() => {
    const term = addSearch.trim();
    if (!showAddSearch || term.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      api<{ ok: boolean; items: CatalogItem[] }>(
        `${base}/orders/catalog?search=${encodeURIComponent(term)}`
      )
        .then((d) => setSearchResults(d.items ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [addSearch, showAddSearch]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);
  const prepaid = Number(prepaidAmount) || 0;
  const codAmount = Math.max(0, subtotal - prepaid);

  const existingVariantIds = useMemo(
    () => new Set(lines.map((l) => l.variantId).filter(Boolean)),
    [lines]
  );

  const addProduct = useCallback(
    (item: CatalogItem) => {
      if (item.variantId && existingVariantIds.has(item.variantId)) {
        setError('This product is already in the quote');
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          key: `line-${Date.now()}-${item.variantId ?? item.title}`,
          variantId: item.variantId != null ? Number(item.variantId) : undefined,
          productId: item.productId != null ? Number(item.productId) : undefined,
          title: item.title,
          sku: item.sku,
          price: Number(item.price),
          qty: 1,
          gstPercent: 18,
          hsnCode: '382499',
        },
      ]);
      setAddSearch('');
      setSearchResults([]);
      setShowAddSearch(false);
      setError('');
    },
    [existingVariantIds]
  );

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function saveAndSend() {
    setSaving(true);
    setError('');
    try {
      if (!lines.length) throw new Error('Add at least one product');
      if (!preparedBy.trim()) throw new Error('Prepared by is required');

      const payload = {
        prepaidAmount: prepaid > 0 ? prepaid : 0,
        paymentType: 'advance' as const,
        preparedByName: preparedBy.trim(),
        send: true,
        sendChannels: ['whatsapp', 'email'] as const,
        lines: lines.map((l) => ({
          variantId: l.variantId,
          productId: l.productId,
          sku: l.sku,
          title: l.title,
          qty: l.qty,
          unitPrice: Number(l.price),
          gstPercent: l.gstPercent,
          hsnCode: l.hsnCode,
        })),
      };

      const res = await api<{
        ok: boolean;
        send?: { whatsappUrl?: string | null; mailtoUrl?: string | null; whatsappSent?: boolean };
      }>(
        isEdit
          ? `${base}/leads/${leadId}/estimates/${estimateId}`
          : `${base}/leads/${leadId}/estimates`,
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (res.send) openQuoteSendLinks(res.send);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save quote');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit quote' : 'Create quote'}
      onClose={onClose}
      wide
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={saving || loadingQuote} onClick={() => void saveAndSend()}>
            {saving ? 'Sending…' : 'Save and Send'}
          </Btn>
        </>
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="mb-3 text-sm text-slate-600">
        Farmer details are filled automatically from this lead. Use <strong>Add item</strong> to search
        and add products one at a time.
      </p>

      <Field label="Prepared by">
        <input
          className={inputClass}
          value={preparedBy}
          onChange={(e) => setPreparedBy(e.target.value)}
          placeholder="Your name"
        />
      </Field>

      {loadingQuote ? <Loading label="Loading quote…" /> : null}

      {!loadingQuote ? (
        <>
          <div className="quote-lines-toolbar">
            <button
              type="button"
              className="quote-add-btn"
              onClick={() => {
                setShowAddSearch(true);
                setAddSearch('');
                setSearchResults([]);
              }}
            >
              + Add item
            </button>
          </div>

          {showAddSearch ? (
            <div className="quote-add-search">
              <input
                className={inputClass}
                autoFocus
                placeholder="Search product name or SKU…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
              />
              {searching ? <p className="quote-add-hint">Searching…</p> : null}
              {!searching && addSearch.trim().length >= 2 && searchResults.length === 0 ? (
                <p className="quote-add-hint">No products found</p>
              ) : null}
              {searchResults.length > 0 ? (
                <ul className="quote-add-results">
                  {searchResults.map((item) => (
                    <li key={String(item.variantId ?? item.title)}>
                      <button type="button" onClick={() => addProduct(item)}>
                        <span>{item.title}</span>
                        {item.sku ? <small>{item.sku}</small> : null}
                        <strong>{formatInr(Number(item.price))}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="quote-add-cancel"
                onClick={() => {
                  setShowAddSearch(false);
                  setAddSearch('');
                  setSearchResults([]);
                }}
              >
                Cancel search
              </button>
            </div>
          ) : null}

          <div className="quote-lines-wrap">
            <table className="quote-items-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>S.No</th>
                  <th>Description / SKU</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>GST%</th>
                  <th>Amount (incl. GST)</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="quote-empty-row">
                      No items yet — click <strong>Add item</strong> to search and add products.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => (
                    <tr key={line.key}>
                      <td className="quote-sno">{index + 1}</td>
                      <td>
                        <div>{line.title}</div>
                        {line.sku ? <div className="sku">{line.sku}</div> : null}
                        <div className="hsn">HSN: {line.hsnCode}</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          style={{ width: 72 }}
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(line.key, { qty: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </td>
                      <td>{formatInr(line.price)}</td>
                      <td>{line.gstPercent}%</td>
                      <td>{formatInr(lineTotal(line))}</td>
                      <td>
                        <button
                          type="button"
                          className="quote-remove-btn"
                          title="Remove"
                          onClick={() => removeLine(line.key)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
        </>
      ) : null}
    </Modal>
  );
}
