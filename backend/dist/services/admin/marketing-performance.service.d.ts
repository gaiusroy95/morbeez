import { type LeadChannel } from '../../domain/marketing/lead-attribution.js';
export type MarketingPerformanceQuery = {
    from: string;
    to: string;
    ownerId?: string;
    campaign?: string;
    channel?: LeadChannel | string;
};
export type FunnelCounts = {
    leads: number;
    connected: number;
    interested: number;
    booked: number;
    paid: number;
    revenueInr: number;
    conversionPct: number;
    suggestedBonusInr?: number;
    spendInr?: number;
    roi?: number | null;
};
export declare const marketingPerformanceService: {
    getOverview(query: MarketingPerformanceQuery): Promise<{
        period: {
            from: string;
            to: string;
        };
        funnel: FunnelCounts;
        unattributedCount: number;
        queueHealth: {
            newMetaLeadsWaiting: number;
            oldestWaitingHours: number | null;
            slaTargetHours: number;
        };
        incentiveRule: {
            ruleName: any;
            flatConnectedInr: number;
            flatBookedInr: number;
            flatPaidInr: number;
            monthlyCapInr: number | null;
        } | null;
    }>;
    getByMarketer(query: MarketingPerformanceQuery): Promise<{
        suggestedBonusInr: number;
        leads: number;
        connected: number;
        interested: number;
        booked: number;
        paid: number;
        revenueInr: number;
        conversionPct: number;
        spendInr?: number;
        roi?: number | null;
        marketerId: string | null;
        marketerName: string;
    }[]>;
    getByCampaign(query: MarketingPerformanceQuery): Promise<{
        spendInr: number;
        roi: number | null;
        suggestedBonusInr: number;
        leads: number;
        connected: number;
        interested: number;
        booked: number;
        paid: number;
        revenueInr: number;
        conversionPct: number;
        campaign: string;
        channel: string | null;
    }[]>;
    getFunnelDrilldown(leadIds: string[]): Promise<{
        connected?: boolean | undefined;
        interested?: boolean | undefined;
        booked?: boolean | undefined;
        paid?: boolean | undefined;
        revenueInr?: number | undefined;
        leadId: string;
        farmerName: {} | null;
        phone: {} | null;
        stage: string;
        channel: string | null;
        campaign: string | null;
    }[]>;
    listMarketingOwners(): Promise<{
        id: any;
        fullName: any;
        department: any;
    }[]>;
};
export declare function dateRangeFromDays(days: number): {
    from: string;
    to: string;
};
//# sourceMappingURL=marketing-performance.service.d.ts.map