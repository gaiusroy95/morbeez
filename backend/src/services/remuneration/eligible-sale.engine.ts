import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { evaluateEligibleSale } from '../../domain/remuneration/eligible-sale.js';
import { earningRulesService } from './earning-rules.service.js';

type OrderRow = {
  id: string;
  farmer_id: string | null;
  total_amount: number | null;
  oms_status: string | null;
  delivered_at: string | null;
  payment_status?: string | null;
  attributed_partner_id: string | null;
  attributed_agronomist_email: string | null;
  incentive_eligibility: string | null;
  incentive_eligible_at: string | null;
  incentive_excluded_reason: string | null;
};

async function freezeAttribution(orderId: string, farmerId: string | null) {
  const { data: order } = await supabase
    .from('commerce_orders')
    .select('attributed_partner_id, attributed_agronomist_email, farmer_id')
    .eq('id', orderId)
    .maybeSingle();
  if (order?.attributed_partner_id && order.attributed_agronomist_email) return order;

  const fid = farmerId ?? (order?.farmer_id ? String(order.farmer_id) : null);
  let partnerId = order?.attributed_partner_id ? String(order.attributed_partner_id) : null;
  let agroEmail = order?.attributed_agronomist_email ? String(order.attributed_agronomist_email) : '';
  if (fid) {
    if (!agroEmail) {
      const { data: farmer } = await supabase
        .from('farmers')
        .select('assigned_crop_advisor')
        .eq('id', fid)
        .maybeSingle();
      agroEmail = farmer?.assigned_crop_advisor ? String(farmer.assigned_crop_advisor) : '';
    }
    if (!partnerId && env.ENABLE_PARTNER_PROGRAM) {
      const { farmerOwnershipService } = await import('../partner/farmer-ownership.service.js');
      const ownership = await farmerOwnershipService.getOwnership(fid);
      partnerId = ownership?.customerOwnerPartnerId ?? ownership?.assignedPartnerId ?? null;
    }
  }
  await supabase
    .from('commerce_orders')
    .update({
      attributed_partner_id: partnerId,
      attributed_agronomist_email: agroEmail || null,
    })
    .eq('id', orderId);
  return { attributed_partner_id: partnerId, attributed_agronomist_email: agroEmail };
}

async function hasRefund(orderId: string): Promise<boolean> {
  const { count } = await supabase
    .from('return_requests')
    .select('id', { count: 'exact', head: true })
    .eq('commerce_order_id', orderId)
    .in('status', ['refund_completed', 'refunded']);
  return (count ?? 0) > 0;
}

export const eligibleSaleEngine = {
  async onOrderPaid(input: { orderId: string; farmerId?: string | null; grossInr?: number }) {
    await freezeAttribution(input.orderId, input.farmerId ?? null);
    await this.refresh(input.orderId, { paid: true });
  },

  async onDelivered(orderId: string) {
    await this.refresh(orderId);
  },

  async onReturnOrRefund(orderId: string, reason: string) {
    await supabase
      .from('commerce_orders')
      .update({
        incentive_eligibility: 'adjusted',
        incentive_excluded_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    const { partnerPayoutService } = await import('../partner/partner-payout.service.js');
    await partnerPayoutService.adjustOrder(orderId, reason).catch((err) => {
      logger.warn({ err, orderId }, 'Partner earning adjustment skipped');
    });
    const { agronomistSalesIncentiveService } = await import('./agronomist-sales-incentive.service.js');
    await agronomistSalesIncentiveService.adjustOrder(orderId, reason).catch((err) => {
      logger.warn({ err, orderId }, 'Agronomist sales adjustment skipped');
    });
    const { productRewardService } = await import('./product-reward.service.js');
    await productRewardService.restoreOrder(orderId).catch((err) => {
      logger.warn({ err, orderId }, 'Product reward restore skipped');
    });
  },

  async refresh(orderId: string, facts?: { paid?: boolean }): Promise<{ status: string } | null> {
    const { data: order } = await supabase
      .from('commerce_orders')
      .select(
        'id, farmer_id, total_amount, oms_status, delivered_at, payment_status, attributed_partner_id, attributed_agronomist_email, incentive_eligibility, incentive_eligible_at, incentive_excluded_reason'
      )
      .eq('id', orderId)
      .maybeSingle();
    if (!order?.id) return null;

    const windowDays = await earningRulesService.returnWindowDays();
    const refunded = await hasRefund(String(order.id));
    const oms = String(order.oms_status ?? '').toLowerCase();
    const payment = String(order.payment_status ?? '').toLowerCase();
    const paid =
      facts?.paid === true ||
      Boolean(order.delivered_at) ||
      ['paid', 'captured', 'completed'].includes(payment) ||
      (order.incentive_eligibility != null &&
        order.incentive_eligibility !== 'pending_payment');

    const result = evaluateEligibleSale({
      paid,
      omsStatus: order.oms_status ? String(order.oms_status) : null,
      deliveredAt: order.delivered_at ? String(order.delivered_at) : null,
      cancelled: oms === 'cancelled',
      returned: oms === 'returned',
      refunded,
      fraud: String(order.incentive_excluded_reason ?? '') === 'fraud',
      excluded: ['excluded', 'adjusted'].includes(String(order.incentive_eligibility ?? '')),
      excludedReason: order.incentive_excluded_reason ? String(order.incentive_excluded_reason) : null,
      returnWindowDays: windowDays,
    });

    const { error } = await supabase
      .from('commerce_orders')
      .update({
        incentive_eligibility: result.status === 'excluded' ? 'excluded' : result.status,
        incentive_eligible_at: result.eligibleAt,
        incentive_excluded_reason: result.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    if (error) {
      logger.warn({ err: error, orderId }, 'Could not update incentive eligibility');
      return result;
    }

    if (result.status === 'eligible') {
      await this.creditIncentives(order as OrderRow);
    }
    return result;
  },

  async creditIncentives(order: OrderRow) {
    const farmerId = order.farmer_id ? String(order.farmer_id) : null;
    const gross = Number(order.total_amount ?? 0);
    const partnerId = order.attributed_partner_id ? String(order.attributed_partner_id) : null;
    if (partnerId && farmerId && env.ENABLE_PARTNER_PROGRAM && env.ENABLE_PARTNER_COMMISSION) {
      const { commissionEngineService } = await import('../partner/commission-engine.service.js');
      await commissionEngineService.computeForOrder({
        partnerId,
        farmerId,
        orderId: String(order.id),
        grossInr: gross,
      });
    }
    const agroEmail = order.attributed_agronomist_email ? String(order.attributed_agronomist_email) : '';
    if (agroEmail && farmerId) {
      const { agronomistSalesIncentiveService } = await import('./agronomist-sales-incentive.service.js');
      await agronomistSalesIncentiveService.accrueForOrder({
        agronomistEmail: agroEmail,
        farmerId,
        orderId: String(order.id),
        grossInr: gross,
      });
    }
  },

  async scanDue(limit = 80) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('id')
      .eq('incentive_eligibility', 'pending_return_window')
      .lte('incentive_eligible_at', now)
      .limit(limit);
    if (error) {
      logger.warn({ err: error }, 'Eligible-sale scan failed');
      return { scanned: 0 };
    }
    for (const row of data ?? []) {
      await this.refresh(String(row.id)).catch((err) =>
        logger.warn({ err, orderId: row.id }, 'Eligible-sale refresh failed')
      );
    }
    return { scanned: data?.length ?? 0 };
  },
};
