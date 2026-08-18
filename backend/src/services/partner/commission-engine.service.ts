import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';
import {
  dominantCategory,
  isCommercialOrder,
  reliabilityHoldPct,
} from '../../domain/remuneration/commission-category.js';

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
      .limit(1)
      .maybeSingle();
    if (already?.id) return null;

    const { data: order } = await supabase
      .from('commerce_orders')
      .select('id, created_at')
      .eq('id', input.orderId)
      .maybeSingle();
    const asOf = order?.created_at ? String(order.created_at).slice(0, 10) : undefined;
    const { data: orderLines } = await supabase
      .from('commerce_order_lines')
      .select(
        'sku, product_title, qty_ordered, unit_price, channel_pool_pct, channel_pool_version_id, channel_pool_version_label'
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

    const relScore = Number(partner.reliability_score ?? 70);
    if (relScore < Number(rule.requires_reliability_min ?? 50)) return null;

    const { channelPoolService } = await import('../pricing/channel-pool.service.js');
    let pooledCommission = 0;
    let pooledSales = 0;
    let usedPool = false;
    let snapshotPct: number | null = null;
    let snapshotVersionId: string | null = null;
    let snapshotLabel: string | null = null;

    for (const line of orderLines ?? []) {
      const sales = Number(line.qty_ordered ?? 0) * Number(line.unit_price ?? 0);
      const snap = await channelPoolService.snapshotForLine({
        sku: line.sku ? String(line.sku) : null,
        asOf,
        salesInr: sales,
        existing: {
          channelPoolPct: line.channel_pool_pct == null ? null : Number(line.channel_pool_pct),
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
        pooledCommission += snap.channelPoolAmount ?? 0;
        pooledSales += sales;
        snapshotPct = snap.channelPoolPct;
        snapshotVersionId = snap.channelPoolVersionId;
        snapshotLabel = snap.channelPoolVersionLabel;
      }
    }

    let commission = 0;
    if (usedPool) {
      commission = pooledCommission;
      const remainder = Math.max(0, input.grossInr - pooledSales);
      if (remainder > 0 && rule.rule_type === 'fixed_pct') {
        commission += (remainder * Number(rule.rate_pct ?? 0)) / 100;
      }
      commission = Math.round(commission * 100) / 100;
    } else if (rule.rule_type === 'fixed_inr') commission = Number(rule.fixed_inr ?? 0);
    else if (rule.rule_type === 'fixed_pct') commission = (input.grossInr * Number(rule.rate_pct ?? 0)) / 100;
    else if (rule.rule_type === 'lead_bonus_only') commission = Number(rule.fixed_inr ?? 500);

    const holdPct = reliabilityHoldPct(relScore);
    const status = holdPct >= 100 ? 'held' : 'pending';

    const { data, error } = await supabase
      .from('partner_earnings_ledger')
      .insert({
        partner_id: input.partnerId,
        farmer_id: input.farmerId,
        order_id: input.orderId,
        category_key: categoryKey,
        gross_inr: input.grossInr,
        commission_inr: Math.round(commission * 100) / 100,
        bonus_inr: 0,
        reliability_hold_pct: holdPct,
        status,
        period_month: monthKey(),
        channel_pool_pct: snapshotPct,
        channel_pool_version_id: snapshotVersionId,
        channel_pool_version_label: snapshotLabel,
        metadata: usedPool
          ? { channelPoolApplied: true, channelPoolPct: snapshotPct, channelPoolVersion: snapshotLabel }
          : {},
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record commission');

    if (isCommercialOrder(input.grossInr) && categoryKey !== 'commercial_order') {
      const { data: commercialRule } = await supabase
        .from('commission_master')
        .select('*')
        .eq('category_key', 'commercial_order')
        .maybeSingle();
      if (
        commercialRule &&
        commercialRule.rule_type === 'lead_bonus_only' &&
        relScore >= Number(commercialRule.requires_reliability_min ?? 85)
      ) {
        await supabase.from('partner_earnings_ledger').insert({
          partner_id: input.partnerId,
          farmer_id: input.farmerId,
          order_id: input.orderId,
          category_key: 'commercial_order',
          gross_inr: input.grossInr,
          commission_inr: 0,
          bonus_inr: Number(commercialRule.fixed_inr ?? 500),
          reliability_hold_pct: 0,
          status: 'pending',
          period_month: monthKey(),
          metadata: { leadBonus: true },
        });
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
        status: 'pending',
        period_month: monthKey(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record success bonus');
    return data;
  },
};
