import type { LeadChannel } from '../../domain/marketing/lead-attribution.js';
export type EnsureLeadInput = {
    farmerId: string;
    intent?: 'quotation' | 'callback' | 'support' | 'dealer' | 'general';
    source?: string;
    status?: string;
    stage?: string;
    priority?: string;
    notes?: string;
    assigned_to?: string | null;
    follow_up_at?: string | null;
    campaign_source?: string | null;
    referral_source?: string | null;
    affiliate_source?: string | null;
    whatsapp_profile_name?: string | null;
    lead_channel?: LeadChannel | string | null;
    marketing_owner_id?: string | null;
    marketing_owner_name?: string | null;
    utm_campaign?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    /** Append notes to existing lead instead of replacing. */
    mergeNotes?: boolean;
};
/** One CRM lead per farmer — returns existing or creates. */
export declare const leadService: {
    /**
     * Website / mobile / Shopify customer signup → telecaller lead list.
     * Merges into an existing lead when the phone already has one (e.g. WhatsApp capture).
     */
    upsertSignupLead(input: {
        farmerId: string;
        phone: string;
        name?: string;
        email?: string;
        channel?: "website" | "mobile" | "shopify";
        leadChannel?: LeadChannel | string | null;
        campaignSource?: string | null;
        utmCampaign?: string | null;
        utmSource?: string | null;
        utmMedium?: string | null;
    }): Promise<{
        lead: Record<string, unknown>;
        created: boolean;
        merged: boolean;
    }>;
    /** @deprecated Use upsertSignupLead — kept for callers during rollout */
    createWebsiteSignupLeadIfAbsent(input: {
        farmerId: string;
        phone: string;
        name?: string;
        email?: string;
    }): Promise<{
        created: boolean;
    }>;
    ensureLeadForFarmer(input: EnsureLeadInput): Promise<{
        lead: Record<string, unknown>;
        created: boolean;
    }>;
    createLead(input: {
        phone: string;
        name?: string;
        intent: "quotation" | "callback" | "support" | "dealer" | "general";
        source: "web" | "whatsapp" | "shopify" | "phone";
        notes?: string;
        cropType?: string;
        district?: string;
        leadChannel?: LeadChannel | string | null;
        campaignSource?: string | null;
        marketingOwnerId?: string | null;
        marketingOwnerName?: string | null;
        utmCampaign?: string | null;
        utmSource?: string | null;
        utmMedium?: string | null;
    }): Promise<{
        lead: Record<string, unknown>;
        farmer: any;
    }>;
    listLeads(status?: string, limit?: number): Promise<any[]>;
};
//# sourceMappingURL=lead.service.d.ts.map