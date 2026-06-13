import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const partnerTimelineService = {
    async addEntry(input) {
        const { data, error } = await supabase
            .from('farmer_timeline_entries')
            .insert({
            farmer_id: input.farmerId,
            body: input.body,
            author_type: input.authorType,
            author_email: input.authorEmail ?? null,
            partner_id: input.partnerId ?? null,
            author_name: input.authorName ?? null,
            entry_type: input.entryType ?? 'note',
            task_id: input.taskId ?? null,
            field_finding_id: input.fieldFindingId ?? null,
            metadata: input.metadata ?? {},
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not add timeline entry');
        return data;
    },
    async listForFarmer(farmerId, limit = 50) {
        const { data, error } = await supabase
            .from('farmer_timeline_entries')
            .select('*')
            .eq('farmer_id', farmerId)
            .order('created_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not list timeline');
        return data ?? [];
    },
};
//# sourceMappingURL=partner-timeline.service.js.map