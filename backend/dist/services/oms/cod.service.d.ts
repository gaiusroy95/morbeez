export declare const codService: {
    recordOnOrder(commerceOrderId: string, shopifyOrderId: string): Promise<any>;
    updateRemittance(input: {
        commerceOrderId: string;
        courierRemittance: number;
        courierName?: string;
        remittanceDate?: string;
    }): Promise<any>;
    listPending(limit?: number): Promise<any[]>;
};
//# sourceMappingURL=cod.service.d.ts.map