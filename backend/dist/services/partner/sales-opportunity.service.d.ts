export declare const salesOpportunityService: {
    createForPartner(partnerId: string, farmerId: string, input: {
        product: string;
        expectedQuantity?: string;
        urgency?: string;
        interestLevel?: string;
        notes?: string;
    }): Promise<any>;
    listForPartner(partnerId: string): Promise<any[]>;
    listForTelecaller(agentEmail: string): Promise<any[]>;
    updateStatus(id: string, status: string, agentEmail?: string): Promise<any>;
    listForFarmer(farmerId: string): Promise<any[]>;
};
//# sourceMappingURL=sales-opportunity.service.d.ts.map