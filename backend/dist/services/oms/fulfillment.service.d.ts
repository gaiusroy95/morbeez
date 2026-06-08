declare const EXCEPTION_TYPES: readonly ["stock_missing", "wrong_barcode", "reprint_label", "courier_failed", "weight_mismatch"];
export type FulfillmentExceptionType = (typeof EXCEPTION_TYPES)[number];
export declare const fulfillmentService: {
    getStats(): Promise<{
        pendingOrders: number;
        readyToPack: number;
        packedToday: number;
        courierPending: number;
        failedAwb: number;
    }>;
    getQueue(opts?: {
        limit?: number;
    }): Promise<{
        id: any;
        orderName: any;
        courier: any;
        itemCount: number;
        priority: any;
        omsStatus: any;
        awb: any;
        pickListId: string;
        shiprocketError: any;
        isCod: any;
        totalAmount: any;
    }[]>;
    getOrderDetail(commerceOrderId: string): Promise<{
        order: any;
        pickList: Record<string, unknown>;
        packSession: any;
        invoice: {
            id: any;
            invoice_number: any;
            document_type: any;
        } | null;
        suggestedDispatchRack: string | null;
        printEnabled: boolean;
    }>;
    provisionShipment(commerceOrderId: string, actorEmail?: string): Promise<import("../shiprocket/shiprocket.service.js").ShiprocketProvisionResult>;
    markPackedForOrder(commerceOrderId: string, actorEmail?: string): Promise<{
        invoice: any;
        pickListId: string;
    }>;
    markPacked(pickListId: string, actorEmail?: string): Promise<{
        invoice: any;
        pickListId: string;
    }>;
    markLabelPrinted(commerceOrderId: string, actorEmail?: string): Promise<{
        ok: boolean;
    }>;
    assignDispatchRack(commerceOrderId: string, rack: string): Promise<{
        ok: boolean;
        rack: string;
    }>;
    reportException(commerceOrderId: string, type: FulfillmentExceptionType, note?: string, actorEmail?: string): Promise<{
        ok: boolean;
        retried: boolean;
        awb: string | null;
        type?: undefined;
        note?: undefined;
    } | {
        ok: boolean;
        type: "stock_missing" | "wrong_barcode" | "reprint_label" | "courier_failed" | "weight_mismatch";
        note: string | null;
        retried?: undefined;
        awb?: undefined;
    }>;
    getPickListIdForOrder(commerceOrderId: string): Promise<string>;
    ensurePackSession(pickListId: string): Promise<any>;
    ensurePackSessionForOrder(commerceOrderId: string): Promise<any>;
    scan(packSessionId: string, code: string): Promise<{
        ok: boolean;
        phase: string;
        error: string;
        rack?: undefined;
        message?: undefined;
        productTitle?: undefined;
        scannedQty?: undefined;
        requiredQty?: undefined;
        scanComplete?: undefined;
        printEnabled?: undefined;
    } | {
        ok: boolean;
        phase: string;
        rack: string;
        message: string;
        error?: undefined;
        productTitle?: undefined;
        scannedQty?: undefined;
        requiredQty?: undefined;
        scanComplete?: undefined;
        printEnabled?: undefined;
    } | {
        phase: string;
        ok: boolean;
        line: any;
        productTitle: any;
        sku: any;
        batchCode: any;
        error?: undefined;
        rack?: undefined;
        message?: undefined;
        scannedQty?: undefined;
        requiredQty?: undefined;
        scanComplete?: undefined;
        printEnabled?: undefined;
    } | {
        ok: boolean;
        phase: string;
        productTitle: any;
        scannedQty: number;
        requiredQty: number;
        scanComplete: boolean;
        printEnabled: boolean;
        message: string;
        error?: undefined;
        rack?: undefined;
    }>;
    confirmOrder(commerceOrderId: string): Promise<any>;
    ensureInvoice(commerceOrderId: string): Promise<any>;
};
export {};
//# sourceMappingURL=fulfillment.service.d.ts.map