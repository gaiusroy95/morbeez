import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';
function monthKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function reliabilityHoldPct(score) {
    if (score >= 85)
        return 0;
    if (score >= 70)
        return 0;
    if (score >= 50)
        return 20;
    return 100;
}
export const commissionEngineService = {
    async listMaster() {
        const { data, error } = await supabase.from('commission_master').select('*').eq('is_active', true);
        throwIfSupabaseError(error, 'Could not load commission master');
        return data ?? [];
    },
    async computeForOrder(input) {
        const [{ data: rule }, { data: partner }] = await Promise.all([
            supabase.from('commission_master').select('*').eq('category_key', input.categoryKey).maybeSingle(),
            supabase.from('partners').select('reliability_score, commission_eligible').eq('id', input.partnerId).single(),
        ]);
        if (!rule || rule.rule_type === 'none')
            return null;
        if (!partner?.commission_eligible)
            return null;
        const ownership = await farmerOwnershipService.getOwnership(input.farmerId);
        if (rule.requires_ownership && ownership?.customerOwnerPartnerId !== input.partnerId)
            return null;
        const relScore = Number(partner.reliability_score ?? 70);
        if (relScore < Number(rule.requires_reliability_min ?? 50))
            return null;
        let commission = 0;
        if (rule.rule_type === 'fixed_inr')
            commission = Number(rule.fixed_inr ?? 0);
        else if (rule.rule_type === 'fixed_pct')
            commission = (input.grossInr * Number(rule.rate_pct ?? 0)) / 100;
        else if (rule.rule_type === 'lead_bonus_only')
            commission = Number(rule.fixed_inr ?? 500);
        const holdPct = reliabilityHoldPct(relScore);
        const status = holdPct >= 100 ? 'held' : holdPct > 0 ? 'held' : 'pending';
        const { data, error } = await supabase
            .from('partner_earnings_ledger')
            .insert({
            partner_id: input.partnerId,
            farmer_id: input.farmerId,
            order_id: input.orderId,
            category_key: input.categoryKey,
            gross_inr: input.grossInr,
            commission_inr: Math.round(commission * 100) / 100,
            bonus_inr: 0,
            reliability_hold_pct: holdPct,
            status,
            period_month: monthKey(),
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not record commission');
        return data;
    },
    async addSuccessBonus(partnerId, farmerId, bonusInr) {
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
//# sourceMappingURL=commission-engine.service.js.map