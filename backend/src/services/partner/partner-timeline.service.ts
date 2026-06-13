import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export const partnerTimelineService = {
  async addEntry(input: {
    farmerId: string;
    body: string;
    authorType: 'telecaller' | 'partner' | 'expert' | 'admin' | 'system';
    authorEmail?: string | null;
    partnerId?: string | null;
    authorName?: string | null;
    entryType?: 'note' | 'comment' | 'escalation' | 'support_request' | 'review_request' | 'system_event';
    taskId?: string | null;
    fieldFindingId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
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

  async listForFarmer(farmerId: string, limit = 50) {
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
