import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, Loading, Panel, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';
import {
  WarehouseLocationPickers,
  emptyWarehouseLocation,
  type WarehouseLocationValue,
} from './WarehouseLocationPickers';

type StockRow = { inventoryItemId: string; sku: string; productTitle: string };

type GrnLine = {
  inventoryItemId: string;
  batchCode: string;
  qty: number;
  expiryDate: string;
  mfgDate: string;
  supplierCost: string;
  freightCost: string;
  customsCost: string;
  packagingCost: string;
  miscCost: string;
};

function landedCost(line: GrnLine): number {
  const supplier = Number(line.supplierCost) || 0;
  const freight = Number(line.freightCost) || 0;
  const customs = Number(line.customsCost) || 0;
  const packaging = Number(line.packagingCost) || 0;
  const misc = Number(line.miscCost) || 0;
  return Math.round((supplier + freight + customs + packaging + misc) * 100) / 100;
}

const emptyGrnLine = (): GrnLine => ({
  inventoryItemId: '',
  batchCode: '',
  qty: 1,
  expiryDate: '',
  mfgDate: '',
  supplierCost: '',
  freightCost: '',
  customsCost: '',
  packagingCost: '',
  miscCost: '',
});

export function WarehouseInboundPanel({ canWrite }: { canWrite: boolean }) {
  const [items, setItems] = useState<StockRow[]>([]);
  const [location, setLocation] = useState<WarehouseLocationValue>(emptyWarehouseLocation);
  const [lines, setLines] = useState<GrnLine[]>([emptyGrnLine()]);
  const [newSku, setNewSku] = useState({ sku: '', title: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stock = await api<{ ok: boolean; stock: StockRow[] }>(`${WMS_API}/stock`);
      setItems(stock.stock ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSku() {
    if (!newSku.sku.trim() || !newSku.title.trim()) return;
    setError('');
    try {
      const d = await api<{ ok: boolean; item: { id: string; sku: string; product_title: string } }>(
        `${WMS_API}/inventory-items`,
        {
          method: 'POST',
          body: JSON.stringify({
            sku: newSku.sku.trim(),
            productTitle: newSku.title.trim(),
          }),
        }
      );
      setItems((prev) => [
        ...prev,
        {
          inventoryItemId: d.item.id,
          sku: d.item.sku,
          productTitle: d.item.product_title,
        },
      ]);
      setNewSku({ sku: '', title: '' });
      setSuccess('SKU added');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add SKU');
    }
  }

  async function submitGrn() {
    if (!location.warehouseId) {
      setError('Select a warehouse');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const valid = lines.filter((l) => l.inventoryItemId && l.batchCode && l.qty > 0);
      if (!valid.length) throw new Error('Add at least one GRN line');
      await api(`${WMS_API}/goods-receipts`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: location.warehouseId,
          lines: valid.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            batchCode: l.batchCode,
            qty: l.qty,
            expiryDate: l.expiryDate || undefined,
            mfgDate: l.mfgDate || undefined,
            locationId: location.locationId || undefined,
            supplierCost: Number(l.supplierCost) || undefined,
            freightCost: Number(l.freightCost) || undefined,
            customsCost: Number(l.customsCost) || undefined,
            packagingCost: Number(l.packagingCost) || undefined,
            miscCost: Number(l.miscCost) || undefined,
          })),
        }),
      });
      setSuccess('Goods received — stock & weighted cost updated');
      setLines([emptyGrnLine()]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GRN failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading inbound…" />;

  return (
    <div className="warehouse-inbound">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      {canWrite ? (
        <Panel title="Add SKU" description="Register a product before first GRN">
          <div className="warehouse-form-row">
            <input
              className={inputClass}
              placeholder="SKU"
              value={newSku.sku}
              onChange={(e) => setNewSku((s) => ({ ...s, sku: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Product title"
              value={newSku.title}
              onChange={(e) => setNewSku((s) => ({ ...s, title: e.target.value }))}
            />
            <Btn size="sm" onClick={() => void addSku()}>
              Add SKU
            </Btn>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Goods received (GRN)"
        description="Purchase → landed cost → weighted average → safe price recalculation"
      >
        <WarehouseLocationPickers
          value={location}
          onChange={setLocation}
          disabled={!canWrite}
        />
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Supplier ₹</th>
                <th>Freight</th>
                <th>Customs</th>
                <th>Pack</th>
                <th>Misc</th>
                <th>Landed</th>
                <th>MFG</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    <select
                      className={inputClass}
                      value={line.inventoryItemId}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((prev) => prev.map((l, j) => (j === i ? { ...l, inventoryItemId: v } : l)));
                      }}
                    >
                      <option value="">Select…</option>
                      {items.map((it) => (
                        <option key={it.inventoryItemId} value={it.inventoryItemId}>
                          {it.productTitle} ({it.sku})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={inputClass}
                      value={line.batchCode}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, batchCode: e.target.value } : l))
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={inputClass}
                      value={line.qty}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, qty: Number(e.target.value) } : l))
                        )
                      }
                    />
                  </td>
                  {(['supplierCost', 'freightCost', 'customsCost', 'packagingCost', 'miscCost'] as const).map(
                    (field) => (
                      <td key={field}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className={inputClass}
                          placeholder="0"
                          value={line[field]}
                          disabled={!canWrite}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, j) => (j === i ? { ...l, [field]: e.target.value } : l))
                            )
                          }
                        />
                      </td>
                    )
                  )}
                  <td className="warehouse-landed-cell">₹{landedCost(line).toFixed(2)}</td>
                  <td>
                    <input
                      type="date"
                      className={inputClass}
                      value={line.mfgDate}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, mfgDate: e.target.value } : l))
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className={inputClass}
                      value={line.expiryDate}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, expiryDate: e.target.value } : l))
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
        {canWrite ? (
          <div className="flex gap-2 mt-4">
            <Btn
              size="sm"
              variant="secondary"
              onClick={() => setLines((prev) => [...prev, emptyGrnLine()])}
            >
              Add line
            </Btn>
            <Btn size="sm" onClick={() => void submitGrn()} disabled={saving}>
              {saving ? 'Saving…' : 'Receive stock'}
            </Btn>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
