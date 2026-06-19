import { supabase } from '../../lib/supabase.js';
import type { MaiosGroundRemote } from '../../domain/case/types.js';

export const groundIntelligenceService = {
  async loadForBlock(blockId: string): Promise<MaiosGroundRemote> {
    const { count } = await supabase
      .from('crop_images')
      .select('id', { count: 'exact', head: true })
      .eq('block_id', blockId);

    const { data: flags } = await supabase
      .from('block_stress_flags')
      .select('stress_type, score, captured_at')
      .eq('block_id', blockId)
      .order('captured_at', { ascending: false })
      .limit(5);

    return {
      geoPhotoCount: count ?? 0,
      stressFlags: (flags ?? []).map((f) => ({
        type: String(f.stress_type),
        score: Number(f.score),
        capturedAt: String(f.captured_at),
      })),
      satelliteNdvi: null,
    };
  },
};
