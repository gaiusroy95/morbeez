import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const employeeActionLogService = {
    async log(input) {
        const { error } = await supabase.from('employee_action_logs').insert({
            actor_email: input.actorEmail,
            action_type: input.actionType,
            entity_type: input.entityType,
            entity_id: input.entityId ?? null,
            details: input.details ?? {},
        });
        throwIfSupabaseError(error, 'Action log');
    },
    async listForEntity(entityType, entityId, limit = 50) {
        const { data, error } = await supabase
            .from('employee_action_logs')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Action log list');
        return data ?? [];
    },
};
//# sourceMappingURL=employee-action-log.service.js.map