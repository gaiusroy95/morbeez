export declare const bulkMarginReviewService: {
    isApprovedForQuote(quoteId: string): Promise<boolean>;
    createRequest(input: {
        quoteId: string;
        leadId?: string | null;
        adminUserId?: string | null;
        employeeProfileId?: string | null;
        orderValueInr: number;
        grossProfitInr: number;
        grossMarginPct: number;
        requestedByName?: string;
    }): Promise<any>;
    approve(reviewId: string, reviewerId: string, notes?: string): Promise<any>;
    reject(reviewId: string, reviewerId: string, notes?: string): Promise<any>;
    listPending(limit?: number): Promise<any[]>;
};
//# sourceMappingURL=bulk-margin-review.service.d.ts.map