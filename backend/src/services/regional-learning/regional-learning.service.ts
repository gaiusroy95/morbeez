import { supabase } from '../../lib/supabase.js';

export const regionalLearningService = {
  async resolveCluster(params: {
    farmerId: string;
    cropType: string;
    soilPh?: number;
  }): Promise<{ clusterKey: string } | null> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('district')
      .eq('id', params.farmerId)
      .maybeSingle();

    const district = farmer?.district ? String(farmer.district) : null;
    if (!district) return null;

    const phBand =
      params.soilPh == null
        ? 'unknown'
        : params.soilPh >= 7.5
          ? 'high'
          : params.soilPh <= 5.5
            ? 'low'
            : 'neutral';

    const clusterKey = `${params.cropType}:${district}:${phBand}`.toLowerCase();

    await supabase.from('regional_farm_clusters').upsert(
      {
        cluster_key: clusterKey,
        crop_type: params.cropType,
        district,
        soil_ph_band: phBand,
        farm_count: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cluster_key' }
    );

    return { clusterKey };
  },

  async recordIssueStat(district: string, cropType: string, issueLabel: string): Promise<void> {
    const { data: existing } = await supabase
      .from('regional_issue_stats')
      .select('id, case_count')
      .eq('district', district)
      .eq('crop_type', cropType)
      .eq('issue_label', issueLabel)
      .is('season', null)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('regional_issue_stats')
        .update({
          case_count: Number(existing.case_count) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('regional_issue_stats').insert({
        district,
        crop_type: cropType,
        issue_label: issueLabel,
        case_count: 1,
      });
    }
  },
};
