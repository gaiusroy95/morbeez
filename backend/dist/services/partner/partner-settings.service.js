import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const partnerSettingsService = {
    async get(key) {
        const { data, error } = await supabase
            .from('partner_program_settings')
            .select('setting_value')
            .eq('setting_key', key)
            .eq('is_active', true)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load partner settings');
        return data?.setting_value ?? {};
    },
    async list() {
        const { data, error } = await supabase
            .from('partner_program_settings')
            .select('*')
            .eq('is_active', true)
            .order('setting_key');
        throwIfSupabaseError(error, 'Could not list partner settings');
        return data ?? [];
    },
    async upsert(key, value, updatedBy) {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('partner_program_settings')
            .upsert({
            setting_key: key,
            setting_value: value,
            updated_by: updatedBy ?? null,
            updated_at: now,
            is_active: true,
        }, { onConflict: 'setting_key' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save partner settings');
        return data;
    },
};
//# sourceMappingURL=partner-settings.service.js.map