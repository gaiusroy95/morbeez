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
        customerName: string | null;
        courier: any;
        itemCount: number;
        orderItemCount: number;
        stockIssue: string | null;
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
        workflow: {
            stage: "picking" | "print";
            step: number;
            currentRack: string | null;
            racks: {
                rack: string;
                lineCount: number;
                totalQty: number;
                pickedQty: number;
                complete: boolean;
                active: boolean;
            }[];
            currentRackLines: {
                row: number;
                id: string;
                productTitle: string;
                sku: string | null;
                batchCode: string | null;
                qtyRequired: number;
                qtyPicked: number;
                remaining: number;
                complete: boolean;
            }[];
            printEnabled: boolean;
        } | null;
        customerSummary: {
            phone: any;
            address: string | null;
            isCod: boolean;
            totalAmount: any;
        };
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
    rebuildPickListForOrder(commerceOrderId: string, actorEmail?: string): Promise<any>;
    getPickListIdForOrder(commerceOrderId: string): Promise<string>;
    ensurePackSession(pickListId: string): Promise<Record<string, unknown> & {
        id: string;
        pick_lists?: {
            commerce_order_id?: string;
            pick_list_lines?: import("./rack-pick.service.js").RackPickLine[];
        };
    }>;
    ensurePackSessionForOrder(commerceOrderId: string): Promise<Record<string, unknown> & {
        id: string;
        pick_lists?: {
            commerce_order_id?: string;
            pick_list_lines?: import("./rack-pick.service.js").RackPickLine[];
        };
    }>;
    lookupBarcode(packSessionId: string, code: string): Promise<{
        ok: boolean;
        error: string;
        lineId?: undefined;
        productTitle?: undefined;
        sku?: undefined;
        batchCode?: undefined;
        qtyRequired?: undefined;
        qtyPicked?: undefined;
        remaining?: undefined;
        defaultQty?: undefined;
    } | {
        ok: boolean;
        lineId: string;
        productTitle: string;
        sku: string | null;
        batchCode: any;
        qtyRequired: number;
        qtyPicked: number;
        remaining: number;
        defaultQty: number;
        error?: undefined;
    }>;
    confirmPick(packSessionId: string, lineId: string, qty: number): Promise<{
        ok: boolean;
        lineComplete: boolean;
        rackComplete: boolean;
        advancedToRack: string | null;
        stage: "picking" | "print";
        printEnabled: boolean;
        workflow: {
            stage: "picking" | "print";
            step: number;
            currentRack: string | null;
            racks: {
                rack: string;
                lineCount: number;
                totalQty: number;
                pickedQty: number;
                complete: boolean;
                active: boolean;
            }[];
            currentRackLines: {
                row: number;
                id: string;
                productTitle: string;
                sku: string | null;
                batchCode: string | null;
                qtyRequired: number;
                qtyPicked: number;
                remaining: number;
                complete: boolean;
            }[];
            printEnabled: boolean;
        };
        message: string;
    }>;
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