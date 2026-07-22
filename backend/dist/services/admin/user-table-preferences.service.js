import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
function mapRow(row) {
    return {
        userEmail: String(row.user_email),
        tableName: String(row.table_name),
        viewName: String(row.view_name),
        visibleColumns: Array.isArray(row.visible_columns) ? row.visible_columns : [],
        columnOrder: Array.isArray(row.column_order) ? row.column_order : [],
        columnWidths: row.column_widths && typeof row.column_widths === 'object'
            ? row.column_widths
            : {},
        filterState: row.filter_state && typeof row.filter_state === 'object'
            ? row.filter_state
            : {},
        updatedAt: String(row.updated_at),
    };
}
export const userTablePreferencesService = {
    async get(userEmail, tableName, viewName = 'active') {
        const { data, error } = await supabase
            .from('user_table_preferences')
            .select('*')
            .eq('user_email', userEmail)
            .eq('table_name', tableName)
            .eq('view_name', viewName)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load table preferences');
        return data ? mapRow(data) : null;
    },
    async listViews(userEmail, tableName) {
        const { data, error } = await supabase
            .from('user_table_preferences')
            .select('view_name, updated_at')
            .eq('user_email', userEmail)
            .eq('table_name', tableName)
            .order('view_name');
        throwIfSupabaseError(error, 'Could not list saved views');
        return (data ?? []).map((row) => ({
            viewName: String(row.view_name),
            updatedAt: String(row.updated_at),
        }));
    },
    async upsert(userEmail, tableName, input) {
        const viewName = input.viewName ?? 'active';
        const payload = {
            user_email: userEmail,
            table_name: tableName,
            view_name: viewName,
            visible_columns: input.visibleColumns ?? [],
            column_order: input.columnOrder ?? [],
            column_widths: input.columnWidths ?? {},
            filter_state: input.filterState ?? {},
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
            .from('user_table_preferences')
            .upsert(payload, { onConflict: 'user_email,table_name,view_name' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save table preferences');
        return mapRow(data);
    },
    async deleteView(userEmail, tableName, viewName) {
        if (viewName === 'active') {
            throw new Error('Cannot delete the active layout');
        }
        const { error } = await supabase
            .from('user_table_preferences')
            .delete()
            .eq('user_email', userEmail)
            .eq('table_name', tableName)
            .eq('view_name', viewName);
        throwIfSupabaseError(error, 'Could not delete saved view');
    },
};
//# sourceMappingURL=user-table-preferences.service.js.map