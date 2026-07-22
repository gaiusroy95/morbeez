export declare const pickListService: {
    generateForOrder(commerceOrderId: string, createdBy?: string): Promise<any>;
    rebuildPickList(pickListId: string, createdBy?: string): Promise<any>;
    getPickList(pickListId: string): Promise<any>;
    listPickLists(opts?: {
        status?: string;
        limit?: number;
    }): Promise<any[]>;
    markLinePicked(pickListLineId: string, qty?: number): Promise<any>;
    manualVerifyLine(pickListLineId: string): Promise<any>;
    completePicking(pickListId: string): Promise<any>;
    assignPicker(pickListId: string, pickerId: string): Promise<any>;
    resolveRackLocationForLine(line: {
        allocation_id?: string | null;
        batch_id?: string | null;
    }): Promise<string | null>;
    refreshRackLocations(pickListId: string): Promise<number>;
};
//# sourceMappingURL=pick-list.service.d.ts.map