import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';
import { dominantCategory, isCommercialOrder } from '../../domain/remuneration/commission-category.js';
import { partnerIncentiveInr, partnerKpiFactor } from '../../domain/remuneration/kpi-factor.js';
import { resolvePoolSplit } from '../../domain/remuneration/pool-split.js';
import { earningRulesService } from '../remuneration/earning-rules.service.js';
import { settlementService } from '../remuneration/settlement.service.js';

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function partnerKpiScore(partnerId: string, month: string): Promise<number> {
  const monthStart = `${month}-01`;
  const { data: snap } = await supabase
    .from('partner_kpi_snapshots')
    .select('performance_score, period_start')
    .eq('partner_id', partnerId)
    .lte('period_start', monthStart)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snap?.performance_score != null) return Number(snap.performance_score);
  const { data: partner } = await supabase
    .from('partners')
    .select('reliability_score, performance_score')
    .eq('id', partnerId)
    .maybeSingle();
  return Number(partner?.performance_score ?? partner?.reliability_score ?? 70);
}

export const commissionEngineService = {
  async listMaster() {
    const { data, error } = await supabase.from('commission_master').select('*').eq('is_active', true);
    throwIfSupabaseError(error, 'Could not load commission master');
    return data ?? [];
  },

  async computeForOrder(input: {
    partnerId: string;
    farmerId: string;
    orderId: string;
    categoryKey?: string;
    grossInr: number;
  }) {
    const { data: already } = await supabase
      .from('partner_earnings_ledger')
      .select('id')
      .eq('partner_id', input.partnerId)
      .eq('order_id', input.orderId)
      .neq('status', 'reversed')
      .neq('earning_kind', 'adjustment')
      .limit(1)
      .maybeSingle();
    if (already?.id) return null;

    const { data: order } = await supabase
      .from('commerce_orders')
      .select('id, created_at, attributed_agronomist_email')
      .eq('id', input.orderId)
      .maybeSingle();
    const asOf = order?.created_at ? String(order.created_at).slice(0, 10) : undefined;
    const { data: orderLines } = await supabase
      .from('commerce_order_lines')
      .select(
        'sku, product_title, qty_ordered, unit_price, channel_pool_pct, channel_pool_agronomist_pct, channel_pool_partner_pct, channel_pool_version_id, channel_pool_version_label'
      )
      .eq('commerce_order_id', input.orderId);

    const categoryKey =
      input.categoryKey?.trim() ||
      dominantCategory(
        (orderLines ?? []).map((line) => ({
          sku: line.sku ? String(line.sku) : null,
          title: line.product_title ? String(line.product_title) : null,
          salesInr: Number(line.qty_ordered ?? 0) * Number(line.unit_price ?? 0),
        }))
      );

    const [{ data: rule }, { data: partner }] = await Promise.all([
      supabase.from('commission_master').select('*').eq('category_key', categoryKey).maybeSingle(),
      supabase.from('partners').select('reliability_score, commission_eligible').eq('id', input.partnerId).single(),
    ]);
    if (!rule || rule.rule_type === 'none') return null;
    if (!partner?.commission_eligible) return null;

    const ownership = await farmerOwnershipService.getOwnership(input.farmerId);
    if (rule.requires_ownership && ownership?.customerOwnerPartnerId !== input.partnerId) return null;

    const period = asOf ? String(asOf).slice(0, 7) : monthKey();
    const kpiScore = await partnerKpiScore(input.partnerId, period);
    if (kpiScore < Number(rule.requires_reliability_min ?? 50)) return null;

    const bands = await earningRulesService.partnerKpiBands(asOf ? new Date(asOf) : undefined);
    const kpiFactor = partnerKpiFactor(kpiScore, bands);

    const { channelPoolService } = await import('../pricing/channel-pool.service.js');
    let commission = 0;
    let usedPool = false;
    let snapshotPct: number | null = null;
    let snapshotAgroPct: number | null = null;
    let snapshotPartnerPct: number | null = null;
    let snapshotVersionId: string | null = null;
    let snapshotLabel: string | null = null;
    let pooledSales = 0;

    for (const line of orderLines ?? []) {
      const sales = Number(line.qty_ordered ?? 0) * Number(line.unit_price ?? 0);
      const snap = await channelPoolService.snapshotForLine({
        sku: line.sku ? String(line.sku) : null,
        asOf,
        salesInr: sales,
        existing: {
          channelPoolPct: line.channel_pool_pct == null ? null : Number(line.channel_pool_pct),
          channelPoolAgronomistPct:
            line.channel_pool_agronomist_pct == null ? null : Number(line.channel_pool_agronomist_pct),
          channelPoolPartnerPct:
            line.channel_pool_partner_pct == null ? null : Number(line.channel_pool_partner_pct),
          channelPoolVersionId: line.channel_pool_version_id
            ? String(line.channel_pool_version_id)
            : null,
          channelPoolVersionLabel: line.channel_pool_version_label
            ? String(line.channel_pool_version_label)
            : null,
        },
      });
      if (snap.channelPoolPct != null) {
        usedPool = true;
        pooledSales += sales;
        const split = resolvePoolSplit({
          poolPct: snap.channelPoolPct,
          agronomistMaxPct: snap.channelPoolAgronomistPct,
          partnerMaxPct: snap.channelPoolPartnerPct,
        });
        commission += partnerIncentiveInr({
          eligibleItemInr: sales,
          partnerPoolPct: split.partnerMaxPct,
          kpiFactor,
        });
        snapshotPct = split.poolPct;
        snapshotAgroPct = split.agronomistMaxPct;
        snapshotPartnerPct = split.partnerMaxPct;
        snapshotVersionId = snap.channelPoolVersionId;
        snapshotLabel = snap.channelPoolVersionLabel;
      }
    }

    if (!usedPool) {
      if (rule.rule_type === 'fixed_inr') commission = Number(rule.fixed_inr ?? 0) * kpiFactor;
      else if (rule.rule_type === 'fixed_pct') {
        commission = partnerIncentiveInr({
          eligibleItemInr: input.grossInr,
          partnerPoolPct: Number(rule.rate_pct ?? 0),
          kpiFactor,
        });
      } else if (rule.rule_type === 'lead_bonus_only') commission = Number(rule.fixed_inr ?? 500) * kpiFactor;
    } else {
      const remainder = Math.max(0, input.grossInr - pooledSales);
      if (remainder > 0 && rule.rule_type === 'fixed_pct') {
        commission += partnerIncentiveInr({
          eligibleItemInr: remainder,
          partnerPoolPct: Number(rule.rate_pct ?? 0),
          kpiFactor,
        });
      }
    }
    commission = Math.round(commission * 100) / 100;

    const { data, error } = await supabase
      .from('partner_earnings_ledger')
      .insert({
        partner_id: input.partnerId,
        farmer_id: input.farmerId,
        order_id: input.orderId,
        category_key: categoryKey,
        gross_inr: input.grossInr,
        commission_inr: commission,
        bonus_inr: 0,
        reliability_hold_pct: 0,
        kpi_factor: kpiFactor,
        earning_kind: 'sales_incentive',
        attributed_agronomist_email: order?.attributed_agronomist_email ?? null,
        status: 'pending',
        period_month: period,
        channel_pool_pct: snapshotPct,
        channel_pool_agronomist_pct: snapshotAgroPct,
        channel_pool_partner_pct: snapshotPartnerPct,
        channel_pool_version_id: snapshotVersionId,
        channel_pool_version_label: snapshotLabel,
        metadata: {
          channelPoolApplied: usedPool,
          channelPoolPct: snapshotPct,
          channelPoolAgronomistPct: snapshotAgroPct,
          channelPoolPartnerPct: snapshotPartnerPct,
          channelPoolVersion: snapshotLabel,
          kpiScore,
          kpiFactor,
        },
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record commission');

    if (data?.id && commission > 0) {
      await settlementService.createForEarning({
        partyType: 'partner',
        partyId: input.partnerId,
        earningSource: 'partner_ledger',
        earningId: String(data.id),
        earningMonth: period,
        earningType: 'sales_incentive',
        grossInr: commission,
      });
    }

    if (isCommercialOrder(input.grossInr) && categoryKey !== 'commercial_order') {
      const { data: commercialRule } = await supabase
        .from('commission_master')
        .select('*')
        .eq('category_key', 'commercial_order')
        .maybeSingle();
      if (
        commercialRule &&
        commercialRule.rule_type === 'lead_bonus_only' &&
        kpiScore >= Number(commercialRule.requires_reliability_min ?? 85)
      ) {
        const bonus = Number(commercialRule.fixed_inr ?? 500);
        const { data: bonusRow } = await supabase
          .from('partner_earnings_ledger')
          .insert({
            partner_id: input.partnerId,
            farmer_id: input.farmerId,
            order_id: input.orderId,
            category_key: 'commercial_order',
            gross_inr: input.grossInr,
            commission_inr: 0,
            bonus_inr: bonus,
            reliability_hold_pct: 0,
            kpi_factor: 1,
            earning_kind: 'lead_bonus',
            status: 'pending',
            period_month: period,
            metadata: { leadBonus: true },
          })
          .select('id')
          .maybeSingle();
        if (bonusRow?.id && bonus > 0) {
          await settlementService.createForEarning({
            partyType: 'partner',
            partyId: input.partnerId,
            earningSource: 'partner_ledger',
            earningId: String(bonusRow.id),
            earningMonth: period,
            earningType: 'lead_bonus',
            grossInr: bonus,
          });
        }
      }
    }

    return data;
  },

  async addSuccessBonus(partnerId: string, farmerId: string, bonusInr: number) {
    const { data, error } = await supabase
      .from('partner_earnings_ledger')
      .insert({
        partner_id: partnerId,
        farmer_id: farmerId,
        category_key: 'success_bonus',
        gross_inr: 0,
        commission_inr: 0,
        bonus_inr: bonusInr,
        reliability_hold_pct: 0,
        earning_kind: 'success_bonus',
        status: 'pending',
        period_month: monthKey(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record success bonus');
    return data;
  },
};
