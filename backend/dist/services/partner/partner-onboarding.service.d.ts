export declare const partnerOnboardingService: {
    submitApplication(input: {
        fullName: string;
        phone: string;
        email?: string;
        state?: string;
        district?: string;
        village?: string;
        languages?: string[];
        experienceNotes?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    /**
     * Admin "Create Partner": creates a real partners row (active), marks an
     * application as approved for audit, and sends an activation WhatsApp.
     */
    createPartnerByAdmin(input: {
        fullName: string;
        phone: string;
        email?: string;
        state?: string;
        district?: string;
        village?: string;
        languages?: string[];
        experienceNotes?: string;
        metadata?: Record<string, unknown>;
        createAppAccount?: boolean;
        sendActivation?: boolean;
    }, adminEmail: string): Promise<{
        partner: {
            id: string;
            partnerCode: string;
            fullName: string;
            phone: string;
            email: string | null;
            status: import("./partner.types.js").PartnerStatus;
            tier: import("./partner.types.js").PartnerTier;
            state: string | null;
            district: string | null;
            taluk: string | null;
            village: string | null;
            languages: string[];
            cropsExpertise: string[];
            referralSlug: string | null;
            qrToken: string | null;
            maxActiveFarmers: number;
            currentActiveFarmers: number;
            reliabilityScore: number;
            performanceScore: number;
            leadAllocationWeight: number;
            commissionEligible: boolean;
            referralUrl: string;
            territory: string | null;
            cropAdvisor: string | null;
            partnerType: string | null;
            partnerSince: string | null;
        };
        application: any;
        activation: {
            sent: boolean;
            channel: "whatsapp" | "manual";
            expiresAt: string;
            message: string;
            deliveryError: string | null;
            phone: string;
        } | null;
    }>;
    sendActivationInvite(partnerId: string): Promise<{
        sent: boolean;
        channel: "whatsapp" | "manual";
        expiresAt: string;
        message: string;
        deliveryError: string | null;
        phone: string;
    }>;
    listApplications(status?: string): Promise<any[]>;
    approveApplication(applicationId: string, adminEmail: string): Promise<{
        partner: {
            id: string;
            partnerCode: string;
            fullName: string;
            phone: string;
            email: string | null;
            status: import("./partner.types.js").PartnerStatus;
            tier: import("./partner.types.js").PartnerTier;
            state: string | null;
            district: string | null;
            taluk: string | null;
            village: string | null;
            languages: string[];
            cropsExpertise: string[];
            referralSlug: string | null;
            qrToken: string | null;
            maxActiveFarmers: number;
            currentActiveFarmers: number;
            reliabilityScore: number;
            performanceScore: number;
            leadAllocationWeight: number;
            commissionEligible: boolean;
            referralUrl: string;
            territory: string | null;
            cropAdvisor: string | null;
            partnerType: string | null;
            partnerSince: string | null;
        };
        activation: null;
    } | {
        partner: {
            id: string;
            partnerCode: string;
            fullName: string;
            phone: string;
            email: string | null;
            status: import("./partner.types.js").PartnerStatus;
            tier: import("./partner.types.js").PartnerTier;
            state: string | null;
            district: string | null;
            taluk: string | null;
            village: string | null;
            languages: string[];
            cropsExpertise: string[];
            referralSlug: string | null;
            qrToken: string | null;
            maxActiveFarmers: number;
            currentActiveFarmers: number;
            reliabilityScore: number;
            performanceScore: number;
            leadAllocationWeight: number;
            commissionEligible: boolean;
            referralUrl: string;
            territory: string | null;
            cropAdvisor: string | null;
            partnerType: string | null;
            partnerSince: string | null;
        };
        activation: {
            sent: boolean;
            channel: "whatsapp" | "manual";
            expiresAt: string;
            message: string;
            deliveryError: string | null;
            phone: string;
        };
    }>;
    rejectApplication(applicationId: string, adminEmail: string, notes?: string): Promise<any>;
    advanceStage(applicationId: string, stage: string, adminEmail: string, notes?: string): Promise<any>;
};
//# sourceMappingURL=partner-onboarding.service.d.ts.map