import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
import { warehouseService } from '../wms/warehouse.service.js';

function waveNumber(): string {
  return `WAVE-${Date.now()}`;
}

async function cleanupEmptyPickList(pickListId: string, waveId?: string | null) {
  await supabase.from('pick_list_lines').delete().eq('pick_list_id', pickListId);
  await supabase.from('pick_lists').delete().eq('id', pickListId);
  if (waveId) await supabase.from('pick_waves').delete().eq('id', waveId);
}

export const pickListService = {
  async generateForOrder(commerceOrderId: string, createdBy?: string) {
    const warehouse = await warehouseService.getDefaultWarehouse();

    const { data: existing } = await supabase
      .from('pick_lists')
      .select('id, pick_wave_id')
      .eq('commerce_order_id', commerceOrderId)
      .maybeSingle();
    if (existing) {
      const full = await this.getPickList(String(existing.id));
      const lineCount = Array.isArray(full.pick_list_lines) ? full.pick_list_lines.length : 0;
      if (lineCount > 0) return full;
      await cleanupEmptyPickList(String(existing.id), full.pick_wave_id as string | null);
    }

    const { data: lines, error: lineErr } = await supabase
      .from('commerce_order_lines')
      .select('*')
      .eq('commerce_order_id', commerceOrderId);
    throwIfSupabaseError(lineErr, 'Order lines');
    if (!lines?.length) {
      throw new AppError(
        'Order has no line items — sync order lines from Shopify or the quote first',
        409,
        'NO_ORDER_LINES'
      );
    }

    const { data: wave, error: waveErr } = await supabase
      .from('pick_waves')
      .insert({
        wave_number: waveNumber(),
        warehouse_id: warehouse.id,
        status: 'open',
        created_by: createdBy ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(waveErr, 'Pick wave');

    const { data: pickList, error: plErr } = await supabase
      .from('pick_lists')
      .insert({
        pick_wave_id: wave.id,
        commerce_order_id: commerceOrderId,
        status: 'pending',
      })
      .select('*')
      .single();
    throwIfSupabaseError(plErr, 'Pick list');

    let pickLinesCreated = 0;

    try {
      for (const line of lines) {
        const qty = Number(line.qty_ordered) - Number(line.qty_cancelled);
        if (qty <= 0) continue;
        if (!line.inventory_item_id) {
          throw new AppError(
            `Order line "${line.product_title}" has no inventory SKU — sync order lines first`,
            409,
            'ORDER_LINE_NO_SKU'
          );
        }

        await inventoryService.syncCommerceBatchesToWarehouse(String(line.inventory_item_id));

        const allocations = await inventoryService.reserveStock({
          inventoryItemId: String(line.inventory_item_id),
          warehouseId: String(warehouse.id),
          qty,
          orderLineId: String(line.id),
        });

        for (const alloc of allocations) {
          const a = alloc as Record<string, unknown>;
          await supabase.from('pick_list_lines').insert({
            pick_list_id: pickList.id,
            order_line_id: line.id,
            allocation_id: a.id,
            inventory_item_id: line.inventory_item_id,
            batch_id: a.batch_id,
            location_id: a.location_id,
            product_title: line.product_title,
            sku: line.sku,
            batch_code: a.batchCode,
            rack_location: a.rackLocation,
            qty_required: a.qty_allocated,
          });
          pickLinesCreated += 1;
        }

        await supabase
          .from('commerce_order_lines')
          .update({
            qty_allocated: qty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', line.id);
      }

      if (pickLinesCreated === 0) {
        throw new AppError(
          'No warehouse stock available for this order — receive goods via Purchase & GRN for matching SKUs',
          409,
          'NO_PICK_LINES'
        );
      }
    } catch (err) {
      await cleanupEmptyPickList(String(pickList.id), String(wave.id));
      throw err;
    }

    await supabase
      .from('pick_lists')
      .update({ status: 'picking', updated_at: new Date().toISOString() })
      .eq('id', pickList.id);

    return this.getPickList(String(pickList.id));
  },

  async rebuildPickList(pickListId: string, createdBy?: string) {
    const pick = await this.getPickList(pickListId);
    const commerceOrderId = String(pick.commerce_order_id);
    await cleanupEmptyPickList(pickListId, pick.pick_wave_id as string | null);
    return this.generateForOrder(commerceOrderId, createdBy);
  },

  async getPickList(pickListId: string) {
    const { data, error } = await supabase
      .from('pick_lists')
      .select(
        '*, commerce_orders(order_name, shopify_order_id, oms_status), pick_list_lines(*)'
      )
      .eq('id', pickListId)
      .single();
    throwIfSupabaseError(error, 'Get pick list');
    if (!data) throw new NotFoundError('Pick list not found');
    return data;
  },

  async listPickLists(opts?: { status?: string; limit?: number }) {
    let q = supabase
      .from('pick_lists')
      .select('*, commerce_orders(order_name, shopify_order_id, oms_status, is_cod), pick_list_lines(id)')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50);
    if (opts?.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'List pick lists');
    return data ?? [];
  },

  async markLinePicked(pickListLineId: string, qty?: number) {
    const { data: line, error } = await supabase
      .from('pick_list_lines')
      .select('*')
      .eq('id', pickListLineId)
      .single();
    throwIfSupabaseError(error, 'Pick line');
    if (!line) throw new NotFoundError('Pick line not found');

    const pickQty = qty ?? Number(line.qty_required);
    if (line.allocation_id) {
      await inventoryService.pickAllocation(String(line.allocation_id), pickQty);
    }

    await supabase
      .from('pick_list_lines')
      .update({ qty_picked: pickQty })
      .eq('id', pickListLineId);

    return line;
  },

  async manualVerifyLine(pickListLineId: string) {
    const { data: line, error } = await supabase
      .from('pick_list_lines')
      .select('*')
      .eq('id', pickListLineId)
      .single();
    throwIfSupabaseError(error, 'Pick line verify');
    if (!line) throw new NotFoundError('Pick line not found');

    if (line.allocation_id) {
      await inventoryService.pickAllocation(String(line.allocation_id), Number(line.qty_required));
    }

    await supabase
      .from('pick_list_lines')
      .update({
        manually_verified: true,
        qty_picked: line.qty_required,
      })
      .eq('id', pickListLineId);

    return line;
  },

  async completePicking(pickListId: string) {
    await supabase
      .from('pick_lists')
      .update({
        status: 'picked',
        picked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pickListId);
    return this.getPickList(pickListId);
  },

  async assignPicker(pickListId: string, pickerId: string) {
    const { data, error } = await supabase
      .from('pick_lists')
      .update({
        picker_id: pickerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pickListId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Assign picker');
    return data;
  },
};
