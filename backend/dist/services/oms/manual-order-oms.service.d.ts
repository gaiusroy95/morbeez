export declare const manualOrderOmsService: {
    pushToOms(manualOrderId: string, actorEmail?: string): Promise<{
        commerceOrderId: any;
        order: any;
        alreadyLinked: boolean;
        pickList?: undefined;
    } | {
        commerceOrderId: any;
        pickList: any;
        alreadyLinked: boolean;
        order?: undefined;
    }>;
    tryPushOnCreate(manualOrderId: string, actorEmail?: string): Promise<{
        commerceOrderId: any;
        order: any;
        alreadyLinked: boolean;
        pickList?: undefined;
    } | {
        commerceOrderId: any;
        pickList: any;
        alreadyLinked: boolean;
        order?: undefined;
    } | null>;
};
//# sourceMappingURL=manual-order-oms.service.d.ts.map