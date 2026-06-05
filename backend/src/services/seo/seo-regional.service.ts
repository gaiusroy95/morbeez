import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export const seoRegionalService = {
  async list(region?: string) {
    let q = supabase.from('seo_regional_trends').select('*').order('trend_score', { ascending: false });
    if (region) q = q.eq('region', region);
    const { data, error } = await q.limit(100);
    throwIfSupabaseError(error, 'Regional trends');
    return data ?? [];
  },

  async upsert(input: {
    region: string;
    keyword: string;
    trendScore?: number;
    searchVolumeEstimate?: number;
    notes?: string;
    suggestedPageSlug?: string;
  }) {
    const { data, error } = await supabase
      .from('seo_regional_trends')
      .upsert(
        {
          region: input.region,
          keyword: input.keyword.trim().toLowerCase(),
          trend_score: input.trendScore ?? 0,
          search_volume_estimate: input.searchVolumeEstimate ?? null,
          notes: input.notes ?? null,
          suggested_page_slug: input.suggestedPageSlug ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'region,keyword' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Upsert regional trend');
    return data;
  },
};
