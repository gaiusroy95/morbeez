import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { eventBus } from '../../events/bus.js';
import { farmerService } from '../farmer/farmer.service.js';
import { normalizePhone } from '../../lib/phone.js';
import { STAGE_RANK } from '../../domain/marketing/lead-attribution.js';
const PRIORITY_RANK = {
    low: 1,
    normal: 2,
    high: 3,
    urgent: 4,
};
function stageRank(stage) {
    return STAGE_RANK[stage ?? 'new_lead'] ?? 0;
}
function priorityRank(priority) {
    return PRIORITY_RANK[priority ?? 'normal'] ?? 2;
}
function phoneVariants(phone) {
    const normalized = normalizePhone(phone);
    const variants = new Set([normalized, phone.trim()]);
    if (normalized.length === 12 && normalized.startsWith('91')) {
        variants.add(normalized.slice(2));
        variants.add(`+${normalized}`);
        variants.add(`+91${normalized.slice(2)}`);
    }
    if (/^\d{10}$/.test(normalized)) {
        variants.add(`91${normalized}`);
    }
    return [...variants].filter(Boolean);
}
async function findFarmerIdByPhone(phone) {
    const variants = phoneVariants(phone);
    const { data, error } = await supabase
        .from('farmers')
        .select('id')
        .in('phone', variants)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not resolve farmer by phone');
    return data?.id ? String(data.id) : null;
}
function signupNotes(input) {
    const channelLabel = input.channel === 'mobile'
        ? 'Morbeez mobile app'
        : input.channel === 'shopify'
            ? 'Shopify customer account'
            : 'Morbeez Shopify website';
    return [
        `Registered on ${channelLabel}`,
        input.name?.trim() ? `Name: ${input.name.trim()}` : null,
        input.email ? `Email: ${input.email}` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}
/** One CRM lead per farmer — returns existing or creates. */
export const leadService = {
    /**
     * Website / mobile / Shopify customer signup → telecaller lead list.
     * Merges into an existing lead when the phone already has one (e.g. WhatsApp capture).
     */
    async upsertSignupLead(input) {
        const phone = normalizePhone(input.phone);
        const channel = input.channel ?? 'website';
        let farmerId = input.farmerId;
        const farmerByPhone = await findFarmerIdByPhone(phone);
        if (farmerByPhone)
            farmerId = farmerByPhone;
        const { lead, created } = await this.ensureLeadForFarmer({
            farmerId,
            intent: 'general',
            source: channel === 'mobile' ? 'web' : 'shopify',
            status: 'new',
            stage: 'new_lead',
            priority: 'normal',
            notes: signupNotes({ channel, name: input.name, email: input.email }),
            mergeNotes: true,
            lead_channel: input.leadChannel ?? (channel === 'mobile' ? 'organic' : 'organic'),
            campaign_source: input.campaignSource ?? input.utmCampaign ?? null,
            utm_campaign: input.utmCampaign ?? null,
            utm_source: input.utmSource ?? null,
            utm_medium: input.utmMedium ?? null,
        });
        return { lead, created, merged: !created };
    },
    /** @deprecated Use upsertSignupLead — kept for callers during rollout */
    async createWebsiteSignupLeadIfAbsent(input) {
        const result = await this.upsertSignupLead({ ...input, channel: 'website' });
        return { created: result.created };
    },
    async ensureLeadForFarmer(input) {
        const now = new Date().toISOString();
        const { data: existing, error: loadErr } = await supabase
            .from('leads')
            .select('*')
            .eq('farmer_id', input.farmerId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (loadErr)
            throw loadErr;
        if (existing) {
            const patch = {
                updated_at: now,
                last_interaction_at: now,
            };
            if (input.intent && input.intent !== 'general')
                patch.intent = input.intent;
            if (input.source)
                patch.source = input.source;
            if (input.status)
                patch.status = input.status;
            if (input.stage && stageRank(input.stage) >= stageRank(String(existing.stage))) {
                patch.stage = input.stage;
            }
            const nextPriority = input.priority && priorityRank(input.priority) > priorityRank(String(existing.priority))
                ? input.priority
                : null;
            if (nextPriority)
                patch.priority = nextPriority;
            if (input.assigned_to !== undefined)
                patch.assigned_to = input.assigned_to;
            if (input.follow_up_at !== undefined)
                patch.follow_up_at = input.follow_up_at;
            if (input.campaign_source)
                patch.campaign_source = input.campaign_source;
            if (input.referral_source)
                patch.referral_source = input.referral_source;
            if (input.affiliate_source)
                patch.affiliate_source = input.affiliate_source;
            if (input.whatsapp_profile_name)
                patch.whatsapp_profile_name = input.whatsapp_profile_name;
            if (input.lead_channel)
                patch.lead_channel = input.lead_channel;
            if (input.marketing_owner_id !== undefined)
                patch.marketing_owner_id = input.marketing_owner_id;
            if (input.marketing_owner_name !== undefined)
                patch.marketing_owner_name = input.marketing_owner_name;
            if (input.utm_campaign)
                patch.utm_campaign = input.utm_campaign;
            if (input.utm_source)
                patch.utm_source = input.utm_source;
            if (input.utm_medium)
                patch.utm_medium = input.utm_medium;
            if (input.notes) {
                patch.notes = input.mergeNotes
                    ? [existing.notes, input.notes].filter(Boolean).join('\n')
                    : input.notes;
            }
            const { data: updated, error: updErr } = await supabase
                .from('leads')
                .update(patch)
                .eq('id', existing.id)
                .select()
                .single();
            if (updErr)
                throw updErr;
            return { lead: updated, created: false };
        }
        const { data, error } = await supabase
            .from('leads')
            .insert({
            farmer_id: input.farmerId,
            intent: input.intent ?? 'general',
            source: input.source ?? 'api',
            status: input.status ?? 'new',
            stage: input.stage ?? 'new_lead',
            priority: input.priority ?? (input.intent === 'callback' ? 'high' : 'normal'),
            notes: input.notes ?? null,
            assigned_to: input.assigned_to ?? null,
            follow_up_at: input.follow_up_at ?? null,
            campaign_source: input.campaign_source ?? null,
            referral_source: input.referral_source ?? null,
            affiliate_source: input.affiliate_source ?? null,
            whatsapp_profile_name: input.whatsapp_profile_name ?? null,
            lead_channel: input.lead_channel ?? null,
            marketing_owner_id: input.marketing_owner_id ?? null,
            marketing_owner_name: input.marketing_owner_name ?? null,
            utm_campaign: input.utm_campaign ?? null,
            utm_source: input.utm_source ?? null,
            utm_medium: input.utm_medium ?? null,
            last_interaction_at: now,
        })
            .select()
            .single();
        if (error)
            throw error;
        await eventBus.publish('lead.created', {
            leadId: data.id,
            farmerId: input.farmerId,
            intent: data.intent,
            source: input.source ?? 'api',
            assignedTo: input.assigned_to ?? null,
        }, 'crm');
        return { lead: data, created: true };
    },
    async createLead(input) {
        const farmer = await farmerService.upsertByPhone({
            phone: input.phone,
            name: input.name,
            district: input.district,
            source: input.source,
        });
        if (input.cropType) {
            await farmerService.addCrop(farmer.id, { cropType: input.cropType, isPrimary: true });
        }
        const { lead, created } = await this.ensureLeadForFarmer({
            farmerId: farmer.id,
            intent: input.intent,
            source: input.source,
            status: 'new',
            stage: 'new_lead',
            priority: input.intent === 'callback' ? 'high' : 'normal',
            notes: input.notes,
            mergeNotes: true,
            lead_channel: input.leadChannel ?? null,
            campaign_source: input.campaignSource ?? null,
            marketing_owner_id: input.marketingOwnerId ?? null,
            marketing_owner_name: input.marketingOwnerName ?? null,
            utm_campaign: input.utmCampaign ?? null,
            utm_source: input.utmSource ?? null,
            utm_medium: input.utmMedium ?? null,
        });
        if (input.intent === 'quotation' && created) {
            await supabase.from('quotation_inquiries').insert({
                farmer_id: farmer.id,
                lead_id: String(lead.id),
                status: 'pending',
                request_notes: input.notes,
            });
            await eventBus.publish('quotation.requested', { leadId: lead.id, farmerId: farmer.id }, 'crm');
        }
        return { lead, farmer };
    },
    async listLeads(status, limit = 50) {
        let q = supabase
            .from('leads')
            .select('*, farmers(phone, name, district)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (status)
            q = q.eq('status', status);
        const { data, error } = await q;
        if (error)
            throw error;
        return data;
    },
};
//# sourceMappingURL=lead.service.js.map