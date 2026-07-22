export declare const partnerAuthService: {
    sendOtp(phoneRaw: string, ipAddress?: string): Promise<{
        devOtp?: string | undefined;
        sent: boolean;
        expiresInSeconds: number;
    }>;
    verifyOtp(phoneRaw: string, codeRaw: string): Promise<{
        token: string;
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
    loginWithPassword(phoneRaw: string, password: string): Promise<{
        token: string;
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
    setPassword(partnerId: string, password: string): Promise<{
        ok: true;
    }>;
};
//# sourceMappingURL=partner-auth.service.d.ts.map