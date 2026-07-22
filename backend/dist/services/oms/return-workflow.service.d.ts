type ReturnLine = {
    sku?: string;
    productTitle: string;
    qty: number;
    batchCode?: string;
};
export declare const returnWorkflowService: {
    createRequest(input: {
        commerceOrderId: string;
        reason: string;
        customerComplaint?: string;
        lines?: ReturnLine[];
        createdBy?: string;
    }): Promise<any>;
    list(opts?: {
        status?: string;
        limit?: number;
    }): Promise<any[]>;
    get(returnId: string): Promise<any>;
    markVerificationPending(returnId: string, actorEmail?: string): Promise<any>;
    approveReturn(returnId: string, input: {
        refundType: "full" | "partial" | "none";
        refundAmount?: number;
        approvedBy?: string;
    }): Promise<any>;
    rejectReturn(returnId: string, reason: string, actorEmail?: string): Promise<any>;
    markReceived(returnId: string, actorEmail?: string): Promise<any>;
    inspectReturn(returnId: string, input: {
        productCondition: "resalable" | "damaged" | "quarantine" | "unknown";
        inspectionNotes?: string;
        stockAction: "resalable" | "damaged" | "quarantine" | "writeoff";
        inspectedBy?: string;
    }): Promise<any>;
    processRefund(returnId: string, actorEmail?: string): Promise<{
        returnRequest: any;
        creditNote: any;
    }>;
    patchStatus(returnId: string, status: string, actorEmail?: string, actionType?: string): Promise<any>;
};
export {};
//# sourceMappingURL=return-workflow.service.d.ts.map