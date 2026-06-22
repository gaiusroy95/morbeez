import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export const satelliteImageryService = {
  async recordOverlay(input: {
    blockId: string;
    farmerId: string;
    overlayType: string;
    captureDate: string;
    ndviMean?: number;
    storageUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { data, error } = await supabase
      .from('satellite_overlays')
      .insert({
        block_id: input.blockId,
        farmer_id: input.farmerId,
        overlay_type: input.overlayType.slice(0, 80),
        capture_date: input.captureDate.slice(0, 10),
        ndvi_mean: input.ndviMean ?? null,
        storage_url: input.storageUrl ?? null,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record satellite overlay');
    return data;
  },

  async listForBlock(blockId: string, limit = 20) {
    const { data, error } = await supabase
      .from('satellite_overlays')
      .select('*')
      .eq('block_id', blockId)
      .order('capture_date', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not load satellite overlays');
    return data ?? [];
  },
};
