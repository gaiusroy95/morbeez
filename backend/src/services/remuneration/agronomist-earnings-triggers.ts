import { logger } from '../../lib/logger.js';
import { agronomistEarningsService } from './agronomist-earnings.service.js';
import { supabase } from '../../lib/supabase.js';
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';

function fire(label: string, work: () => Promise<unknown>): void {
  void work().catch((err) => logger.warn({ err, label }, 'Agronomist remuneration trigger skipped'));
}

export const agronomistEarningsTriggers = {
  onVisitCheckout(session: {
    id: string;
    agronomist_email: string;
    farmer_id: string;
    field_finding_id?: string | null;
    check_in_lat?: number | null;
    check_in_lng?: number | null;
    check_out_lat?: number | null;
    check_out_lng?: number | null;
  }): void {
    fire('visit_checkout', () => agronomistEarningsService.creditVisitCheckout(session));
  },

  onStructuredVisitSubmitted(params: {
    findingId: string;
    agronomistEmail: string;
    farmerId: string;
  }): void {
    fire('structured_visit', () =>
      agronomistEarningsService.credit({
        agronomistEmail: params.agronomistEmail,
        farmerId: params.farmerId,
        eventType: 'field_visit',
        sourceId: `finding:${params.findingId}`,
        notes: 'Structured field visit submitted',
      })
    );
  },

  onRecommendationApplied(recommendationRecordId: string): void {
    fire('rec_applied', async () => {
      const { data: rec } = await supabase
        .from('recommendation_records')
        .select('id, farmer_id, created_by')
        .eq('id', recommendationRecordId)
        .maybeSingle();
      if (!rec) return;
      let email = rec.created_by ? String(rec.created_by) : '';
      if (!email) {
        const { data: farmer } = await supabase
          .from('farmers')
          .select('assigned_crop_advisor')
          .eq('id', rec.farmer_id)
          .maybeSingle();
        email = farmer?.assigned_crop_advisor ? String(farmer.assigned_crop_advisor) : '';
      }
      if (!email) return;
      await agronomistEarningsService.credit({
        agronomistEmail: email,
        farmerId: String(rec.farmer_id),
        eventType: 'recommendation_success',
        sourceId: `rec:${recommendationRecordId}`,
        notes: 'Farmer confirmed application',
      });
    });
  },

  onEscalationResolved(params: {
    escalationId: string;
    assignedTo?: string | null;
    agentEmail: string;
    farmerId?: string | null;
  }): void {
    const email = params.assignedTo?.trim() || params.agentEmail;
    if (!email) return;
    fire('escalation_resolved', () =>
      agronomistEarningsService.credit({
        agronomistEmail: email,
        farmerId: params.farmerId,
        eventType: 'escalation_resolved',
        sourceId: `esc:${params.escalationId}`,
        notes: 'Escalation marked resolved',
      })
    );
  },

  onOrderPaidForAssignedFarmer(params: { farmerId: string; orderId: string }): void {
    fire('retention', async () => {
      const { data: farmer } = await supabase
        .from('farmers')
        .select('assigned_crop_advisor')
        .eq('id', params.farmerId)
        .maybeSingle();
      const email = farmer?.assigned_crop_advisor ? String(farmer.assigned_crop_advisor) : '';
      if (!email) return;
      await agronomistEarningsService.credit({
        agronomistEmail: email,
        farmerId: params.farmerId,
        eventType: 'retention',
        sourceId: `retention:${params.farmerId}:${periodMonth()}`,
        notes: `Repeat/assigned farmer order ${params.orderId}`,
      });
    });
  },
};
