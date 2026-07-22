export declare const partnerEventsService: {
    list(partnerId?: string): Promise<any[]>;
    create(input: {
        partnerId: string;
        eventCode: string;
        name: string;
        crop?: string;
        district?: string;
        startsAt: string;
        endsAt?: string;
    }): Promise<any>;
    approve(id: string, adminEmail: string): Promise<any>;
};
export declare const partnerTerritoryService: {
    listForPartner(partnerId: string): Promise<any[]>;
    upsertPincode(partnerId: string, pincode: string, isPrimary?: boolean): Promise<any>;
    partnerIdsForPincode(pincode: string): Promise<string[]>;
};
//# sourceMappingURL=partner-events.service.d.ts.map