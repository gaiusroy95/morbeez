import { supabase } from '../../lib/supabase.js';
import { NotFoundError } from '../../lib/errors.js';
import { computeDap } from '../whatsapp/broadcasts/dap.service.js';
import { plotLocationService } from './plot-location.service.js';
function mapBlock(row) {
    return {
        id: String(row.id),
        farmer_id: String(row.farmer_id),
        name: String(row.name),
        crop_type: String(row.crop_type ?? row.crop_name ?? 'ginger').toLowerCase(),
        crop_name: row.crop_name ? String(row.crop_name) : null,
        crop_category: row.crop_category ? String(row.crop_category) : null,
        crop_subtype: row.crop_subtype ? String(row.crop_subtype) : null,
        plot_label: row.plot_label ? String(row.plot_label) : null,
        planting_date: row.planting_date ? String(row.planting_date).slice(0, 10) : null,
        stage: row.stage ? String(row.stage) : null,
        acreage_decimal: row.acreage_decimal != null ? Number(row.acreage_decimal) : null,
        is_primary: Boolean(row.is_primary),
        pincode_id: row.pincode_id ? String(row.pincode_id) : null,
        irrigation_type: row.irrigation_type ? String(row.irrigation_type) : null,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
        location_captured_at: row.location_captured_at ? String(row.location_captured_at) : null,
        location_source: row.location_source ? String(row.location_source) : null,
        created_at: String(row.created_at),
    };
}
export function blockDisplayName(block) {
    return block.plot_label || block.name || block.crop_name || block.crop_type;
}
export const blockService = {
    computeDap(block) {
        return computeDap(block.planting_date, block.created_at);
    },
    withDap(block) {
        return { ...block, dap: this.computeDap(block) };
    },
    async listByFarmer(farmerId) {
        const { data, error } = await supabase
            .from('farm_blocks')
            .select('*')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });
        if (error)
            throw error;
        return (data ?? []).map((r) => this.withDap(mapBlock(r)));
    },
    async getById(blockId, farmerId) {
        let q = supabase.from('farm_blocks').select('*').eq('id', blockId);
        if (farmerId)
            q = q.eq('farmer_id', farmerId);
        const { data, error } = await q.maybeSingle();
        if (error)
            throw error;
        if (!data)
            return null;
        return this.withDap(mapBlock(data));
    },
    async getPrimaryBlock(farmerId) {
        const { data, error } = await supabase
            .from('farm_blocks')
            .select('*')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (error)
            throw error;
        if (!data)
            return null;
        return this.withDap(mapBlock(data));
    },
    async ensureDefaultBlock(farmerId, cropType = 'ginger') {
        const existing = await this.getPrimaryBlock(farmerId);
        if (existing)
            return existing;
        const { data, error } = await supabase
            .from('farm_blocks')
            .insert({
            farmer_id: farmerId,
            name: `${cropType.charAt(0).toUpperCase()}${cropType.slice(1)} Block`,
            crop_name: cropType,
            crop_type: cropType.toLowerCase(),
            is_primary: true,
            planting_date: null,
        })
            .select('*')
            .single();
        if (error)
            throw error;
        return this.withDap(mapBlock(data));
    },
    async createBlock(farmerId, input) {
        if (input.isPrimary) {
            await supabase
                .from('farm_blocks')
                .update({ is_primary: false })
                .eq('farmer_id', farmerId);
        }
        const { data, error } = await supabase
            .from('farm_blocks')
            .insert({
            farmer_id: farmerId,
            name: input.name,
            crop_name: input.cropType,
            crop_type: input.cropType.toLowerCase(),
            crop_category: input.cropCategory ?? null,
            crop_subtype: input.cropSubtype ?? null,
            variety_name: input.varietyName ?? null,
            planting_date: input.plantingDate ?? new Date().toISOString().slice(0, 10),
            acreage_decimal: input.acreage ?? null,
            irrigation_type: input.irrigationType ?? null,
            pincode_id: input.pincodeId ?? null,
            plot_label: input.plotLabel ?? null,
            is_primary: input.isPrimary ?? false,
            stage: input.stage ?? null,
        })
            .select('*')
            .single();
        if (error)
            throw error;
        return this.withDap(mapBlock(data));
    },
    async updatePlotLocation(blockId, input) {
        await plotLocationService.updateBlockLocation(blockId, {
            latitude: input.latitude,
            longitude: input.longitude,
            source: input.source,
            farmerId: input.farmerId,
        });
        const row = input.farmerId
            ? await this.getById(blockId, input.farmerId)
            : await this.getById(blockId);
        if (!row)
            throw new NotFoundError('Block not found after GPS update');
        return row;
    },
};
//# sourceMappingURL=block.service.js.map