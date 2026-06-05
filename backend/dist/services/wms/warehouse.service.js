import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
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
    async createLocation(input) {
        const zone = input.zone ?? 'A';
        const shelf = input.shelf ?? '';
        const bin = input.bin ?? '';
        const locationCode = [zone, input.rack, shelf, bin].filter(Boolean).join('-');
        const { data, error } = await supabase
            .from('warehouse_locations')
            .insert({
            warehouse_id: input.warehouseId,
            zone,
            rack: input.rack,
            shelf: shelf || null,
            bin: bin || null,
            location_code: locationCode,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create location');
        return data;
    },
    formatLocationDisplay(loc) {
        if (loc.location_code)
            return loc.location_code;
        return [loc.zone, loc.rack, loc.shelf, loc.bin].filter(Boolean).join('-');
    },
};
//# sourceMappingURL=warehouse.service.js.map