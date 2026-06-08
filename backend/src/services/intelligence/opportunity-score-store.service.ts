import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import type {
  EmployeeScoreComponents,
  FarmerScoreComponents,
  ScoreFactor,
} from './opportunity-intelligence.types.js';
import { OPPORTUNITY_ENGINE_VERSION } from './opportunity-intelligence.types.js';

export type FarmerScoreSnapshot = {
  farmerId: string;
  opportunityScore: number;
  components: FarmerScoreComponents;
  factors: ScoreFactor[];
  engineVersion: string;
  calculatedAt: string;
};

export type EmployeeScoreSnapshot = {
  employeeProfileId: string;
  performanceScore: number;
  components: EmployeeScoreComponents;
  attributedFarmerCount: number;
  factors: ScoreFactor[];
  engineVersion: string;
  calculatedAt: string;
};

/**
 * Phase 0: read/write score snapshots (engines populate in Phase 3–4).
 */
export const opportunityScoreStoreService = {
  async getFarmerScore(farmerId: string): Promise<FarmerScoreSnapshot | null> {
    const { data, error } = await supabase
      .from('farmer_scores')
      .select('*')
      .eq('farmer_id', farmerId)
      .maybeSingle();

    throwIfSupabaseError(error, 'Could not load farmer score');
    if (!data) return null;

    return {
      farmerId,
      opportunityScore: Number(data.opportunity_score),
      components: {
        engagement: Number(data.engagement_score),
        trust: Number(data.trust_score),
        acreSize: Number(data.acre_size_score),
        acrePotential: Number(data.acre_potential_score),
        relationship: Number(data.relationship_score),
        advisoryCooperation: Number(data.advisory_cooperation_score),
        cropValue: Number(data.crop_value_score),
        referralInfluence: Number(data.referral_influence_score),
      },
      factors: (data.factors as ScoreFactor[]) ?? [],
      engineVersion: String(data.engine_version),
      calculatedAt: String(data.calculated_at),
    };
  },

  async upsertFarmerScore(
    farmerId: string,
    components: FarmerScoreComponents,
    factors: ScoreFactor[]
  ): Promise<FarmerScoreSnapshot> {
    const opportunityScore = Math.min(
      100,
      components.engagement +
        components.trust +
        components.acreSize +
        components.acrePotential +
        components.relationship +
        components.advisoryCooperation +
        components.cropValue +
        components.referralInfluence
    );
    const now = new Date().toISOString();

    const row = {
      farmer_id: farmerId,
      opportunity_score: opportunityScore,
      engagement_score: components.engagement,
      trust_score: components.trust,
      acre_size_score: components.acreSize,
      acre_potential_score: components.acrePotential,
      relationship_score: components.relationship,
      advisory_cooperation_score: components.advisoryCooperation,
      crop_value_score: components.cropValue,
      referral_influence_score: components.referralInfluence,
      factors,
      engine_version: OPPORTUNITY_ENGINE_VERSION,
      calculated_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from('farmer_scores').upsert(row, { onConflict: 'farmer_id' });
    throwIfSupabaseError(error, 'Could not save farmer score');

    await supabase.from('farmer_score_history').insert({
      farmer_id: farmerId,
      opportunity_score: opportunityScore,
      components,
      factors,
      engine_version: OPPORTUNITY_ENGINE_VERSION,
      period_days: 30,
      calculated_at: now,
    });

    return {
      farmerId,
      opportunityScore,
      components,
      factors,
      engineVersion: OPPORTUNITY_ENGINE_VERSION,
      calculatedAt: now,
    };
  },

  async getEmployeeScore(employeeProfileId: string): Promise<EmployeeScoreSnapshot | null> {
    const { data, error } = await supabase
      .from('employee_scores')
      .select('*')
      .eq('employee_profile_id', employeeProfileId)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return null;
      }
      throwIfSupabaseError(error, 'Could not load employee score');
    }
    if (!data) return null;

    return {
      employeeProfileId,
      performanceScore: Number(data.performance_score),
      components: {
        engagementGrowth: Number(data.engagement_growth_score),
        relationshipQuality: Number(data.relationship_quality_score),
        retentionQuality: Number(data.retention_quality_score),
        trustBuilding: Number(data.trust_building_score),
        delayedConversion: Number(data.delayed_conversion_score),
        farmerReactivation: Number(data.farmer_reactivation_score),
        knowledgeContribution: Number(data.knowledge_contribution_score),
        farmerSatisfaction: Number(data.farmer_satisfaction_score),
      },
      attributedFarmerCount: Number(data.attributed_farmer_count ?? 0),
      factors: (data.factors as ScoreFactor[]) ?? [],
      engineVersion: String(data.engine_version),
      calculatedAt: String(data.calculated_at),
    };
  },

  async upsertEmployeeScore(
    employeeProfileId: string,
    components: EmployeeScoreComponents,
    factors: ScoreFactor[],
    attributedFarmerCount: number
  ): Promise<EmployeeScoreSnapshot> {
    const performanceScore = Math.min(
      100,
      components.engagementGrowth +
        components.relationshipQuality +
        components.retentionQuality +
        components.trustBuilding +
        components.delayedConversion +
        components.farmerReactivation +
        components.knowledgeContribution +
        components.farmerSatisfaction
    );
    const now = new Date().toISOString();

    const row = {
      employee_profile_id: employeeProfileId,
      performance_score: performanceScore,
      engagement_growth_score: components.engagementGrowth,
      relationship_quality_score: components.relationshipQuality,
      retention_quality_score: components.retentionQuality,
      trust_building_score: components.trustBuilding,
      delayed_conversion_score: components.delayedConversion,
      farmer_reactivation_score: components.farmerReactivation,
      knowledge_contribution_score: components.knowledgeContribution,
      farmer_satisfaction_score: components.farmerSatisfaction,
      attributed_farmer_count: attributedFarmerCount,
      factors,
      engine_version: OPPORTUNITY_ENGINE_VERSION,
      calculated_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('employee_scores')
      .upsert(row, { onConflict: 'employee_profile_id' });
    throwIfSupabaseError(error, 'Could not save employee score');

    await supabase.from('employee_score_history').insert({
      employee_profile_id: employeeProfileId,
      performance_score: performanceScore,
      components,
      factors,
      engine_version: OPPORTUNITY_ENGINE_VERSION,
      period_days: 30,
      attributed_farmer_count: attributedFarmerCount,
      calculated_at: now,
    });

    return {
      employeeProfileId,
      performanceScore,
      components,
      attributedFarmerCount,
      factors,
      engineVersion: OPPORTUNITY_ENGINE_VERSION,
      calculatedAt: now,
    };
  },
};
