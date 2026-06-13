export declare const partnerEnrollmentService: {
    resolvePartnerFromCode(partnerCode?: string | null, qrToken?: string | null): Promise<{
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
    } | null>;
    enrollFarmerWithPartner(input: {
        farmerId: string;
        phone: string;
        name?: string;
        partnerCode?: string | null;
        qrToken?: string | null;
        enrollmentSource?: string;
    }): Promise<{
        enrolled: false;
        partner: null;
    } | {
        enrolled: true;
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
        };
    }>;
    enrollByPhone(input: {
        phone: string;
        name?: string;
        partnerCode?: string | null;
        qrToken?: string | null;
    }): Promise<{
        farmerId: string;
        alreadyEnrolled: boolean;
        partner: null;
    } | {
        enrolled: false;
        partner: null;
        farmerId: string;
        alreadyEnrolled: boolean;
    } | {
        enrolled: true;
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
        };
        farmerId: string;
        alreadyEnrolled: boolean;
    }>;
    listPartnerFarmers(partnerId: string, limit?: number): Promise<{
        id: any;
        name: any;
        phone: any;
        village: any;
        district: any;
        service_model: any;
        created_at: any;
    }[]>;
};
//# sourceMappingURL=partner-enrollment.service.d.ts.map