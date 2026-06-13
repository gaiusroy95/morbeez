import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { farmerTeamTimelineService } from '../crm/farmer-team-timeline.service.js';
import { telecallerAdminService } from '../admin/telecaller-admin.service.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';

export const salesOpportunityService = {
  async createForPartner(
    partnerId: string,
    farmerId: string,
    input: {
      product: string;
      expectedQuantity?: string;
      urgency?: string;
      interestLevel?: string;
      notes?: string;
    }
  ) {
    if (!env.ENABLE_SALES_OPPORTUNITIES) {
      throw new ValidationError('Sales opportunities are disabled');
    }
    const ownership = await farmerOwnershipService.getOwnership(farmerId);
    const telecallerEmail = ownership?.assignedTelecallerEmail ?? null;

    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('sales_opportunities')
      .insert({
        farmer_id: farmerId,
        partner_id: partnerId,
        lead_id: lead?.id ?? null,
        product: input.product.trim(),
        expected_quantity: input.expectedQuantity ?? null,
        urgency: input.urgency ?? null,
        interest_level: input.interestLevel ?? null,
        notes: input.notes ?? null,
        assigned_telecaller_email: telecallerEmail,
        status: 'interested',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create sales opportunity');

    if (lead?.id && telecallerEmail) {
      await telecallerAdminService.createTask(
        String(lead.id),
        {
          title: `Sales opportunity: ${input.product}`,
          notes: input.notes ?? undefined,
          taskCategory: 'other',
        },
        telecallerEmail
      );
    }

    await farmerTeamTimelineService.addSystemEntry({
      farmerId,
      title: 'Sales opportunity',
      body: `${input.product} — partner flagged farmer interest`,
      metadata: { salesOpportunityId: data.id, partnerId },
    });

    return data;
  },

  async listForPartner(partnerId: string) {
    const { data, error } = await supabase
      .from('sales_opportunities')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(100);
    throwIfSupabaseError(error, 'Could not list sales opportunities');
    return data ?? [];
  },

  async listForTelecaller(agentEmail: string) {
    const { data, error } = await supabase
      .from('sales_opportunities')
      .select('*, farmers(name, first_name, last_name, phone)')
      .eq('assigned_telecaller_email', agentEmail.toLowerCase())
      .in('status', ['interested', 'hot_lead', 'ready_to_order', 'follow_up_required'])
      .order('created_at', { ascending: false })
      .limit(50);
    throwIfSupabaseError(error, 'Could not list telecaller opportunities');
    return data ?? [];
  },

  async updateStatus(id: string, status: string, agentEmail?: string) {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('sales_opportunities')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update sales opportunity');
    if (!data) throw new NotFoundError('Sales opportunity not found');
    void agentEmail;
    return data;
  },

  async listForFarmer(farmerId: string) {
    const { data, error } = await supabase
      .from('sales_opportunities')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(30);
    throwIfSupabaseError(error, 'Could not list farmer opportunities');
    return data ?? [];
  },
};
