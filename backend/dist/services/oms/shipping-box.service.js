import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
function mapBox(row) {
    return {
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        lengthCm: Number(row.length_cm),
        breadthCm: Number(row.breadth_cm),
        heightCm: Number(row.height_cm),
        maxWeightKg: Number(row.max_weight_kg),
        tareWeightKg: Number(row.tare_weight_kg ?? 0.1),
        liquidFriendly: Boolean(row.liquid_friendly),
        packagingType: row.packaging_type ? String(row.packaging_type) : null,
        sortOrder: Number(row.sort_order ?? 100),
        active: row.active !== false,
    };
}
export const shippingBoxService = {
    async listActive() {
        const { data, error } = await supabase
            .from('shipping_boxes')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true });
        throwIfSupabaseError(error, 'List shipping boxes');
        return (data ?? []).map((row) => mapBox(row));
    },
    async listAll() {
        const { data, error } = await supabase
            .from('shipping_boxes')
            .select('*')
            .order('sort_order', { ascending: true });
        throwIfSupabaseError(error, 'List shipping boxes');
        return (data ?? []).map((row) => mapBox(row));
    },
    async getById(id) {
        const { data, error } = await supabase.from('shipping_boxes').select('*').eq('id', id).maybeSingle();
        throwIfSupabaseError(error, 'Get shipping box');
        if (!data)
            throw new NotFoundError('Shipping box not found');
        return mapBox(data);
    },
    async getByCode(code) {
        const { data, error } = await supabase
            .from('shipping_boxes')
            .select('*')
            .eq('code', code.trim())
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(error, 'Get shipping box by code');
        return data ? mapBox(data) : null;
    },
    async create(input) {
        const { data, error } = await supabase
            .from('shipping_boxes')
            .insert({
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            length_cm: input.lengthCm,
            breadth_cm: input.breadthCm,
            height_cm: input.heightCm,
            max_weight_kg: input.maxWeightKg,
            tare_weight_kg: input.tareWeightKg ?? 0.1,
            liquid_friendly: input.liquidFriendly ?? false,
            packaging_type: input.packagingType ?? (input.liquidFriendly ? 'liquid_safe' : 'standard'),
            sort_order: input.sortOrder ?? 100,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create shipping box');
        return mapBox(data);
    },
    async update(id, patch) {
        const row = { updated_at: new Date().toISOString() };
        if (patch.code !== undefined)
            row.code = patch.code.trim().toUpperCase();
        if (patch.name !== undefined)
            row.name = patch.name.trim();
        if (patch.lengthCm !== undefined)
            row.length_cm = patch.lengthCm;
        if (patch.breadthCm !== undefined)
            row.breadth_cm = patch.breadthCm;
        if (patch.heightCm !== undefined)
            row.height_cm = patch.heightCm;
        if (patch.maxWeightKg !== undefined)
            row.max_weight_kg = patch.maxWeightKg;
        if (patch.tareWeightKg !== undefined)
            row.tare_weight_kg = patch.tareWeightKg;
        if (patch.liquidFriendly !== undefined)
            row.liquid_friendly = patch.liquidFriendly;
        if (patch.packagingType !== undefined)
            row.packaging_type = patch.packagingType;
        if (patch.sortOrder !== undefined)
            row.sort_order = patch.sortOrder;
        if (patch.active !== undefined)
            row.active = patch.active;
        const { data, error } = await supabase
            .from('shipping_boxes')
            .update(row)
            .eq('id', id)
            .select('*')
            .maybeSingle();
        throwIfSupabaseError(error, 'Update shipping box');
        if (!data)
            throw new NotFoundError('Shipping box not found');
        return mapBox(data);
    },
};
//# sourceMappingURL=shipping-box.service.js.map