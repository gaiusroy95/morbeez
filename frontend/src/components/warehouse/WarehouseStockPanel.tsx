import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';

type StockRow = {
  inventoryItemId: string;
  sku: string;
  productTitle: string;
  available: number;
  reserved: number;
  damaged: number;
  returned: number;
  incoming: number;
  batches: Array<{
    batchCode: string;
    qtyOnHand: number;
    expiryDate: string | null;
    rackLocation: string | null;
  }>;
};

export function WarehouseStockPanel({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = applied.trim() ? `?search=${encodeURIComponent(applied.trim())}` : '';
      const d = await api<{ ok: boolean; stock: StockRow[] }>(`${WMS_API}/stock${params}`);
      setRows(d.stock ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Panel
      title="Live stock"
      description="Available, reserved, damaged, returned — batch and rack level"
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
              {rows.map((r) => (
                <Fragment key={r.inventoryItemId}>
                  <tr>
                    <td>{r.productTitle}</td>
                    <td className="mono">{r.sku}</td>
                    <td>{r.available}</td>
                    <td>{r.reserved}</td>
                    <td>{r.damaged}</td>
                    <td>{r.incoming}</td>
                    <td>
                      {r.batches.length > 0 ? (
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setExpanded(expanded === r.inventoryItemId ? null : r.inventoryItemId)
                          }
                        >
                          Batches
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                  {expanded === r.inventoryItemId ? (
                    <tr key={`${r.inventoryItemId}-b`}>
                      <td colSpan={7}>
                        <table className="warehouse-batch-table">
                          <thead>
                            <tr>
                              <th>Batch</th>
                              <th>Qty</th>
                              <th>Expiry</th>
                              <th>Rack</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.batches.map((b) => (
                              <tr key={b.batchCode}>
                                <td>{b.batchCode}</td>
                                <td>{b.qtyOnHand}</td>
                                <td>{b.expiryDate ?? '—'}</td>
                                <td>{b.rackLocation ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
      {!canWrite ? <p className="muted text-sm mt-3">Read-only — stock changes via GRN and fulfillment.</p> : null}
    </Panel>
  );
}
