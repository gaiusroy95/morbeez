import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { inventoryService } from './inventory.service.js';
import { computeLandedUnitCost, costingService } from '../pricing/costing.service.js';

function nextDocNumber(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${date}-${rand}`;
}

export const purchaseService = {
  async listSuppliers() {
    const { data, error } = await supabase.from('suppliers').select('*').eq('active', true).order('name');
    throwIfSupabaseError(error, 'List suppliers');
    return data ?? [];
  },

  async createSupplier(input: { name: string; contactPhone?: string; contactEmail?: string; gstin?: string }) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: input.name,
        contact_phone: input.contactPhone ?? null,
        contact_email: input.contactEmail ?? null,
        gstin: input.gstin ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Create supplier');
    return data;
  },

  async createPurchaseOrder(input: {
    supplierId?: string;
    warehouseId: string;
    lines: Array<{ inventoryItemId: string; qtyOrdered: number; unitCost?: number }>;
    notes?: string;
    createdBy?: string;
  }) {
    const poNumber = nextDocNumber('PO');
    const { data: po, error } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        supplier_id: input.supplierId ?? null,
        warehouse_id: input.warehouseId,
        status: 'sent',
        notes: input.notes ?? null,
        ordered_at: new Date().toISOString(),
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Create PO');

    const lineRows = input.lines.map((l) => ({
      purchase_order_id: po.id,
      inventory_item_id: l.inventoryItemId,
      qty_ordered: l.qtyOrdered,
      unit_cost: l.unitCost ?? null,
    }));
    const { error: lineErr } = await supabase.from('purchase_order_lines').insert(lineRows);
    throwIfSupabaseError(lineErr, 'PO lines');

    return po;
  },

  async receiveGoods(input: {
    purchaseOrderId?: string;
    warehouseId: string;
    supplierId?: string;
    receivedBy?: string;
    lines: Array<{
      inventoryItemId: string;
      batchCode: string;
      qty: number;
      mfgDate?: string;
      expiryDate?: string;
      locationId?: string;
      supplierCost?: number;
      freightCost?: number;
      customsCost?: number;
      packagingCost?: number;
      miscCost?: number;
    }>;
  }) {
    const grnNumber = nextDocNumber('GRN');
    const { data: grn, error } = await supabase
      .from('goods_receipts')
      .insert({
        grn_number: grnNumber,
        purchase_order_id: input.purchaseOrderId ?? null,
        warehouse_id: input.warehouseId,
        supplier_id: input.supplierId ?? null,
        received_by: input.receivedBy ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Create GRN');

    for (const line of input.lines) {
      const landedUnitCost =
        line.supplierCost != null
          ? computeLandedUnitCost({
              supplierCost: line.supplierCost,
              freightCost: line.freightCost,
              customsCost: line.customsCost,
              packagingCost: line.packagingCost,
              miscCost: line.miscCost,
            })
          : null;

      await inventoryService.createBatchFromGrn({
        inventoryItemId: line.inventoryItemId,
        warehouseId: input.warehouseId,
        locationId: line.locationId ?? null,
        supplierId: input.supplierId ?? null,
        goodsReceiptId: String(grn.id),
        batchCode: line.batchCode,
        mfgDate: line.mfgDate ?? null,
        expiryDate: line.expiryDate ?? null,
        qty: line.qty,
        createdBy: input.receivedBy,
        supplierCost: line.supplierCost ?? null,
        freightCost: line.freightCost,
        customsCost: line.customsCost,
        packagingCost: line.packagingCost,
        miscCost: line.miscCost,
        landedUnitCost,
      });

      if (landedUnitCost != null && landedUnitCost > 0) {
        await costingService.updateWeightedAverageCost(line.inventoryItemId, line.qty, landedUnitCost);
      }

      if (input.purchaseOrderId) {
        const { data: poLine } = await supabase
          .from('purchase_order_lines')
          .select('id, qty_ordered, qty_received')
          .eq('purchase_order_id', input.purchaseOrderId)
          .eq('inventory_item_id', line.inventoryItemId)
          .maybeSingle();

        if (poLine) {
          const received = Number(poLine.qty_received) + line.qty;
          await supabase
            .from('purchase_order_lines')
            .update({ qty_received: received })
            .eq('id', poLine.id);
        }
      }
    }

    if (input.purchaseOrderId) {
      const { data: poLines } = await supabase
        .from('purchase_order_lines')
        .select('qty_ordered, qty_received')
        .eq('purchase_order_id', input.purchaseOrderId);

      const allReceived = (poLines ?? []).every(
        (l) => Number(l.qty_received) >= Number(l.qty_ordered)
      );
      const anyReceived = (poLines ?? []).some((l) => Number(l.qty_received) > 0);

      await supabase
        .from('purchase_orders')
        .update({
          status: allReceived ? 'received' : anyReceived ? 'partial' : 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.purchaseOrderId);
    }

    return grn;
  },

  async listPurchaseOrders(limit = 50) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name), purchase_order_lines(*)')
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'List POs');
    return data ?? [];
  },

  async getPurchaseOrder(id: string) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name), purchase_order_lines(*, inventory_items(sku, product_title))')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error, 'Get PO');
    if (!data) throw new NotFoundError('Purchase order not found');
    return data;
  },
};
