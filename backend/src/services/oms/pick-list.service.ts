import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
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

    await inventoryService.releaseOrderAllocations(commerceOrderId, createdBy);

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

        const resolved = await inventoryService.resolveInventoryItemForOrderLine({
          id: String(line.id),
          inventory_item_id: line.inventory_item_id ? String(line.inventory_item_id) : null,
          sku: line.sku ? String(line.sku) : null,
          product_title: String(line.product_title ?? 'Product'),
        });

        if (resolved.available < qty) {
          logger.warn(
            {
              commerceOrderId,
              productTitle: line.product_title,
              need: qty,
              have: resolved.available,
            },
            'Skipping pick line — insufficient warehouse stock'
          );
          continue;
        }

        const allocations = await inventoryService.reserveStock({
          inventoryItemId: resolved.inventoryItemId,
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
            inventory_item_id: resolved.inventoryItemId,
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
        logger.warn(
          { commerceOrderId },
          'Pick list created with no reserved stock — order stays visible in fulfillment queue'
        );
      }
    } catch (err) {
      await cleanupEmptyPickList(String(pickList.id), String(wave.id));
      await inventoryService.releaseOrderAllocations(commerceOrderId, createdBy);
      throw err;
    }

    await supabase
      .from('pick_lists')
      .update({
        status: pickLinesCreated > 0 ? 'picking' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pickList.id);

    return this.getPickList(String(pickList.id));
  },

  async rebuildPickList(pickListId: string, createdBy?: string) {
    const pick = await this.getPickList(pickListId);
    const commerceOrderId = String(pick.commerce_order_id);
    await inventoryService.releaseOrderAllocations(commerceOrderId, createdBy);
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

  async resolveRackLocationForLine(line: {
    allocation_id?: string | null;
    batch_id?: string | null;
  }): Promise<string | null> {
    type LocRow = {
      zone?: string | null;
      rack?: string | null;
      shelf?: string | null;
      bin?: string | null;
      location_code?: string | null;
    };

    const formatLoc = (loc: LocRow | null | undefined) =>
      loc ? warehouseService.formatLocationDisplay(loc) : null;

    if (line.allocation_id) {
      const { data: alloc } = await supabase
        .from('order_line_allocations')
        .select(
          'location_id, batch_id, inventory_batches(location_id, warehouse_locations(zone, rack, shelf, bin, location_code))'
        )
        .eq('id', line.allocation_id)
        .maybeSingle();
      if (alloc) {
        const batchRaw = alloc.inventory_batches as
          | Record<string, unknown>
          | Array<Record<string, unknown>>
          | null;
        const batch = Array.isArray(batchRaw) ? batchRaw[0] ?? null : batchRaw;
        const locRaw = batch?.warehouse_locations as LocRow | LocRow[] | null | undefined;
        const joinedLoc = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw ?? null;
        const fromJoin = formatLoc(joinedLoc);
        if (fromJoin) return fromJoin;

        const locationId =
          (alloc.location_id as string | null) ??
          (batch?.location_id as string | null) ??
          null;
        if (locationId) {
          const { data: loc } = await supabase
            .from('warehouse_locations')
            .select('zone, rack, shelf, bin, location_code')
            .eq('id', locationId)
            .maybeSingle();
          const formatted = formatLoc(loc as LocRow | null);
          if (formatted) return formatted;
        }
      }
    }

    if (line.batch_id) {
      const { data: batch } = await supabase
        .from('inventory_batches')
        .select('location_id, warehouse_locations(zone, rack, shelf, bin, location_code)')
        .eq('id', line.batch_id)
        .maybeSingle();
      const locRaw = batch?.warehouse_locations as LocRow | LocRow[] | null | undefined;
      const joinedLoc = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw ?? null;
      const fromJoin = formatLoc(joinedLoc);
      if (fromJoin) return fromJoin;

      if (batch?.location_id) {
        const { data: loc } = await supabase
          .from('warehouse_locations')
          .select('zone, rack, shelf, bin, location_code')
          .eq('id', batch.location_id)
          .maybeSingle();
        const formatted = formatLoc(loc as LocRow | null);
        if (formatted) return formatted;
      }
    }

    return null;
  },

  async refreshRackLocations(pickListId: string): Promise<number> {
    const { data: lines, error } = await supabase
      .from('pick_list_lines')
      .select('id, rack_location, allocation_id, batch_id, inventory_item_id')
      .eq('pick_list_id', pickListId);
    throwIfSupabaseError(error, 'Pick lines for rack refresh');

    let updated = 0;
    for (const line of lines ?? []) {
      await inventoryService.applyWarehouseLocationToItemBatches(
        String(line.inventory_item_id)
      );

      const rack = await this.resolveRackLocationForLine(line);
      const current = String(line.rack_location ?? '').trim();
      if (!rack || rack === current) continue;

      const { error: updErr } = await supabase
        .from('pick_list_lines')
        .update({
          rack_location: rack,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.id);
      throwIfSupabaseError(updErr, 'Refresh pick line rack');
      updated += 1;
    }
    return updated;
  },
};
