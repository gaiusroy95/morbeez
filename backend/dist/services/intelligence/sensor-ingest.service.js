import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const sensorIngestService = {
    async ingest(input) {
        const { data, error } = await supabase
            .from('sensor_readings')
            .insert({
            block_id: input.blockId,
            farmer_id: input.farmerId,
            sensor_type: input.sensorType.slice(0, 80),
            value: input.value,
            unit: input.unit ?? null,
            recorded_at: input.recordedAt ?? new Date().toISOString(),
            metadata: input.metadata ?? {},
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not ingest sensor reading');
        return data;
    },
    async listForBlock(blockId, limit = 50) {
        const { data, error } = await supabase
            .from('sensor_readings')
            .select('*')
            .eq('block_id', blockId)
            .order('recorded_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not load sensor readings');
        return data ?? [];
    },
};
//# sourceMappingURL=sensor-ingest.service.js.map