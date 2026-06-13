export declare const commissionEngineService: {
    listMaster(): Promise<any[]>;
    computeForOrder(input: {
        partnerId: string;
        farmerId: string;
        orderId: string;
        categoryKey: string;
        grossInr: number;
    }): Promise<any>;
    addSuccessBonus(partnerId: string, farmerId: string, bonusInr: number): Promise<any>;
};
//# sourceMappingURL=commission-engine.service.d.ts.map