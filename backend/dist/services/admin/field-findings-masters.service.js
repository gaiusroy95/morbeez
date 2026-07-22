import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
export const fieldFindingsMastersService = {
    async listIssueMaster(opts) {
        let query = supabase
            .from('issue_master')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .limit(opts?.limit ?? 100);
        if (opts?.category)
            query = query.eq('category', opts.category);
        if (opts?.cropType) {
            const cropLower = opts.cropType.trim().toLowerCase();
            // Global types (null crop) + crop-specific (case-insensitive).
            query = query.or(`crop_type.is.null,crop_type.ilike.${cropLower}`);
        }
        if (opts?.q?.trim()) {
            query = query.ilike('issue_name', `%${opts.q.trim()}%`);
        }
        const { data, error } = await query;
        throwIfSupabaseError(error, 'Could not load issue master');
        return (data ?? []).map((r) => ({
            id: String(r.id),
            category: String(r.category),
            issueName: String(r.issue_name),
            conceptCode: r.concept_code ? String(r.concept_code) : null,
            cropType: r.crop_type ? String(r.crop_type) : null,
        }));
    },
    async createIssueMaster(input) {
        const { data, error } = await supabase
            .from('issue_master')
            .insert({
            category: input.category,
            issue_name: input.issueName.trim(),
            concept_code: input.conceptCode ?? null,
            crop_type: input.cropType ?? null,
            sort_order: input.sortOrder ?? 0,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create issue master');
        return data;
    },
    async deactivateIssueMaster(id) {
        const { data, error } = await supabase
            .from('issue_master')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('id')
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not deactivate issue master');
        if (!data)
            throw new NotFoundError('Issue master entry not found');
        return { ok: true };
    },
    async listMeasurementTemplates(cropType) {
        const crop = cropType.trim().toLowerCase() || '_default';
        const { data, error } = await supabase
            .from('crop_measurement_templates')
            .select('*')
            .eq('active', true)
            .in('crop_type', [crop, '_default'])
            .order('sort_order', { ascending: true });
        throwIfSupabaseError(error, 'Could not load measurement templates');
        const rows = data ?? [];
        const cropSpecific = rows.filter((r) => String(r.crop_type) === crop);
        const defaults = rows.filter((r) => String(r.crop_type) === '_default');
        const merged = cropSpecific.length ? cropSpecific : defaults;
        const seen = new Set();
        return merged
            .filter((r) => {
            const key = String(r.measurement_key);
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        })
            .map((r) => ({
            id: String(r.id),
            cropType: String(r.crop_type),
            measurementKey: String(r.measurement_key),
            labelEn: String(r.label_en),
            labelMl: r.label_ml ? String(r.label_ml) : null,
            unit: r.unit ? String(r.unit) : null,
            inputType: String(r.input_type ?? 'number'),
            options: r.options ?? [],
            required: false,
            sortOrder: Number(r.sort_order ?? 0),
        }));
    },
    async upsertMeasurementTemplate(input) {
        const { data, error } = await supabase
            .from('crop_measurement_templates')
            .upsert({
            crop_type: input.cropType.trim().toLowerCase(),
            measurement_key: input.measurementKey.trim(),
            label_en: input.labelEn.trim(),
            unit: input.unit ?? null,
            input_type: input.inputType ?? 'number',
            sort_order: input.sortOrder ?? 0,
            active: true,
        }, { onConflict: 'crop_type,measurement_key' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save measurement template');
        return data;
    },
};
//# sourceMappingURL=field-findings-masters.service.js.map