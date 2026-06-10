import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
function mapRow(row) {
    return {
        id: String(row.id),
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        priority: Number(row.priority ?? 100),
        active: row.active !== false,
    };
}
export const packagingCategoryService = {
    async listAll() {
        const { data, error } = await supabase
            .from('packaging_categories')
            .select('*')
            .order('priority', { ascending: true })
            .order('name');
        throwIfSupabaseError(error, 'List packaging categories');
        return (data ?? []).map((r) => mapRow(r));
    },
    async listActive() {
        const { data, error } = await supabase
            .from('packaging_categories')
            .select('*')
            .eq('active', true)
            .order('priority', { ascending: true });
        throwIfSupabaseError(error, 'List active packaging categories');
        return (data ?? []).map((r) => mapRow(r));
    },
    async getById(id) {
        const { data, error } = await supabase
            .from('packaging_categories')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        throwIfSupabaseError(error, 'Get packaging category');
        if (!data)
            throw new NotFoundError('Packaging category not found');
        return mapRow(data);
    },
    async getGeneralCategory() {
        const { data, error } = await supabase
            .from('packaging_categories')
            .select('*')
            .eq('name', 'General')
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(error, 'Get general packaging category');
        if (!data) {
            const active = await this.listActive();
            if (!active.length)
                throw new NotFoundError('No packaging categories configured');
            return active[0];
        }
        return mapRow(data);
    },
    async create(input) {
        const { data, error } = await supabase
            .from('packaging_categories')
            .insert({
            name: input.name.trim(),
            description: input.description?.trim() ?? null,
            priority: input.priority ?? 100,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create packaging category');
        return mapRow(data);
    },
    async update(id, patch) {
        const row = { updated_at: new Date().toISOString() };
        if (patch.name !== undefined)
            row.name = patch.name.trim();
        if (patch.description !== undefined)
            row.description = patch.description;
        if (patch.priority !== undefined)
            row.priority = patch.priority;
        if (patch.active !== undefined)
            row.active = patch.active;
        const { data, error } = await supabase
            .from('packaging_categories')
            .update(row)
            .eq('id', id)
            .select('*')
            .maybeSingle();
        throwIfSupabaseError(error, 'Update packaging category');
        if (!data)
            throw new NotFoundError('Packaging category not found');
        return mapRow(data);
    },
};
//# sourceMappingURL=packaging-category.service.js.map