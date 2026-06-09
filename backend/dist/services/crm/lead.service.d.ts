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
    /** Append notes to existing lead instead of replacing. */
    mergeNotes?: boolean;
};
/** One CRM lead per farmer — returns existing or creates. */
export declare const leadService: {
    /**
     * Shopify website registration → telecaller lead list.
     * Skips when a lead already exists for the same phone (e.g. prior WhatsApp capture).
     */
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
    }): Promise<{
        lead: Record<string, unknown>;
        farmer: any;
    }>;
    listLeads(status?: string, limit?: number): Promise<any[]>;
};
//# sourceMappingURL=lead.service.d.ts.map