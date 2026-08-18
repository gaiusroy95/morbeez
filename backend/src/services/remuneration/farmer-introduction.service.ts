import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';
import { evaluateIntroduction } from '../../domain/remuneration/introduction-eligibility.js';
import { earningRulesService } from './earning-rules.service.js';
import { settlementService } from './settlement.service.js';

function hoursBetween(fromIso: string, to = new Date()): number {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 0;
  return (to.getTime() - t) / 36e5;
}

async function farmerAcreage(farmerId: string): Promise<number> {
  const { data: farmer } = await supabase
    .from('farmers')
    .select('total_acreage')
    .eq('id', farmerId)
    .maybeSingle();
  const total = Number(farmer?.total_acreage ?? 0);
  const { data: blocks } = await supabase
    .from('farm_blocks')
    .select('acreage_decimal')
    .eq('farmer_id', farmerId);
  const fromBlocks = (blocks ?? []).reduce((s, b) => s + Number(b.acreage_decimal ?? 0), 0);
  return Math.max(total, fromBlocks);
}

async function collectFacts(input: {
  farmerId: string;
  partnerId: string;
  introductionId?: string;
  existingFarmerHours: number;
}) {
  const { data: farmer } = await supabase
    .from('farmers')
    .select(
      'id, phone, name, village, district, created_at, assigned_crop_advisor, enrollment_owner_partner_id, source'
    )
    .eq('id', input.farmerId)
    .maybeSingle();
  if (!farmer?.id) {
    return null;
  }

  const createdAt = farmer.created_at ? String(farmer.created_at) : new Date().toISOString();
  const newFarmer = hoursBetween(createdAt) <= input.existingFarmerHours;

  const phone = farmer.phone ? String(farmer.phone) : '';
  let duplicateMobile = false;
  if (phone) {
    const { count } = await supabase
      .from('farmers')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .neq('id', input.farmerId);
    duplicateMobile = (count ?? 0) > 0;
  }

  let dupQuery = supabase
    .from('farmer_introductions')
    .select('id', { count: 'exact', head: true })
    .eq('farmer_id', input.farmerId)
    .neq('partner_id', input.partnerId)
    .neq('qualification_status', 'rejected');
  if (input.introductionId) dupQuery = dupQuery.neq('id', input.introductionId);
  const { count: otherClaims } = await dupQuery;
  const duplicatePartnerClaim = (otherClaims ?? 0) > 0;

  const acreage = await farmerAcreage(input.farmerId);
  const name = String(farmer.name ?? '').trim();
  const farmerVerified = Boolean(
    phone && name && !/^Farmer\s+\d{4}$/i.test(name) && (farmer.village || farmer.district)
  );

  const { data: visit } = await supabase
    .from('crm_field_findings')
    .select('id, photo_urls, agronomist_name, partner_id')
    .eq('farmer_id', input.farmerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: session } = await supabase
    .from('agronomist_visit_sessions')
    .select('id, check_out_lat, check_in_lat')
    .eq('farmer_id', input.farmerId)
    .not('check_out_lat', 'is', null)
    .limit(1)
    .maybeSingle();

  const photos = Array.isArray(visit?.photo_urls) ? visit.photo_urls : [];
  const fieldVerified = Boolean(visit?.id || session?.id || acreage > 0);
  const evidenceComplete = photos.length > 0 || Boolean(session?.check_out_lat) || acreage > 0;

  const agroEmail = farmer.assigned_crop_advisor ? String(farmer.assigned_crop_advisor) : '';
  const { count: recs } = await supabase
    .from('recommendation_records')
    .select('id', { count: 'exact', head: true })
    .eq('farmer_id', input.farmerId);
  const agronomistEngaged = Boolean(agroEmail && (visit?.id || (recs ?? 0) > 0 || session?.id));

  const enrollmentPartner = farmer.enrollment_owner_partner_id
    ? String(farmer.enrollment_owner_partner_id)
    : '';
  const existingOwnedByOther =
    Boolean(enrollmentPartner) && enrollmentPartner !== input.partnerId && !newFarmer;

  return {
    phone,
    location: [farmer.village, farmer.district].filter(Boolean).join(', '),
    agroEmail,
    acreage,
    facts: {
      newFarmer: newFarmer && !existingOwnedByOther,
      duplicateMobile,
      duplicatePartnerClaim,
      acreage,
      farmerVerified,
      fieldVerified,
      evidenceComplete,
      agronomistEngaged,
      fraud: false,
    },
  };
}

async function creditCash(intro: {
  id: string;
  partner_id: string;
  farmer_id: string;
  cash_reward_amount: number;
}) {
  const amount = Number(intro.cash_reward_amount ?? 0);
  if (amount <= 0) return;
  const { data: already } = await supabase
    .from('partner_earnings_ledger')
    .select('id')
    .eq('introduction_id', intro.id)
    .eq('earning_kind', 'intro_cash')
    .maybeSingle();
  if (already?.id) return;

  const period = periodMonth();
  const { data, error } = await supabase
    .from('partner_earnings_ledger')
    .insert({
      partner_id: intro.partner_id,
      farmer_id: intro.farmer_id,
      introduction_id: intro.id,
      category_key: 'farmer_introduction',
      earning_kind: 'intro_cash',
      gross_inr: 0,
      commission_inr: 0,
      bonus_inr: amount,
      reliability_hold_pct: 0,
      kpi_factor: 1,
      status: 'pending',
      period_month: period,
      metadata: { introductionId: intro.id, cashReward: true },
    })
    .select('id')
    .maybeSingle();
  if (error && error.code !== '23505') {
    logger.warn({ err: error, introductionId: intro.id }, 'Intro cash credit skipped');
    return;
  }
  const earningId = data?.id ? String(data.id) : already?.id ? String(already.id) : '';
  if (!earningId) return;
  await supabase
    .from('farmer_introductions')
    .update({
      cash_rewarded_at: new Date().toISOString(),
      partner_earning_id: earningId,
      settlement_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', intro.id);
  await settlementService.createForEarning({
    partyType: 'partner',
    partyId: String(intro.partner_id),
    earningSource: 'partner_ledger',
    earningId,
    earningMonth: period,
    earningType: 'intro_cash',
    grossInr: amount,
  });
}

export const farmerIntroductionService = {
  async createFromEnrollment(input: {
    farmerId: string;
    partnerId: string;
    mobile?: string | null;
    source?: string;
  }) {
    const { data: existing } = await supabase
      .from('farmer_introductions')
      .select('id')
      .eq('partner_id', input.partnerId)
      .eq('farmer_id', input.farmerId)
      .maybeSingle();
    if (existing?.id) {
      await this.refresh(String(existing.id));
      return existing;
    }

    const { data: farmer } = await supabase
      .from('farmers')
      .select('phone, created_at, assigned_crop_advisor, village, district')
      .eq('id', input.farmerId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('farmer_introductions')
      .insert({
        partner_id: input.partnerId,
        farmer_id: input.farmerId,
        farmer_mobile: input.mobile || farmer?.phone || null,
        location: [farmer?.village, farmer?.district].filter(Boolean).join(', ') || null,
        agronomist_email: farmer?.assigned_crop_advisor ?? null,
        registration_date: farmer?.created_at
          ? String(farmer.created_at).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        notes: input.source ?? null,
      })
      .select('id')
      .maybeSingle();
    if (error && error.code !== '23505') {
      logger.warn({ err: error, farmerId: input.farmerId }, 'Could not create farmer introduction');
      return null;
    }
    const id = data?.id ? String(data.id) : existing?.id ? String(existing.id) : '';
    if (!id) return null;
    await this.refresh(id);
    return { id };
  },

  async refresh(introductionId: string) {
    const { data: intro } = await supabase
      .from('farmer_introductions')
      .select('*')
      .eq('id', introductionId)
      .maybeSingle();
    if (!intro?.id) return null;
    if (['rejected', 'fraud_hold'].includes(String(intro.qualification_status))) return intro;

    const rule = await earningRulesService.introductionRule();
    const packed = await collectFacts({
      farmerId: String(intro.farmer_id),
      partnerId: String(intro.partner_id),
      introductionId: String(intro.id),
      existingFarmerHours: rule.existingFarmerHours,
    });
    if (!packed) return intro;

    const result = evaluateIntroduction(packed.facts, rule);
    const alreadyEligible = intro.qualification_status === 'eligible';
    const productMax = alreadyEligible
      ? Number(intro.product_reward_max ?? result.productMax)
      : result.productMax;
    const used = Number(intro.product_reward_used ?? 0);
    const patch = {
      acreage: packed.facts.acreage,
      farmer_mobile: packed.phone || intro.farmer_mobile,
      location: packed.location || intro.location,
      existing_farmer: !packed.facts.newFarmer,
      duplicate_mobile: packed.facts.duplicateMobile,
      duplicate_claim: packed.facts.duplicatePartnerClaim,
      farmer_verified: packed.facts.farmerVerified,
      field_verified: packed.facts.fieldVerified,
      evidence_verified: packed.facts.evidenceComplete,
      agronomist_email: packed.agroEmail || intro.agronomist_email,
      agronomist_engagement_status: packed.facts.agronomistEngaged
        ? 'engaged'
        : packed.agroEmail
          ? 'assigned'
          : 'none',
      qualification_status: alreadyEligible ? 'eligible' : result.status,
      pending_reasons: alreadyEligible ? [] : result.reasons,
      cash_reward_eligible: alreadyEligible || result.cashEligible,
      cash_reward_amount:
        alreadyEligible || result.cashEligible
          ? Number(intro.cash_reward_amount) || result.cashAmount
          : 0,
      product_reward_eligible: alreadyEligible || result.productEligible,
      product_reward_max: productMax,
      product_reward_balance: Math.round((productMax - used) * 100) / 100,
      reward_status: alreadyEligible || result.status === 'eligible' ? 'eligible' : result.status,
      rule_version_id: rule.versionId,
      updated_at: new Date().toISOString(),
    };

    await supabase.from('farmer_introductions').update(patch).eq('id', introductionId);
    const next = { ...intro, ...patch };
    if ((alreadyEligible || result.cashEligible) && !intro.cash_rewarded_at) {
      await creditCash({
        id: String(intro.id),
        partner_id: String(intro.partner_id),
        farmer_id: String(intro.farmer_id),
        cash_reward_amount: Number(next.cash_reward_amount),
      });
    }
    return next;
  },

  async refreshForFarmer(farmerId: string) {
    const { data } = await supabase
      .from('farmer_introductions')
      .select('id')
      .eq('farmer_id', farmerId)
      .in('qualification_status', ['pending', 'review']);
    for (const row of data ?? []) {
      await this.refresh(String(row.id));
    }
  },

  async scanPending(limit = 80) {
    const { data } = await supabase
      .from('farmer_introductions')
      .select('id')
      .in('qualification_status', ['pending', 'review'])
      .order('updated_at', { ascending: true })
      .limit(limit);
    for (const row of data ?? []) {
      await this.refresh(String(row.id)).catch((err) =>
        logger.warn({ err, id: row.id }, 'Introduction refresh failed')
      );
    }
    return { scanned: data?.length ?? 0 };
  },

  async list(opts?: { partnerId?: string; status?: string; limit?: number }) {
    let q = supabase
      .from('farmer_introductions')
      .select(
        'id, partner_id, farmer_id, qualification_status, acreage, cash_reward_amount, product_reward_max, product_reward_used, product_reward_balance, pending_reasons, created_at, farmer_mobile, location'
      )
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 100);
    if (opts?.partnerId) q = q.eq('partner_id', opts.partnerId);
    if (opts?.status) q = q.eq('qualification_status', opts.status);
    const { data } = await q;
    return data ?? [];
  },

  async summaryForPartner(partnerId: string) {
    const { data } = await supabase
      .from('farmer_introductions')
      .select(
        'qualification_status, cash_reward_amount, cash_rewarded_at, product_reward_max, product_reward_used, product_reward_balance'
      )
      .eq('partner_id', partnerId);
    const rows = data ?? [];
    const introduced = rows.length;
    const verified = rows.filter((r) =>
      ['eligible', 'review'].includes(String(r.qualification_status))
    ).length;
    const eligible = rows.filter((r) => r.qualification_status === 'eligible').length;
    const cashEarned = rows
      .filter((r) => r.cash_rewarded_at)
      .reduce((s, r) => s + Number(r.cash_reward_amount ?? 0), 0);
    const productMax = rows.reduce((s, r) => s + Number(r.product_reward_max ?? 0), 0);
    const productUsed = rows.reduce((s, r) => s + Number(r.product_reward_used ?? 0), 0);
    return {
      farmersIntroduced: introduced,
      farmersVerified: verified,
      eligibleIntroductions: eligible,
      cashRewardEarned: Math.round(cashEarned * 100) / 100,
      productRewardMax: Math.round(productMax * 100) / 100,
      productRewardUsed: Math.round(productUsed * 100) / 100,
      productRewardBalance: Math.round((productMax - productUsed) * 100) / 100,
    };
  },
};
