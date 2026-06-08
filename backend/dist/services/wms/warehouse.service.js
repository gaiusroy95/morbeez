import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
export const warehouseService = {
    async listWarehouses() {
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .eq('active', true)
            .order('is_default', { ascending: false });
        throwIfSupabaseError(error, 'List warehouses');
        return data ?? [];
    },
    async getDefaultWarehouse() {
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .eq('active', true)
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle();
        throwIfSupabaseError(error, 'Default warehouse');
        if (!data)
            throw new NotFoundError('No warehouse configured');
        return data;
    },
    async listLocations(warehouseId) {
        const { data, error } = await supabase
            .from('warehouse_locations')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .eq('active', true)
            .order('location_code');
        throwIfSupabaseError(error, 'List locations');
        return data ?? [];
    },
    async createWarehouse(input) {
        const code = input.code.trim().toUpperCase();
        const name = input.name.trim();
        if (!code || !name)
            throw new ValidationError('Warehouse code and name are required');
        const { data, error } = await supabase
            .from('warehouses')
            .insert({
            code,
            name,
            state: input.state?.trim() || env.COMPANY_STATE || 'Karnataka',
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create warehouse');
        return data;
    },
    async updateWarehouse(id, input) {
        const patch = { updated_at: new Date().toISOString() };
        if (input.code !== undefined)
            patch.code = input.code.trim().toUpperCase();
        if (input.name !== undefined)
            patch.name = input.name.trim();
        const { data, error } = await supabase
            .from('warehouses')
            .update(patch)
            .eq('id', id)
            .eq('active', true)
            .select('*')
            .maybeSingle();
        throwIfSupabaseError(error, 'Update warehouse');
        if (!data)
            throw new NotFoundError('Warehouse not found');
        return data;
    },
    async deactivateWarehouse(id) {
        const { data, error } = await supabase
            .from('warehouses')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('id')
            .maybeSingle();
        throwIfSupabaseError(error, 'Deactivate warehouse');
        if (!data)
            throw new NotFoundError('Warehouse not found');
    },
    async createLocation(input) {
        const zone = input.zone ?? 'A';
        const rack = input.rack.trim();
        const shelf = (input.shelf ?? '').trim();
        const bin = (input.bin ?? '').trim();
        if (!rack)
            throw new ValidationError('Rack is required');
        const locationCode = [zone, rack, shelf, bin].filter(Boolean).join('-');
        const { data, error } = await supabase
            .from('warehouse_locations')
            .insert({
            warehouse_id: input.warehouseId,
            zone,
            rack,
            shelf: shelf || null,
            bin: bin || null,
            location_code: locationCode,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create location');
        return data;
    },
    async updateLocation(id, input) {
        const { data: existing, error: loadErr } = await supabase
            .from('warehouse_locations')
            .select('*')
            .eq('id', id)
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(loadErr, 'Load location');
        if (!existing)
            throw new NotFoundError('Location not found');
        const zone = (input.zone ?? existing.zone ?? 'A').trim();
        const rack = (input.rack ?? existing.rack ?? '').trim();
        const shelf = input.shelf !== undefined ? input.shelf.trim() || null : existing.shelf;
        const bin = input.bin !== undefined ? input.bin.trim() || null : existing.bin;
        if (!rack)
            throw new ValidationError('Rack is required');
        const locationCode = [zone, rack, shelf, bin].filter(Boolean).join('-');
        const { data, error } = await supabase
            .from('warehouse_locations')
            .update({
            zone,
            rack,
            shelf,
            bin,
            location_code: locationCode,
        })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Update location');
        return data;
    },
    async deactivateLocation(id) {
        const { data: batches } = await supabase
            .from('inventory_batches')
            .select('qty_on_hand, qty_reserved')
            .eq('location_id', id);
        const hasStock = (batches ?? []).some((b) => (Number(b.qty_on_hand) || 0) + (Number(b.qty_reserved) || 0) > 0);
        if (hasStock) {
            throw new AppError('Cannot remove a location that still has stock', 409, 'LOCATION_IN_USE');
        }
        const { data, error } = await supabase
            .from('warehouse_locations')
            .update({ active: false })
            .eq('id', id)
            .select('id')
            .maybeSingle();
        throwIfSupabaseError(error, 'Deactivate location');
        if (!data)
            throw new NotFoundError('Location not found');
    },
    async renameRack(warehouseId, oldRack, newRack) {
        const nextRack = newRack.trim();
        if (!nextRack)
            throw new ValidationError('Rack name is required');
        const { data: locs, error } = await supabase
            .from('warehouse_locations')
            .select('id, zone, shelf, bin')
            .eq('warehouse_id', warehouseId)
            .eq('rack', oldRack)
            .eq('active', true);
        throwIfSupabaseError(error, 'Load rack locations');
        if (!locs?.length)
            throw new NotFoundError('Rack not found');
        for (const loc of locs) {
            const locationCode = [loc.zone, nextRack, loc.shelf, loc.bin].filter(Boolean).join('-');
            const { error: updErr } = await supabase
                .from('warehouse_locations')
                .update({ rack: nextRack, location_code: locationCode })
                .eq('id', loc.id);
            throwIfSupabaseError(updErr, 'Rename rack');
        }
    },
    async deactivateRack(warehouseId, rack) {
        const { data: locs, error } = await supabase
            .from('warehouse_locations')
            .select('id')
            .eq('warehouse_id', warehouseId)
            .eq('rack', rack)
            .eq('active', true);
        throwIfSupabaseError(error, 'Load rack locations');
        if (!locs?.length)
            throw new NotFoundError('Rack not found');
        for (const loc of locs) {
            await this.deactivateLocation(String(loc.id));
        }
    },
    formatLocationDisplay(loc) {
        if (loc.location_code)
            return loc.location_code;
        return [loc.zone, loc.rack, loc.shelf, loc.bin].filter(Boolean).join('-');
    },
};
//# sourceMappingURL=warehouse.service.js.map