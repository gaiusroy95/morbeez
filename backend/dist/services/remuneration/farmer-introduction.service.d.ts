export declare const farmerIntroductionService: {
    createFromEnrollment(input: {
        farmerId: string;
        partnerId: string;
        mobile?: string | null;
        source?: string;
    }): Promise<{
        id: any;
    } | null>;
    refresh(introductionId: string): Promise<any>;
    refreshForFarmer(farmerId: string): Promise<void>;
    scanPending(limit?: number): Promise<{
        scanned: number;
    }>;
    list(opts?: {
        partnerId?: string;
        status?: string;
        limit?: number;
    }): Promise<{
        id: any;
        partner_id: any;
        farmer_id: any;
        qualification_status: any;
        acreage: any;
        cash_reward_amount: any;
        product_reward_max: any;
        product_reward_used: any;
        product_reward_balance: any;
        pending_reasons: any;
        created_at: any;
        farmer_mobile: any;
        location: any;
    }[]>;
    summaryForPartner(partnerId: string): Promise<{
        farmersIntroduced: number;
        farmersVerified: number;
        eligibleIntroductions: number;
        cashRewardEarned: number;
        productRewardMax: number;
        productRewardUsed: number;
        productRewardBalance: number;
    }>;
};
//# sourceMappingURL=farmer-introduction.service.d.ts.map