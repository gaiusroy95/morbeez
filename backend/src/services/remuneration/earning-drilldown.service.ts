import { supabase } from '../../lib/supabase.js';
import {
  addToBucket,
  emptyBuckets,
  lastNMonths,
  type MonthBucket,
} from '../../domain/remuneration/earning-drilldown.js';
import { settlementService } from './settlement.service.js';

export const earningDrilldownService = {
  lastThreeMonths(asOf = new Date()) {
    return lastNMonths(3, asOf);
  },

  async forParty(partyType: 'partner' | 'employee', partyId: string, months = lastNMonths(3)) {
    const buckets = emptyBuckets(months);

    const { data: settlements } = await supabase
      .from('earning_settlements')
      .select('earning_month, amount_inr, final_payable_inr, status, fraud_hold, payable_on')
      .eq('party_type', partyType)
      .eq('party_id', partyId)
      .in('earning_month', months);

    const today = new Date().toISOString().slice(0, 10);
    for (const row of settlements ?? []) {
      const month = String(row.earning_month);
      const amount = Number(row.final_payable_inr ?? row.amount_inr ?? 0);
      addToBucket(buckets, month, 'earned', Number(row.amount_inr ?? 0));
      if (row.fraud_hold) addToBucket(buckets, month, 'held', amount);
      else if (row.status === 'paid') addToBucket(buckets, month, 'paid', amount);
      else if (
        (row.status === 'pending' || row.status === 'approved') &&
        String(row.payable_on ?? '') <= today
      ) {
        addToBucket(buckets, month, 'due', amount);
      }
    }

    const dueNow = await settlementService.dueTotalInr(partyType, partyId);
    const heldNow = (settlements ?? [])
      .filter((r) => r.fraud_hold && r.status !== 'paid' && r.status !== 'cancelled')
      .reduce((s, r) => s + Number(r.final_payable_inr ?? r.amount_inr ?? 0), 0);

    return {
      months: buckets,
      dueNow,
      heldNow: Math.round(heldNow * 100) / 100,
    };
  },
};

export type { MonthBucket };
