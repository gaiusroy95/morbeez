import { supabase } from '../../lib/supabase.js';
import type { MaiosGroundRemote } from '../../domain/case/types.js';

async function resolveNdvi(blockId: string): Promise<{
  ndvi: number | null;
  source: MaiosGroundRemote['ndviSource'];
}> {
  const { data: stress } = await supabase
    .from('block_stress_flags')
    .select('score, metadata')
    .eq('block_id', blockId)
    .eq('stress_type', 'ndvi')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (stress?.score != null) {
    return { ndvi: Number(stress.score) / 100, source: 'block_stress' };
  }

  const meta = stress?.metadata as Record<string, unknown> | undefined;
  if (meta?.ndvi != null) {
    return { ndvi: Number(meta.ndvi), source: 'block_stress' };
  }

  const { data: block } = await supabase
    .from('farm_blocks')
    .select('farmer_id')
    .eq('id', blockId)
    .maybeSingle();

  if (block?.farmer_id) {
    const { data: snap } = await supabase
      .from('weather_snapshots')
      .select('metadata')
      .eq('farmer_id', block.farmer_id)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const snapMeta = (snap?.metadata as Record<string, unknown>) ?? {};
    if (snapMeta.ndvi != null) {
      return { ndvi: Number(snapMeta.ndvi), source: 'weather_snapshot' };
    }
  }

  return { ndvi: null, source: 'unavailable' };
}

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
      .neq('stress_type', 'ndvi')
      .order('captured_at', { ascending: false })
      .limit(5);

    const ndvi = await resolveNdvi(blockId);

    return {
      geoPhotoCount: count ?? 0,
      stressFlags: (flags ?? []).map((f) => ({
        type: String(f.stress_type),
        score: Number(f.score),
        capturedAt: String(f.captured_at),
      })),
      satelliteNdvi: ndvi.ndvi,
      ndviSource: ndvi.source,
    };
  },
};
