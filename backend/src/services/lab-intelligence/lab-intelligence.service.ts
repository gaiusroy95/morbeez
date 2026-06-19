import { supabase } from '../../lib/supabase.js';
import type { MaiosLabReport } from '../../domain/case/types.js';
import { normalizeSoilMetrics } from '../soil/soil-lab-metrics.js';

export const labIntelligenceService = {
  async loadForFarmer(
    farmerId: string,
    blockId?: string | null
  ): Promise<MaiosLabReport[]> {
    const reports: MaiosLabReport[] = [];

    let soilQ = supabase
      .from('crm_soil_reports')
      .select('metrics, reported_at')
      .eq('farmer_id', farmerId)
      .order('reported_at', { ascending: false })
      .limit(1);
    if (blockId) soilQ = soilQ.eq('block_id', blockId);
    const { data: soil } = await soilQ.maybeSingle();
    if (soil) {
      reports.push({
        type: 'soil',
        reportedAt: String(soil.reported_at),
        metrics: normalizeSoilMetrics(soil.metrics as Record<string, unknown>),
        source: 'crm',
      });
    }

    let waterQ = supabase
      .from('crm_water_reports')
      .select('metrics, reported_at, source')
      .eq('farmer_id', farmerId)
      .order('reported_at', { ascending: false })
      .limit(1);
    if (blockId) waterQ = waterQ.eq('block_id', blockId);
    const { data: water } = await waterQ.maybeSingle();
    if (water) {
      reports.push({
        type: 'water',
        reportedAt: String(water.reported_at),
        metrics: (water.metrics as Record<string, unknown>) ?? {},
        source: String(water.source ?? 'lab'),
      });
    }

    let leafQ = supabase
      .from('crm_leaf_reports')
      .select('metrics, reported_at, source')
      .eq('farmer_id', farmerId)
      .order('reported_at', { ascending: false })
      .limit(1);
    if (blockId) leafQ = leafQ.eq('block_id', blockId);
    const { data: leaf } = await leafQ.maybeSingle();
    if (leaf) {
      reports.push({
        type: 'leaf',
        reportedAt: String(leaf.reported_at),
        metrics: (leaf.metrics as Record<string, unknown>) ?? {},
        source: String(leaf.source ?? 'lab'),
      });
    }

    let pathogenQ = supabase
      .from('crm_pathogen_reports')
      .select('metrics, reported_at, source, pathogen')
      .eq('farmer_id', farmerId)
      .order('reported_at', { ascending: false })
      .limit(1);
    if (blockId) pathogenQ = pathogenQ.eq('block_id', blockId);
    const { data: pathogen } = await pathogenQ.maybeSingle();
    if (pathogen) {
      reports.push({
        type: 'pathogen',
        reportedAt: String(pathogen.reported_at),
        metrics: {
          ...((pathogen.metrics as Record<string, unknown>) ?? {}),
          detected: pathogen.pathogen,
        },
        source: String(pathogen.source ?? 'lab'),
      });
    }

    return reports;
  },
};
