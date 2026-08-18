import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function aggregateRows(
    rows: Array<{
    commission_inr?: unknown;
    bonus_inr?: unknown;
    status?: unknown;
    category_key?: unknown;
    earning_kind?: unknown;
  }> | null
) {
  let productCommission = 0;
  let successBonus = 0;
  let serviceRevenue = 0;
  let cashRewards = 0;
  let pendingPayout = 0;
  let approvedPayout = 0;
  let paidPayout = 0;

  for (const row of rows ?? []) {
    const commission = Number(row.commission_inr ?? 0);
    const bonus = Number(row.bonus_inr ?? 0);
    const kind = String(row.earning_kind ?? '');
    const category = String(row.category_key ?? '');
    if (kind === 'intro_cash' || category === 'farmer_introduction') {
      cashRewards += bonus;
    } else if (category.includes('testing') || category.includes('package')) {
      serviceRevenue += commission + bonus;
    } else if (category === 'success_bonus') {
      successBonus += bonus;
    } else {
      productCommission += commission;
    }
    if (row.status === 'pending') pendingPayout += commission + bonus;
    if (row.status === 'approved') approvedPayout += commission + bonus;
    if (row.status === 'paid') paidPayout += commission + bonus;
  }

  return {
    productCommission: Math.round(productCommission),
    successBonus: Math.round(successBonus),
    cashRewards: Math.round(cashRewards),
    serviceRevenue: Math.round(serviceRevenue),
    pendingPayout: Math.round(pendingPayout),
    approvedPayout: Math.round(approvedPayout),
    paidPayout: Math.round(paidPayout),
  };
}

export const partnerEarningsService = {
  async getSummary(
    partnerId: string,
    filter: { from?: string; to?: string; month?: string } = {}
  ) {
    let q = supabase
      .from('partner_earnings_ledger')
      .select('commission_inr, bonus_inr, status, category_key, earning_kind')
      .eq('partner_id', partnerId);

    if (filter.from && filter.to) {
      q = q
        .gte('created_at', `${filter.from}T00:00:00.000Z`)
        .lte('created_at', `${filter.to}T23:59:59.999Z`);
    } else {
      const periodMonth = filter.month ?? monthKey();
      q = q.eq('period_month', periodMonth);
    }

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load earnings');

    const totals = aggregateRows(data);
    const { farmerIntroductionService } = await import(
      '../remuneration/farmer-introduction.service.js'
    );
    const intro = await farmerIntroductionService.summaryForPartner(partnerId);

    const { data: partner } = await supabase
      .from('partners')
      .select('reliability_score')
      .eq('id', partnerId)
      .single();

    const rel = Number(partner?.reliability_score ?? 70);
    const reliabilityHoldPct = rel < 50 ? 100 : rel < 70 ? 20 : 0;

    const { earningDrilldownService } = await import('../remuneration/earning-drilldown.service.js');
    const drilldown = await earningDrilldownService.forParty('partner', partnerId);

    return {
      month: filter.month ?? (filter.from ? null : monthKey()),
      fromDate: filter.from ?? null,
      toDate: filter.to ?? null,
      ...totals,
      leadBonus: 0,
      cashRewards: totals.cashRewards,
      reliabilityHoldPct,
      farmersIntroduced: intro.farmersIntroduced,
      farmersVerified: intro.farmersVerified,
      eligibleIntroductions: intro.eligibleIntroductions,
      cashRewardEarned: intro.cashRewardEarned,
      productRewardAvailable: intro.productRewardMax,
      productRewardUsed: intro.productRewardUsed,
      productRewardBalance: intro.productRewardBalance,
      heldPayout: drilldown.heldNow,
      duePayout: drilldown.dueNow,
      months: drilldown.months,
    };
  },

  async listLedger(partnerId: string, filter: { month?: string; from?: string; to?: string } = {}) {
    let q = supabase
      .from('partner_earnings_ledger')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter.from && filter.to) {
      q = q
        .gte('created_at', `${filter.from}T00:00:00.000Z`)
        .lte('created_at', `${filter.to}T23:59:59.999Z`);
    } else if (filter.month) {
      q = q.eq('period_month', filter.month);
    }
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list ledger');
    return (data ?? []).map((r) => ({
      id: String(r.id),
      category: String(r.category_key),
      grossInr: Number(r.gross_inr ?? 0),
      commissionInr: Number(r.commission_inr ?? 0),
      bonusInr: Number(r.bonus_inr ?? 0),
      status: String(r.status),
      periodMonth: String(r.period_month),
      createdAt: String(r.created_at),
    }));
  },
};
