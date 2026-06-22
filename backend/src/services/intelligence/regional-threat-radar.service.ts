import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { nearbyCasesService } from '../whatsapp/pipeline/nearby-cases.service.js';
import { diseaseWeatherRulesService } from '../whatsapp/pipeline/disease-weather-rules.service.js';
import { contextPackService } from '../whatsapp/pipeline/context-pack.service.js';

export type RegionalThreatRow = {
  district: string;
  cropType: string;
  issueLabel: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  caseCount7d: number;
  trendDirection: 'rising' | 'stable' | 'falling';
  reasoning: string;
};

export const regionalThreatRadarService = {
  async computeForDistrict(district: string, cropType: string): Promise<RegionalThreatRow[]> {
    const crop = cropType.toLowerCase();
    const { data: recentCases } = await supabase
      .from('recommendation_records')
      .select('issue_detected, created_at, farmers!inner(district)')
      .ilike('farmers.district', district)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(200);

    const counts = new Map<string, number>();
    for (const r of recentCases ?? []) {
      const label = String(r.issue_detected ?? '').trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    const threats: RegionalThreatRow[] = [];
    for (const [issueLabel, caseCount7d] of counts) {
      const threatLevel =
        caseCount7d >= 8 ? 'critical' : caseCount7d >= 5 ? 'high' : caseCount7d >= 3 ? 'medium' : 'low';
      if (threatLevel === 'low') continue;
      threats.push({
        district,
        cropType: crop,
        issueLabel,
        threatLevel,
        caseCount7d,
        trendDirection: caseCount7d >= 5 ? 'rising' : 'stable',
        reasoning: `${caseCount7d} cases in ${district} in the last 7 days`,
      });
    }

    return threats.sort((a, b) => b.caseCount7d - a.caseCount7d);
  },

  async refreshAndPersist(district: string, cropType: string) {
    const threats = await this.computeForDistrict(district, cropType);
    for (const t of threats) {
      await supabase.from('regional_threat_signals').insert({
        district: t.district,
        crop_type: t.cropType,
        issue_label: t.issueLabel,
        threat_level: t.threatLevel,
        case_count_7d: t.caseCount7d,
        trend_direction: t.trendDirection,
        reasoning: t.reasoning,
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
    }
    return threats;
  },

  async listActive(opts?: { district?: string; cropType?: string; limit?: number }) {
    let q = supabase
      .from('regional_threat_signals')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(opts?.limit ?? 50);
    if (opts?.district) q = q.ilike('district', opts.district);
    if (opts?.cropType) q = q.eq('crop_type', opts.cropType.toLowerCase());
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list threat signals');
    return (data ?? []).map((r) => ({
      id: String(r.id),
      district: String(r.district),
      cropType: String(r.crop_type),
      issueLabel: String(r.issue_label),
      threatLevel: String(r.threat_level) as RegionalThreatRow['threatLevel'],
      caseCount7d: Number(r.case_count_7d),
      trendDirection: String(r.trend_direction ?? 'stable') as RegionalThreatRow['trendDirection'],
      reasoning: String(r.reasoning ?? ''),
      computedAt: String(r.computed_at),
    }));
  },

  async riskFlagsForFarmer(farmerId: string, cropType: string): Promise<string[]> {
    const { data: farmer } = await supabase.from('farmers').select('district').eq('id', farmerId).maybeSingle();
    const district = farmer?.district ? String(farmer.district) : null;
    if (!district) return [];

    const nearby = await nearbyCasesService.summarize(farmerId, cropType);
    const pack = await contextPackService.build(farmerId, { cropType });
    const priors = diseaseWeatherRulesService.evaluate({
      cropType,
      env: {
        seasonPhase: pack.seasonPhase,
        heavyRainLikely: pack.heavyRainLikely,
        highHumidityLikely: pack.highHumidityLikely,
        weatherRiskScore: pack.weatherRiskScore,
      },
    });

    const flags: string[] = [];
    for (const p of priors.filter((x) => x.likelihood === 'high')) {
      flags.push(`Regional risk (context): elevated ${p.issueLabel} — ${p.reasoning}`);
    }
    for (const issue of nearby.recentIssues?.slice(0, 2) ?? []) {
      flags.push(`Nearby cases: ${issue.issueLabel} (${issue.count} in area, context only)`);
    }
    const stored = await this.listActive({ district, cropType, limit: 3 });
    for (const t of stored) {
      flags.push(`Threat radar: ${t.issueLabel} ${t.threatLevel} in ${t.district}`);
    }
    return flags;
  },
};
