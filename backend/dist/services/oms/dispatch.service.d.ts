export declare const dispatchService: {
    startSession(commerceOrderId: string): Promise<any>;
    scanAwb(dispatchSessionId: string, scannedCode: string, actorEmail?: string): Promise<{
        ok: boolean;
        error: string;
        commerceOrderId?: undefined;
    } | {
        ok: boolean;
        commerceOrderId: any;
        error?: undefined;
    }>;
    getSessionForOrder(commerceOrderId: string): Promise<any>;
    confirmDispatch(commerceOrderId: string, actorEmail?: string): Promise<{
        ok: boolean;
        error: string;
        commerceOrderId?: undefined;
    } | {
        ok: boolean;
        commerceOrderId: any;
        error?: undefined;
    }>;
};
//# sourceMappingURL=dispatch.service.d.ts.map