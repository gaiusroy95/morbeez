export declare const productRewardService: {
    applyToOrder(input: {
        orderId: string;
        farmerId: string;
        grossInr: number;
    }): Promise<{
        consumed: number;
    }>;
    restoreOrder(orderId: string): Promise<{
        restored: number;
    }>;
};
//# sourceMappingURL=product-reward.service.d.ts.map