import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { employeeProfileResolveService } from './employee-profile-resolve.service.js';
function mapRow(row) {
    return {
        id: String(row.id),
        farmerId: String(row.farmer_id),
        employeeProfileId: row.employee_profile_id ? String(row.employee_profile_id) : null,
        eventType: String(row.event_type),
        eventValue: row.event_value ?? {},
        source: String(row.source),
        occurredAt: String(row.occurred_at),
        createdAt: String(row.created_at),
    };
}
/**
 * Phase 0: record + query API for farmer_events.
 * Phase 1 will call record() from WhatsApp, CRM, agronomist, ROI pipelines.
 */
export const farmerEventService = {
    async record(input) {
        const employeeProfileId = await employeeProfileResolveService.resolve({
            employeeProfileId: input.employeeProfileId,
            employeeEmail: input.employeeEmail,
        });
        const payload = {
            farmer_id: input.farmerId,
            employee_profile_id: employeeProfileId,
            event_type: input.eventType,
            event_value: input.eventValue ?? {},
            source: input.source,
            idempotency_key: input.idempotencyKey ?? null,
            reference_type: input.referenceType ?? null,
            reference_id: input.referenceId ?? null,
            occurred_at: input.occurredAt ?? new Date().toISOString(),
        };
        if (input.idempotencyKey) {
            const { data: existing } = await supabase
                .from('farmer_events')
                .select('*')
                .eq('idempotency_key', input.idempotencyKey)
                .maybeSingle();
            if (existing)
                return mapRow(existing);
        }
        const { data, error } = await supabase.from('farmer_events').insert(payload).select('*').single();
        throwIfSupabaseError(error, 'Could not record farmer event');
        const row = mapRow(data);
        const { intelligencePipelineService } = await import('./intelligence-pipeline.service.js');
        intelligencePipelineService.onFarmerEventRecorded(input.farmerId, input.eventType);
        return row;
    },
    async listForFarmer(farmerId, opts) {
        const limit = Math.min(opts?.limit ?? 50, 200);
        let q = supabase
            .from('farmer_events')
            .select('*')
            .eq('farmer_id', farmerId)
            .order('occurred_at', { ascending: false })
            .limit(limit);
        if (opts?.since)
            q = q.gte('occurred_at', opts.since);
        if (opts?.eventTypes?.length)
            q = q.in('event_type', opts.eventTypes);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not list farmer events');
        return (data ?? []).map((r) => mapRow(r));
    },
};
//# sourceMappingURL=farmer-event.service.js.map