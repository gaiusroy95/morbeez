export declare const ndrRtoService: {
    NDR_REASONS: readonly ["customer_unreachable", "refused_delivery", "wrong_address", "future_delivery_request"];
    createFromCourierUpdate(input: {
        shopifyOrderId: string;
        exceptionType: "ndr" | "rto" | "delay" | "lost";
        reason?: string;
        courierPayload?: Record<string, unknown>;
    }): Promise<any>;
    listOpen(limit?: number): Promise<any[]>;
    resolveException(exceptionId: string, action: "reattempt" | "rto_received" | "restocked" | "written_off", qcStatus?: "pass" | "damage"): Promise<any>;
    restockFromRto(commerceOrderId: string, asDamaged?: boolean): Promise<void>;
    detectFromTrackingStatus(shopifyOrderId: string | undefined, status: string, payload: Record<string, unknown>): Promise<any>;
};
//# sourceMappingURL=ndr-rto.service.d.ts.map