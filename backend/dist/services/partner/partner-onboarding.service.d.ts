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
    }): Promise<any>;
    listApplications(status?: string): Promise<any[]>;
    approveApplication(applicationId: string, adminEmail: string): Promise<{
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
    }>;
    rejectApplication(applicationId: string, adminEmail: string, notes?: string): Promise<any>;
    advanceStage(applicationId: string, stage: string, adminEmail: string, notes?: string): Promise<any>;
};
//# sourceMappingURL=partner-onboarding.service.d.ts.map