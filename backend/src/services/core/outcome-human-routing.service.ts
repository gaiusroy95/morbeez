import { supabase } from '../../lib/supabase.js';
import type { ImprovementLevel, OutcomeKpiPayload } from '../../domain/ai-training/outcome-kpi.js';

export type HumanReviewDecision = {
  needsHumanReview: boolean;
  reasons: string[];
};

const QA_SAMPLE_PCT = () => Number(process.env.REC_OUTCOME_QA_SAMPLE_PCT ?? 5);

export const outcomeHumanRoutingService = {
  async decide(params: {
    farmerId: string;
    recommendationRecordId: string;
    improvementLevel: ImprovementLevel;
    kpi: OutcomeKpiPayload;
    severity: string | null;
    aiSessionConfidence?: number | null;
    farmerMetadata?: Record<string, unknown>;
  }): Promise<HumanReviewDecision> {
    const reasons: string[] = [];
    const level = params.improvementLevel;
    const aiConf = params.kpi.aiConfidence ?? 0.85;

    if (level === 'worse') reasons.push('crop_worsened');
    if (level === 'no_improvement') reasons.push('no_improvement');

    if ((params.severity ?? '').toLowerCase() === 'high') {
      reasons.push('high_severity_case');
    }

    if (params.kpi.aiClassification === 'uncertain' || aiConf < 0.6) {
      reasons.push('uncertain_ai_classification');
    }

    if (params.farmerMetadata?.premium === true || params.farmerMetadata?.highValue === true) {
      reasons.push('high_value_farmer');
    }

    const repeatFailures = await this.countRecentFailedOutcomes(params.farmerId);
    if (repeatFailures >= 2) reasons.push('repeat_failed_outcomes');

    if (params.kpi.repeatedIssue) reasons.push('repeated_issue_reported');

    const autoSuccess =
      (level === 'fully_improved' || level === 'slight_improvement') &&
      aiConf >= 0.65 &&
      !reasons.some((r) =>
        ['crop_worsened', 'no_improvement', 'high_severity_case', 'repeat_failed_outcomes'].includes(r)
      );

    if (autoSuccess && Math.random() * 100 < QA_SAMPLE_PCT()) {
      reasons.push('qa_random_sample');
    }

    return { needsHumanReview: reasons.length > 0, reasons };
  },

  async countRecentFailedOutcomes(farmerId: string): Promise<number> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('recommendation_records')
      .select('id', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .gte('created_at', since)
      .in('outcome', ['no_improvement'])
      .eq('status', 'outcome_recorded');
    return count ?? 0;
  },

  formatReasonsForStaff(reasons: string[]): string {
    const labels: Record<string, string> = {
      crop_worsened: 'Crop worsened (farmer report)',
      no_improvement: 'No improvement reported',
      high_severity_case: 'High severity original case',
      uncertain_ai_classification: 'Uncertain automated classification',
      high_value_farmer: 'High-value farmer',
      repeat_failed_outcomes: 'Repeat failed outcomes (90 days)',
      repeated_issue_reported: 'Farmer reported repeated issue',
      qa_random_sample: 'Random QA audit sample',
      outcome_no_whatsapp_response: 'No WhatsApp KPI response',
    };
    return reasons.map((r) => labels[r] ?? r).join('; ');
  },
};
