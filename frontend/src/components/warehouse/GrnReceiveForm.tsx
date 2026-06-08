import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';
import {
  WarehouseLocationPickers,
  emptyWarehouseLocation,
  type WarehouseLocationValue,
} from './WarehouseLocationPickers';
import {
  WarehouseProductPicker,
  type WarehouseInventoryItem,
} from './WarehouseProductPicker';

export type GrnLine = {
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

export const emptyGrnLine = (): GrnLine => ({
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

type PurchaseOrderDetail = {
  id: string;
  warehouse_id: string;
  supplier_id: string | null;
  purchase_order_lines: Array<{
    inventory_item_id: string;
    qty_ordered: number;
    qty_received: number;
    unit_cost: number | null;
    inventory_items?: { sku: string; product_title: string } | null;
  }>;
};

type Props = {
  canWrite: boolean;
  purchaseOrderId?: string;
  onSuccess?: () => void;
};

export function GrnReceiveForm({ canWrite, purchaseOrderId, onSuccess }: Props) {
  const [items, setItems] = useState<WarehouseInventoryItem[]>([]);
  const [location, setLocation] = useState<WarehouseLocationValue>(emptyWarehouseLocation);
  const [lines, setLines] = useState<GrnLine[]>([emptyGrnLine()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkedPo, setLinkedPo] = useState<PurchaseOrderDetail | null>(null);

  const loadItems = useCallback(async () => {
    const res = await api<{
      ok: boolean;
      items: Array<{ id: string; sku: string; productTitle: string }>;
    }>(`${WMS_API}/inventory-items`);
    setItems(
      (res.items ?? []).map((item) => ({
        inventoryItemId: item.id,
        sku: item.sku,
        productTitle: item.productTitle,
      }))
    );
  }, []);

  const loadPurchaseOrder = useCallback(async (poId: string) => {
    const res = await api<{ ok: boolean; purchaseOrder: PurchaseOrderDetail }>(
      `${WMS_API}/purchase-orders/${poId}`
    );
    const po = res.purchaseOrder;
    setLinkedPo(po);
    setLocation((prev) => ({ ...prev, warehouseId: po.warehouse_id }));

    const pending = (po.purchase_order_lines ?? [])
      .map((line) => {
        const remaining = Math.max(
          0,
          Number(line.qty_ordered) - Number(line.qty_received)
        );
        if (remaining <= 0) return null;
        const sku = line.inventory_items?.sku ?? '';
        return {
          inventoryItemId: line.inventory_item_id,
          batchCode: sku ? `${sku.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)}` : '',
          qty: remaining,
          expiryDate: '',
          mfgDate: '',
          supplierCost: line.unit_cost != null ? String(line.unit_cost) : '',
          freightCost: '',
          customsCost: '',
          packagingCost: '',
          miscCost: '',
        } satisfies GrnLine;
      })
      .filter((line): line is GrnLine => line != null);

    setLines(pending.length ? pending : [emptyGrnLine()]);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        await loadItems();
        if (purchaseOrderId) {
          await loadPurchaseOrder(purchaseOrderId);
        } else {
          setLinkedPo(null);
          setLines([emptyGrnLine()]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [purchaseOrderId, loadItems, loadPurchaseOrder]);

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
          purchaseOrderId: purchaseOrderId || undefined,
          warehouseId: location.warehouseId,
          supplierId: linkedPo?.supplier_id || undefined,
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
      setSuccess('Goods received — warehouse stock & cost updated');
      setLines([emptyGrnLine()]);
      setLinkedPo(null);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GRN failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="commerce-inventory-add__hint">Loading receive form…</p>;
  }

  return (
    <div className="warehouse-inbound">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {purchaseOrderId ? (
        <p className="commerce-inventory-add__hint">
          Receiving against purchase order. Pending lines are pre-filled.
        </p>
      ) : null}

      <WarehouseLocationPickers value={location} onChange={setLocation} disabled={!canWrite} />
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
                <td className="warehouse-product-cell">
                  <WarehouseProductPicker
                    compact
                    value={line.inventoryItemId}
                    items={items}
                    onItemsChange={setItems}
                    disabled={!canWrite}
                    allowManage={canWrite}
                    onChange={(id) => {
                      setLines((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, inventoryItemId: id } : l))
                      );
                    }}
                  />
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
                    min={1}
                    className={inputClass}
                    value={line.qty}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, j) =>
                          j === i ? { ...l, qty: Math.max(1, Number(e.target.value) || 1) } : l
                        )
                      )
                    }
                    onFocus={(e) => e.target.select()}
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
          <Btn size="sm" variant="secondary" onClick={() => setLines((prev) => [...prev, emptyGrnLine()])}>
            Add line
          </Btn>
          <Btn size="sm" onClick={() => void submitGrn()} disabled={saving}>
            {saving ? 'Saving…' : 'Receive stock'}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}
