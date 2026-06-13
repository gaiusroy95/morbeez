export declare const partnerLeadAllocationService: {
    scorePartner(partnerId: string): Promise<number>;
    allocateLeadToPartners(leadId: string, farmerId?: string | null, limit?: number): Promise<any[]>;
    respond(allocationId: string, partnerId: string, action: "accepted" | "declined"): Promise<any>;
    listOffers(partnerId: string): Promise<any[]>;
};
//# sourceMappingURL=partner-lead-allocation.service.d.ts.map