import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { WizardField, pwInputClass, pwSelectClass, pwTextareaClass } from '../WizardField';
import type { WizardVariant } from '../types';

const PRESETS = [0, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30];

type PoolVersion = {
  id: string;
  variantId: string;
  sku: string | null;
  version: string;
  versionNumber: number;
  poolPct: number;
  previousPoolPct: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'pending' | 'active' | 'closed';
  changeReason: string;
  editedBy: string | null;
  editedAt: string;
};

type VariantPool = {
  variantId: string;
  sku: string | null;
  current: PoolVersion | null;
  previous: PoolVersion | null;
  history: PoolVersion[];
};

function indiaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}-${m}-${y}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return formatDate(iso);
  }
}

type Props = {
  productId: string | null;
  productName: string;
  variants: WizardVariant[];
  canView: boolean;
  canEdit: boolean;
};

export function ChannelPoolSection({ productId, productName, variants, canView, canEdit }: Props) {
  const savedVariants = variants.filter((v) => v.id);
  const [pools, setPools] = useState<VariantPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [poolPct, setPoolPct] = useState('16');
  const [effectiveFrom, setEffectiveFrom] = useState(indiaToday);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!productId || !canView) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ ok: boolean; variants: VariantPool[] }>(
        `/morbeez-staff/api/v1/products/${productId}/channel-pool`
      );
      setPools(res.variants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Channel Pool');
    } finally {
      setLoading(false);
    }
  }, [productId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId && savedVariants[0]?.id) {
      setSelectedId(savedVariants[0].id!);
    }
  }, [savedVariants, selectedId]);

  const selectedVariant = savedVariants.find((v) => v.id === selectedId) ?? savedVariants[0];
  const selectedPool = useMemo(
    () => pools.find((p) => p.variantId === selectedVariant?.id) ?? null,
    [pools, selectedVariant]
  );

  useEffect(() => {
    if (selectedPool?.current) {
      setPoolPct(String(selectedPool.current.poolPct));
      setEffectiveFrom(selectedPool.current.effectiveFrom);
    } else {
      setPoolPct('16');
      setEffectiveFrom(indiaToday());
    }
    setReason('');
  }, [selectedPool?.current?.id, selectedVariant?.id]);

  if (!canView) return null;

  if (!productId || !savedVariants.length) {
    return (
      <section className="pw-channel-pool">
        <h3 className="pw-subtitle">Channel Pool</h3>
        <p className="pw-hint">
          Save this product first so each SKU gets an ID. Channel Pool is versioned per SKU and is
          not overwritten.
        </p>
      </section>
    );
  }

  const current = selectedPool?.current ?? null;
  const previous = selectedPool?.previous ?? null;
  const history = selectedPool?.history ?? [];

  async function submit() {
    if (!productId || !selectedVariant?.id) return;
    const pct = Number(poolPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('Channel Pool must be between 0 and 100');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Reason for change is required');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api(`/morbeez-staff/api/v1/products/${productId}/channel-pool`, {
        method: 'POST',
        body: JSON.stringify({
          variantId: selectedVariant.id,
          sku: selectedVariant.sku,
          poolPct: pct,
          effectiveFrom,
          reason: reason.trim(),
        }),
      });
      setConfirmOpen(false);
      setNotice('New Channel Pool version saved. Existing orders and incentives were not changed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save Channel Pool');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pw-channel-pool">
      <h3 className="pw-subtitle">Channel Pool</h3>
      <p className="pw-hint">
        Used for new eligible transactions. Changing the pool creates a new version — historical
        orders keep the snapshot saved on the order.
      </p>

      {savedVariants.length > 1 ? (
        <div className="pw-channel-pool__sku">
          <WizardField label="SKU">
            <select
              className={pwSelectClass()}
              value={selectedVariant?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {savedVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku || `${v.packSize} ${v.unit}`.trim() || v.id}
                </option>
              ))}
            </select>
          </WizardField>
        </div>
      ) : null}

      <div className="pw-channel-pool__current">
        <dl>
          <div>
            <dt>Product</dt>
            <dd>{productName || '—'}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{selectedVariant?.sku || '—'}</dd>
          </div>
          <div>
            <dt>Current Channel Pool</dt>
            <dd className="pw-channel-pool__pct">
              {current ? `${current.poolPct}%` : 'Not set'}
            </dd>
          </div>
          <div>
            <dt>Pool Status</dt>
            <dd>{current ? current.status : '—'}</dd>
          </div>
          <div>
            <dt>Effective From</dt>
            <dd>{formatDate(current?.effectiveFrom)}</dd>
          </div>
          <div>
            <dt>Last Edited Date</dt>
            <dd>{formatDateTime(current?.editedAt)}</dd>
          </div>
          <div>
            <dt>Last Edited By</dt>
            <dd>{current?.editedBy || '—'}</dd>
          </div>
          <div>
            <dt>Pool Version</dt>
            <dd>{current?.version || '—'}</dd>
          </div>
          <div>
            <dt>Previous Pool</dt>
            <dd>{previous ? `${previous.poolPct}%` : '—'}</dd>
          </div>
          <div>
            <dt>Change Reason</dt>
            <dd>{current?.changeReason || '—'}</dd>
          </div>
        </dl>
      </div>

      {canEdit ? (
        <div className="pw-channel-pool__form">
          <h4 className="pw-channel-pool__form-title">Set new version</h4>
          <div className="pw-grid pw-grid--2">
            <WizardField label="Current Channel Pool" required>
              <select
                className={pwSelectClass()}
                value={PRESETS.includes(Number(poolPct)) ? String(Number(poolPct)) : 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setPoolPct('');
                    return;
                  }
                  setPoolPct(e.target.value);
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p} value={String(p)}>
                    {p}%
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </WizardField>
            <WizardField label="Effective From" required>
              <input
                type="date"
                className={pwInputClass()}
                min={indiaToday()}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </WizardField>
          </div>
          {!PRESETS.includes(Number(poolPct)) ? (
            <WizardField label="Custom %">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className={pwInputClass()}
                value={poolPct}
                onChange={(e) => setPoolPct(e.target.value)}
                placeholder="e.g. 15.5"
              />
            </WizardField>
          ) : null}
          <WizardField label="Reason for Change" required>
            <textarea
              className={pwTextareaClass()}
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Management revision"
            />
          </WizardField>
          {error ? (
            <p className="pw-channel-pool__error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="pw-channel-pool__ok">{notice}</p> : null}
          <button
            type="button"
            className="pw-btn pw-btn--primary"
            disabled={saving || loading}
            onClick={() => {
              setError('');
              if (reason.trim().length < 3) {
                setError('Reason for change is required');
                return;
              }
              setConfirmOpen(true);
            }}
          >
            Save Channel Pool
          </button>
        </div>
      ) : (
        <p className="pw-hint">View only — Channel Pool changes are restricted to Admin and Management.</p>
      )}

      <h4 className="pw-channel-pool__form-title">Channel Pool History</h4>
      {loading ? <p className="pw-hint">Loading history…</p> : null}
      {history.length ? (
        <div className="pw-table-card pw-channel-pool__history">
          <table className="pw-variants-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Pool</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Edited By</th>
                <th>Edited Date</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{row.version}</td>
                  <td>{row.poolPct}%</td>
                  <td>{formatDate(row.effectiveFrom)}</td>
                  <td>{formatDate(row.effectiveTo)}</td>
                  <td>{row.editedBy || '—'}</td>
                  <td>{formatDate(row.editedAt)}</td>
                  <td>{row.changeReason}</td>
                  <td className={`pw-channel-pool__status pw-channel-pool__status--${row.status}`}>
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pw-hint">No versions yet for this SKU.</p>
      )}

      {confirmOpen ? (
        <div className="pw-channel-pool__modal" role="dialog" aria-modal="true">
          <div className="pw-channel-pool__modal-card">
            <p>
              Changing Channel Pool will create a new version. Existing orders and historical
              incentives will not be changed.
            </p>
            <div className="pw-channel-pool__modal-actions">
              <button
                type="button"
                className="pw-btn pw-btn--ghost"
                disabled={saving}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pw-btn pw-btn--primary"
                disabled={saving}
                onClick={() => void submit()}
              >
                {saving ? 'Saving…' : 'Create new version'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
