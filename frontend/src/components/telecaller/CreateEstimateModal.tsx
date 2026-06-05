import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { openQuoteSendLinks } from '../../lib/quoteSend';
import { Modal, inputClass } from '../Modal';
import { Alert, Btn, Loading } from '../ui';

const base = '/morbeez-staff/api/v1/os/telecaller';
const pricingApi = '/morbeez-staff/api/v1/os/pricing';

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
  listedPrice: number;
  price: number;
  qty: number;
  gstPercent: number;
  hsnCode: string;
};

type PricingLinePreview = {
  variantId?: number;
  sku?: string;
  listedPrice: number;
  sellingPrice: number;
  recommendedPrice: number;
  hardFloorPrice: number;
  realizationPct: number;
  incentiveTotal: number;
  warningLevel: 'none' | 'low_margin' | 'critical' | 'blocked';
  warningMessage: string | null;
  allowed: boolean;
};

type PricingPreview = {
  lines: PricingLinePreview[];
  totalIncentive: number;
  avgRealizationPct: number;
  performanceHint: 'excellent' | 'good' | 'warning' | 'critical';
  warnings: string[];
};

type Props = {
  leadId: string;
  estimateId?: string;
  farmerName: string;
  farmerPhone?: string | null;
  farmerDistrict?: string | null;
  farmerState?: string | null;
  onClose: () => void;
  onCreated: () => void;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lineTotal(line: QuoteLine) {
  return line.qty * line.price * (1 + line.gstPercent / 100);
}

function hintLabel(h: PricingPreview['performanceHint']) {
  if (h === 'excellent') return 'Excellent';
  if (h === 'good') return 'Good';
  if (h === 'warning') return 'Warning';
  return 'Critical';
}

function hintClass(h: PricingPreview['performanceHint']) {
  if (h === 'excellent') return 'quote-hint--excellent';
  if (h === 'good') return 'quote-hint--good';
  if (h === 'warning') return 'quote-hint--warning';
  return 'quote-hint--critical';
}

export function CreateEstimateModal({
  leadId,
  estimateId,
  farmerName,
  farmerPhone,
  farmerDistrict,
  farmerState,
  onClose,
  onCreated,
}: Props) {
  const { admin } = useAuth();
  const isEdit = Boolean(estimateId);

  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [orderType, setOrderType] = useState<'standard' | 'bulk'>('standard');
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(isEdit);
  const [error, setError] = useState('');

  const [addSearch, setAddSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [resultsPos, setResultsPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const preparedByName =
    admin?.fullName?.trim() || admin?.email?.split('@')[0]?.trim() || 'Telecaller';

  const farmerLocation = [farmerDistrict, farmerState].filter(Boolean).join(', ');

  useEffect(() => {
    if (!estimateId) return;
    setLoadingQuote(true);
    api<{
      ok: boolean;
      quote: {
        prepaidAmount: number;
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
        setLines(
          (q.lineItems ?? []).map((li, i) => ({
            key: `edit-${i}-${li.variantId ?? li.title}`,
            variantId: li.variantId,
            productId: li.productId,
            title: li.title,
            sku: li.sku,
            listedPrice: li.unitPrice,
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
    if (!lines.length) {
      setPricingPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setPricingLoading(true);
      api<{ ok: boolean; preview: PricingPreview }>(`${pricingApi}/preview`, {
        method: 'POST',
        body: JSON.stringify({
          orderType,
          lines: lines.map((l) => ({
            variantId: l.variantId,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unitPrice: l.price,
            catalogListedPrice: l.listedPrice,
          })),
        }),
      })
        .then((d) => setPricingPreview(d.preview))
        .catch(() => setPricingPreview(null))
        .finally(() => setPricingLoading(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [lines, orderType]);

  useEffect(() => {
    const term = addSearch.trim();
    if (term.length < 2) {
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
  }, [addSearch]);

  useLayoutEffect(() => {
    const input = searchInputRef.current;
    if (!input || searchResults.length === 0) {
      setResultsPos(null);
      return;
    }
    const rect = input.getBoundingClientRect();
    setResultsPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [searchResults, addSearch]);

  useEffect(() => {
    if (!searchResults.length) return;
    function reposition() {
      const input = searchInputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setResultsPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [searchResults.length]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);
  const prepaid = Number(prepaidAmount) || 0;
  const codAmount = Math.max(0, subtotal - prepaid);
  const hasBlocked = pricingPreview?.lines.some((l) => !l.allowed) ?? false;

  const previewByIndex = useMemo(() => pricingPreview?.lines ?? [], [pricingPreview]);

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
      const listed = Number(item.price);
      setLines((prev) => [
        ...prev,
        {
          key: `line-${Date.now()}-${item.variantId ?? item.title}`,
          variantId: item.variantId != null ? Number(item.variantId) : undefined,
          productId: item.productId != null ? Number(item.productId) : undefined,
          title: item.title,
          sku: item.sku,
          listedPrice: listed,
          price: listed,
          qty: 1,
          gstPercent: 18,
          hsnCode: '382499',
        },
      ]);
      setAddSearch('');
      setSearchResults([]);
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
      if (hasBlocked) throw new Error('One or more rates are below the hard floor — adjust pricing');

      const payload = {
        prepaidAmount: prepaid > 0 ? prepaid : 0,
        paymentType: 'advance' as const,
        preparedByName,
        orderType,
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
          <Btn
            variant="primary"
            disabled={saving || loadingQuote || hasBlocked}
            onClick={() => void saveAndSend()}
          >
            {saving ? 'Sending…' : 'Save and Send'}
          </Btn>
        </>
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {pricingPreview?.warnings.length ? (
        <Alert tone="warning">{pricingPreview.warnings.join(' · ')}</Alert>
      ) : null}

      <div className="quote-farmer-banner">
        <div className="quote-farmer-avatar" aria-hidden>
          {farmerName.trim().charAt(0).toUpperCase() || 'F'}
        </div>
        <div className="quote-farmer-info">
          <span className="quote-farmer-label">Quote for</span>
          <strong className="quote-farmer-name">{farmerName}</strong>
          <div className="quote-farmer-meta">
            {farmerPhone ? <span>{farmerPhone}</span> : null}
            {farmerLocation ? <span>{farmerLocation}</span> : null}
          </div>
        </div>
        <label className="quote-order-type">
          <span>Order type</span>
          <select
            className={inputClass}
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as 'standard' | 'bulk')}
          >
            <option value="standard">Standard</option>
            <option value="bulk">Bulk</option>
          </select>
        </label>
      </div>

      {loadingQuote ? <Loading label="Loading quote…" /> : null}

      {!loadingQuote ? (
        <>
          <div className="quote-table-shell">
            <table className="quote-items-table quote-items-table--head">
              <colgroup>
                <col className="quote-col-sno" />
                <col className="quote-col-desc" />
                <col className="quote-col-qty" />
                <col className="quote-col-price" />
                <col className="quote-col-gst" />
                <col className="quote-col-amount" />
                <col className="quote-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Description / SKU</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>GST%</th>
                  <th>Amount (incl. GST)</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
            </table>

            <div className="quote-lines-scroll">
              <table className="quote-items-table quote-items-table--body">
                <colgroup>
                  <col className="quote-col-sno" />
                  <col className="quote-col-desc" />
                  <col className="quote-col-qty" />
                  <col className="quote-col-price" />
                  <col className="quote-col-gst" />
                  <col className="quote-col-amount" />
                  <col className="quote-col-action" />
                </colgroup>
                <tbody>
                  {lines.length === 0 ? (
                    <tr className="quote-empty-hint-row">
                      <td colSpan={7} className="quote-empty-row">
                        No items yet — search below to add products.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, index) => {
                      const p = previewByIndex[index];
                      return (
                        <tr key={line.key} className={p && !p.allowed ? 'quote-row--blocked' : ''}>
                          <td className="quote-sno">{index + 1}</td>
                          <td>
                            <div>{line.title}</div>
                            {line.sku ? <div className="sku">{line.sku}</div> : null}
                            <div className="hsn">HSN: {line.hsnCode}</div>
                            {p ? (
                              <div className="quote-line-pricing">
                                <span>Listed {formatInr(p.listedPrice)}</span>
                                <span>Rec. {formatInr(p.recommendedPrice)}</span>
                                <span>Floor {formatInr(p.hardFloorPrice)}</span>
                              </div>
                            ) : null}
                            {p?.warningMessage ? (
                              <div className={`quote-line-warn quote-line-warn--${p.warningLevel}`}>
                                {p.warningMessage}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              className={`${inputClass} quote-qty-input`}
                              value={line.qty}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  qty: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              className={`${inputClass} quote-price-input`}
                              value={line.price}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  price: Math.max(0.01, Number(e.target.value) || 0.01),
                                })
                              }
                            />
                            {p ? (
                              <div className="quote-line-incentive">
                                {p.realizationPct}% · +{formatInr(p.incentiveTotal)}
                              </div>
                            ) : null}
                          </td>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="quote-table-search-foot" role="row">
              <div className="quote-table-search-sno quote-sno--add" aria-hidden>
                +
              </div>
              <div className="quote-table-search-field">
                <input
                  ref={searchInputRef}
                  className={`${inputClass} quote-table-search-input`}
                  placeholder="Search product name or SKU to add…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                {searching ? <p className="quote-add-hint">Searching…</p> : null}
                {!searching && addSearch.trim().length >= 2 && searchResults.length === 0 ? (
                  <p className="quote-add-hint">No products found</p>
                ) : null}
              </div>
            </div>
          </div>

          {searchResults.length > 0 && resultsPos
            ? createPortal(
                <ul
                  className="quote-add-results quote-add-results--portal"
                  style={{
                    top: resultsPos.top,
                    left: resultsPos.left,
                    width: resultsPos.width,
                  }}
                >
                  {searchResults.map((item) => (
                    <li key={String(item.variantId ?? item.title)}>
                      <button type="button" onClick={() => addProduct(item)}>
                        <span>{item.title}</span>
                        {item.sku ? <small>{item.sku}</small> : null}
                        <strong>{formatInr(Number(item.price))}</strong>
                      </button>
                    </li>
                  ))}
                </ul>,
                document.body
              )
            : null}

          <div className="quote-summary">
            {pricingPreview ? (
              <div className="quote-incentive-strip">
                <span className={`quote-hint-badge ${hintClass(pricingPreview.performanceHint)}`}>
                  {hintLabel(pricingPreview.performanceHint)}
                </span>
                <span>Avg realization {pricingPreview.avgRealizationPct}%</span>
                <strong>Incentive {formatInr(pricingPreview.totalIncentive)}</strong>
                {pricingLoading ? <span className="quote-pricing-loading">Updating…</span> : null}
              </div>
            ) : null}
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
