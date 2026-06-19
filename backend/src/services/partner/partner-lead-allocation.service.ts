import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { partnerSettingsService } from './partner-settings.service.js';
import { partnerService } from './partner.service.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';
import { partnerAttributionCaptureService } from './partner-attribution-capture.service.js';

function tierBoost(tier: string): number {
  if (tier === 'master') return 1.4;
  if (tier === 'senior') return 1.25;
  if (tier === 'certified') return 1.1;
  return 1;
}

export const partnerLeadAllocationService = {
  async scorePartner(partnerId: string): Promise<number> {
    const partner = await partnerService.getById(partnerId);
    if (!partner || partner.status !== 'active') return 0;

    const weights = await partnerSettingsService.get('lead_allocation');
    const w = weights.weights as Record<string, number> | undefined;
    const relW = Number(w?.reliability ?? 0.25);
    const perfW = Number(w?.performance ?? 0.2);
    const capW = Number(w?.capacity ?? 0.15);
    const tierW = Number(w?.tier ?? 0.2);
    const dataW = Number(w?.dataQuality ?? 0.1);
    const retW = Number(w?.retention ?? 0.1);

    const headroom =
      partner.maxActiveFarmers > 0
        ? (partner.maxActiveFarmers - partner.currentActiveFarmers) / partner.maxActiveFarmers
        : 0;
    if (headroom <= 0) return 0;

    const score =
      partner.reliabilityScore * relW +
      partner.performanceScore * perfW +
      headroom * 100 * capW +
      tierBoost(partner.tier) * 20 * tierW +
      partner.reliabilityScore * dataW * 0.5 +
      partner.performanceScore * retW * 0.5;

    return Math.round(score * 100) / 100;
  },

  async allocateLeadToPartners(leadId: string, farmerId?: string | null, limit = 3) {
    let territoryPartnerIds: string[] | null = null;
    if (farmerId) {
      const { data: farmerRow } = await supabase
        .from('farmers')
        .select('pincode')
        .eq('id', farmerId)
        .maybeSingle();
      const pincode = farmerRow?.pincode ? String(farmerRow.pincode) : null;
      if (pincode) {
        const { partnerTerritoryService } = await import('./partner-events.service.js');
        const ids = await partnerTerritoryService.partnerIdsForPincode(pincode);
        if (ids.length) territoryPartnerIds = ids;
      }
    }

    let q = supabase.from('partners').select('id').eq('status', 'active');
    if (territoryPartnerIds?.length) q = q.in('id', territoryPartnerIds);
    const { data: partners, error } = await q;
    throwIfSupabaseError(error, 'Could not load partners');

    const scored = await Promise.all(
      (partners ?? []).map(async (p) => ({
        partnerId: String(p.id),
        score: await this.scorePartner(String(p.id)),
      }))
    );

    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score > 0).slice(0, limit);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const rows = [];
    for (const item of top) {
      const { data, error: insErr } = await supabase
        .from('partner_lead_allocations')
        .insert({
          partner_id: item.partnerId,
          lead_id: leadId,
          farmer_id: farmerId ?? null,
          allocation_score: item.score,
          status: 'offered',
          expires_at: expiresAt,
        })
        .select('*')
        .single();
      throwIfSupabaseError(insErr, 'Could not create lead allocation');
      rows.push(data);
    }
    return rows;
  },

  async respond(allocationId: string, partnerId: string, action: 'accepted' | 'declined') {
    const { data, error } = await supabase
      .from('partner_lead_allocations')
      .update({
        status: action,
        responded_at: new Date().toISOString(),
      })
      .eq('id', allocationId)
      .eq('partner_id', partnerId)
      .eq('status', 'offered')
      .select('*, leads(farmer_id)')
      .single();
    throwIfSupabaseError(error, 'Could not respond to lead offer');

    if (action === 'accepted' && data) {
      const leadRel = data.leads as { farmer_id?: string } | null;
      const farmerId =
        data.farmer_id != null
          ? String(data.farmer_id)
          : leadRel?.farmer_id
            ? String(leadRel.farmer_id)
            : null;
      if (farmerId) {
        await farmerOwnershipService.changeCustomerOwner({
          farmerId,
          customerOwnerType: 'partner',
          customerOwnerPartnerId: partnerId,
          serviceModel: 'partner_assisted',
          assignedPartnerId: partnerId,
          reason: 'lead_allocation_accepted',
          changedBy: partnerId,
        });
        await partnerAttributionCaptureService.upsertTouch({
          farmerId,
          partnerId,
          attributionType: 'enrollment',
          metadata: { source: 'lead_allocation', allocationId },
        });
        await partnerService.incrementActiveFarmers(partnerId, 1);
      }
    }

    return data;
  },

  async listOffers(partnerId: string) {
    const { data, error } = await supabase
      .from('partner_lead_allocations')
      .select('*, leads(id, farmer_id, stage, priority), farmers(name, phone, district)')
      .eq('partner_id', partnerId)
      .eq('status', 'offered')
      .order('offered_at', { ascending: false });
    throwIfSupabaseError(error, 'Could not list lead offers');
    return data ?? [];
  },
};
