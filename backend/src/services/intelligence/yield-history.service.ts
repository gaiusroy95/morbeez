import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export type YieldHistoryRow = {
  id: string;
  cropType: string;
  seasonLabel: string | null;
  yieldKgPerAcre: number | null;
  harvestDate: string | null;
  source: string;
};

export const yieldHistoryService = {
  async syncFromHarvestRecords(farmerId: string, blockId?: string | null) {
    let q = supabase
      .from('harvest_records')
      .select('id, crop_type, season_id, yield_kg, harvest_date, created_at')
      .eq('farmer_id', farmerId);
    if (blockId) q = q.eq('block_id', blockId);
    const { data: harvests, error } = await q.order('harvest_date', { ascending: false }).limit(50);
    throwIfSupabaseError(error, 'Could not load harvest records');

    for (const h of harvests ?? []) {
      const harvestDate = h.harvest_date ? String(h.harvest_date).slice(0, 10) : null;
      const { data: existing } = await supabase
        .from('yield_history')
        .select('id')
        .eq('farmer_id', farmerId)
        .eq('source', 'harvest_record')
        .contains('metadata', { harvestRecordId: String(h.id) })
        .maybeSingle();
      if (existing) continue;

      await supabase.from('yield_history').insert({
        farmer_id: farmerId,
        block_id: blockId ?? null,
        crop_type: String(h.crop_type ?? 'unknown'),
        season_label: h.season_id ? String(h.season_id).slice(0, 8) : null,
        yield_kg_per_acre: h.yield_kg != null ? Number(h.yield_kg) : null,
        harvest_date: harvestDate,
        source: 'harvest_record',
        metadata: { harvestRecordId: String(h.id) },
      });
    }
  },

  async listForBlock(farmerId: string, blockId: string, limit = 12): Promise<YieldHistoryRow[]> {
    await this.syncFromHarvestRecords(farmerId, blockId).catch(() => {});

    const { data, error } = await supabase
      .from('yield_history')
      .select('id, crop_type, season_label, yield_kg_per_acre, harvest_date, source')
      .eq('farmer_id', farmerId)
      .eq('block_id', blockId)
      .order('harvest_date', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not load yield history');

    return (data ?? []).map((r) => ({
      id: String(r.id),
      cropType: String(r.crop_type),
      seasonLabel: r.season_label ? String(r.season_label) : null,
      yieldKgPerAcre: r.yield_kg_per_acre != null ? Number(r.yield_kg_per_acre) : null,
      harvestDate: r.harvest_date ? String(r.harvest_date) : null,
      source: String(r.source),
    }));
  },
};
