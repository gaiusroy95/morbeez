export declare const disputeService: {
    list(filter?: {
        status?: string;
        partyType?: string;
        partyId?: string;
    }): Promise<any[]>;
    open(input: {
        partyType: "partner" | "employee";
        partyId: string;
        earningSource: "partner_ledger" | "agronomist_ledger";
        earningId: string;
        amountInr: number;
        reason: string;
        orderId?: string | null;
        openedBy?: string | null;
    }): Promise<any>;
    resolve(id: string, status: "upheld" | "rejected", actor?: string, notes?: string): Promise<any>;
};
//# sourceMappingURL=dispute.service.d.ts.map