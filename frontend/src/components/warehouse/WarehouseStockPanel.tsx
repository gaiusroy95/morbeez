import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';

type BatchRow = {
  batchCode: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyDamaged: number;
  qtyReturned: number;
  expiryDate: string | null;
  rackLocation: string | null;
};

type StockRow = {
  inventoryItemId: string;
  sku: string;
  productTitle: string;
  available: number;
  reserved: number;
  damaged: number;
  returned: number;
  incoming: number;
  batches: BatchRow[];
};

function mergeStockRow(prev: StockRow[], next: StockRow): StockRow[] {
  const idx = prev.findIndex((r) => r.inventoryItemId === next.inventoryItemId);
  if (idx < 0) return prev;
  const copy = [...prev];
  copy[idx] = next;
  return copy;
}

export function WarehouseStockPanel({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);

  const load = useCallback(async (opts?: { forceSync?: boolean }) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (applied.trim()) params.set('search', applied.trim());
      if (opts?.forceSync) params.set('sync', '1');
      const qs = params.toString();
      const d = await api<{ ok: boolean; stock: StockRow[] }>(
        `${WMS_API}/stock${qs ? `?${qs}` : ''}`
      );
      setRows(d.stock ?? []);
      setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  const loadBatches = useCallback(async (inventoryItemId: string) => {
    setBatchLoading(inventoryItemId);
    setError('');
    try {
      const d = await api<{ ok: boolean; row: StockRow }>(
        `${WMS_API}/stock/${encodeURIComponent(inventoryItemId)}/batches`
      );
      if (d.row) {
        setRows((prev) => mergeStockRow(prev, d.row));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load batch details');
      setExpanded(null);
    } finally {
      setBatchLoading(null);
    }
  }, []);

  const toggleBatches = useCallback(
    (inventoryItemId: string) => {
      if (expanded === inventoryItemId) {
        setExpanded(null);
        return;
      }
      setExpanded(inventoryItemId);
      void loadBatches(inventoryItemId);
    },
    [expanded, loadBatches]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <Panel
      title="Live stock"
      description="Mirrors Commerce → Inventory (catalog + batches). Reserved/damaged reflect warehouse fulfillment."
      actions={
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Search SKU or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setApplied(search)}
          />
          <Btn size="sm" variant="secondary" onClick={() => setApplied(search)}>
            Search
          </Btn>
          <Btn size="sm" variant="secondary" disabled={loading} onClick={() => void load({ forceSync: true })}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Btn>
        </div>
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}
      {!loading && rows.length === 0 ? <EmptyState>No stock records. Receive goods via Purchase & GRN.</EmptyState> : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Damaged</th>
                <th>Incoming</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isExpanded = expanded === r.inventoryItemId;
                const showBatches =
                  r.batches.length > 0 ||
                  r.available > 0 ||
                  r.reserved > 0 ||
                  r.damaged > 0 ||
                  r.returned > 0;

                return (
                  <Fragment key={r.inventoryItemId}>
                    <tr>
                      <td>{r.productTitle}</td>
                      <td className="mono">{r.sku}</td>
                      <td>{r.available}</td>
                      <td>{r.reserved}</td>
                      <td>{r.damaged}</td>
                      <td>{r.incoming}</td>
                      <td>
                        {showBatches ? (
                          <Btn
                            size="sm"
                            variant="secondary"
                            disabled={batchLoading === r.inventoryItemId}
                            onClick={() => toggleBatches(r.inventoryItemId)}
                          >
                            {batchLoading === r.inventoryItemId
                              ? 'Loading…'
                              : isExpanded
                                ? 'Hide'
                                : 'Batches'}
                          </Btn>
                        ) : null}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr key={`${r.inventoryItemId}-b`}>
                        <td colSpan={7}>
                          {batchLoading === r.inventoryItemId ? (
                            <Loading label="Loading batches…" />
                          ) : r.batches.length === 0 ? (
                            <p className="muted text-sm py-2">No active batches for this SKU.</p>
                          ) : (
                            <table className="warehouse-batch-table">
                              <thead>
                                <tr>
                                  <th>Batch</th>
                                  <th>On hand</th>
                                  <th>Reserved</th>
                                  <th>Expiry</th>
                                  <th>Rack</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.batches.map((b) => (
                                  <tr key={b.batchCode}>
                                    <td>{b.batchCode}</td>
                                    <td>{b.qtyOnHand}</td>
                                    <td>{b.qtyReserved}</td>
                                    <td>{b.expiryDate ?? '—'}</td>
                                    <td>{b.rackLocation ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
      {!canWrite ? <p className="muted text-sm mt-3">Read-only — stock changes via GRN and fulfillment.</p> : null}
    </Panel>
  );
}
