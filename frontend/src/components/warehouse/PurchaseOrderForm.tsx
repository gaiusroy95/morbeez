import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, DynamicSelect, TableWrap } from '../ui';
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

type Supplier = { id: string; name: string };
type PoLine = { inventoryItemId: string; qtyOrdered: number; unitCost: string };
type OpenPo = {
  id: string;
  po_number: string;
  status: string;
  suppliers?: { name: string } | null;
  purchase_order_lines?: Array<{
    qty_ordered: number;
    qty_received: number;
  }>;
};

const emptyPoLine = (): PoLine => ({
  inventoryItemId: '',
  qtyOrdered: 1,
  unitCost: '',
});

type Props = {
  canWrite: boolean;
  onReceivePo?: (purchaseOrderId: string) => void;
  onCreated?: () => void;
};

export function PurchaseOrderForm({ canWrite, onReceivePo, onCreated }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<WarehouseInventoryItem[]>([]);
  const [openPos, setOpenPos] = useState<OpenPo[]>([]);
  const [location, setLocation] = useState<WarehouseLocationValue>(emptyWarehouseLocation);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<PoLine[]>([emptyPoLine()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [supplierRes, itemRes, poRes] = await Promise.all([
      api<{ ok: boolean; suppliers: Supplier[] }>(`${WMS_API}/suppliers`),
      api<{ ok: boolean; items: Array<{ id: string; sku: string; productTitle: string }> }>(
        `${WMS_API}/inventory-items`
      ),
      api<{ ok: boolean; orders: OpenPo[] }>(`${WMS_API}/purchase-orders`),
    ]);
    setSuppliers(supplierRes.suppliers ?? []);
    setItems(
      (itemRes.items ?? []).map((item) => ({
        inventoryItemId: item.id,
        sku: item.sku,
        productTitle: item.productTitle,
      }))
    );
    setOpenPos(
      (poRes.orders ?? []).filter((po) => po.status === 'sent' || po.status === 'partial')
    );
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load purchase data');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function submitPo() {
    if (!location.warehouseId) {
      setError('Select a warehouse');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const valid = lines.filter((l) => l.inventoryItemId && l.qtyOrdered > 0);
      if (!valid.length) throw new Error('Add at least one PO line');
      await api(`${WMS_API}/purchase-orders`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          warehouseId: location.warehouseId,
          lines: valid.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            qtyOrdered: l.qtyOrdered,
            unitCost: Number(l.unitCost) || undefined,
          })),
        }),
      });
      setSuccess('Purchase order created');
      setLines([emptyPoLine()]);
      await load();
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create purchase order');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="commerce-inventory-add__hint">Loading purchase form…</p>;
  }

  return (
    <div className="warehouse-inbound">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="commerce-inventory-po__fields">
        <DynamicSelect
          label="Supplier"
          placeholder="Select supplier (optional)"
          value={supplierId}
          disabled={!canWrite}
          allowManage={canWrite}
          options={suppliers.map((s) => ({ key: s.id, value: s.id, label: s.name }))}
          addFields={[{ name: 'name', placeholder: 'Supplier name' }]}
          onChange={(id) => setSupplierId(id)}
          onAdd={async (fields) => {
            const name = fields.name?.trim();
            if (!name) return;
            const res = await api<{ ok: boolean; supplier: Supplier }>(`${WMS_API}/suppliers`, {
              method: 'POST',
              body: JSON.stringify({ name }),
            });
            setSuppliers((prev) => [...prev, res.supplier]);
            setSupplierId(res.supplier.id);
          }}
        />
      </div>

      <WarehouseLocationPickers value={location} onChange={setLocation} disabled={!canWrite} />

      <TableWrap>
        <DataTable>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty ordered</th>
              <th>Unit cost ₹</th>
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
                    type="number"
                    min={1}
                    className={inputClass}
                    value={line.qtyOrdered}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, j) =>
                          j === i
                            ? { ...l, qtyOrdered: Math.max(1, Number(e.target.value) || 1) }
                            : l
                        )
                      )
                    }
                    onFocus={(e) => e.target.select()}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={inputClass}
                    placeholder="0"
                    value={line.unitCost}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, unitCost: e.target.value } : l))
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
          <Btn size="sm" variant="secondary" onClick={() => setLines((prev) => [...prev, emptyPoLine()])}>
            Add line
          </Btn>
          <Btn size="sm" onClick={() => void submitPo()} disabled={saving}>
            {saving ? 'Saving…' : 'Create purchase order'}
          </Btn>
        </div>
      ) : null}

      {openPos.length ? (
        <div className="commerce-inventory-po__open">
          <p className="commerce-inventory-add__section-title">Open purchase orders</p>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>PO No.</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Pending lines</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openPos.map((po) => {
                  const pending = (po.purchase_order_lines ?? []).filter(
                    (l) => Number(l.qty_received) < Number(l.qty_ordered)
                  ).length;
                  return (
                    <tr key={po.id}>
                      <td>{po.po_number}</td>
                      <td>{po.suppliers?.name ?? '—'}</td>
                      <td>{po.status}</td>
                      <td>{pending}</td>
                      <td>
                        {canWrite && onReceivePo ? (
                          <Btn size="sm" variant="secondary" onClick={() => onReceivePo(po.id)}>
                            Receive GRN
                          </Btn>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableWrap>
        </div>
      ) : null}
    </div>
  );
}
