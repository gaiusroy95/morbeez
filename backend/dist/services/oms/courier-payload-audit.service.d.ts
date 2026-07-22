export declare const courierPayloadAuditService: {
    record(input: {
        commerceOrderId: string;
        courierName?: string | null;
        payloadJson: Record<string, unknown>;
        awbNumber?: string | null;
        labelUrl?: string | null;
        apiResponse?: unknown;
        success: boolean;
    }): Promise<void>;
    listForOrder(commerceOrderId: string): Promise<any[]>;
};
//# sourceMappingURL=courier-payload-audit.service.d.ts.map