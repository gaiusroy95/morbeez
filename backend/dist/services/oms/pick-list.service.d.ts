export declare const pickListService: {
    generateForOrder(commerceOrderId: string, createdBy?: string): Promise<any>;
    getPickList(pickListId: string): Promise<any>;
    listPickLists(opts?: {
        status?: string;
        limit?: number;
    }): Promise<any[]>;
    markLinePicked(pickListLineId: string, qty?: number): Promise<any>;
    manualVerifyLine(pickListLineId: string): Promise<any>;
    completePicking(pickListId: string): Promise<any>;
};
//# sourceMappingURL=pick-list.service.d.ts.map