import { type FulfillmentGates } from '../../lib/fulfillment-gates.js';
declare const EXCEPTION_TYPES: readonly ["stock_missing", "wrong_barcode", "reprint_label", "courier_failed", "weight_mismatch"];
export type FulfillmentExceptionType = (typeof EXCEPTION_TYPES)[number];
declare function repairPendingCommerceOrders(limit?: number): Promise<{
    repaired: number;
    failed: number;
    scanned: number;
}>;
export declare const fulfillmentService: {
    repairPendingCommerceOrders: typeof repairPendingCommerceOrders;
    getStats(): Promise<{
        pending: number;
        packed: number;
        lrPending: number;
        completed: number;
        pendingOrders: number;
        picking: number;
        packing: number;
        readyToPack: number;
        readyDispatch: number;
        awaitingTracking: number;
        packedToday: number;
        handedOverToday: number;
        courierPending: number;
        failedAwb: number;
    }>;
    getCompletedToday(opts?: {
        limit?: number;
    }): Promise<{
        packedToday: {
            id: unknown;
            orderName: {};
            customerName: string | null;
            courier: {};
            itemCount: number;
            orderItemCount: number;
            stockIssue: string | null;
            missingProducts: (string | undefined)[];
            priority: {};
            omsStatus: unknown;
            shippingMethod: import("../../lib/manual-couriers.js").ShippingMethod;
            trackingStatus: string | null;
            needsManualTracking: boolean;
            awb: unknown;
            pickListId: string;
            shiprocketError: string | null;
            isCod: unknown;
            totalAmount: unknown;
            createdAt: unknown;
            packedAt: string | null;
            shippedAt: string | null;
            assignedEmployee: string | null;
        }[];
        handedOverToday: {
            id: unknown;
            orderName: {};
            customerName: string | null;
            courier: {};
            itemCount: number;
            orderItemCount: number;
            stockIssue: string | null;
            missingProducts: (string | undefined)[];
            priority: {};
            omsStatus: unknown;
            shippingMethod: import("../../lib/manual-couriers.js").ShippingMethod;
            trackingStatus: string | null;
            needsManualTracking: boolean;
            awb: unknown;
            pickListId: string;
            shiprocketError: string | null;
            isCod: unknown;
            totalAmount: unknown;
            createdAt: unknown;
            packedAt: string | null;
            shippedAt: string | null;
            assignedEmployee: string | null;
        }[];
    }>;
    repairStalePickLists(): Promise<{
        repaired: number;
        failed: number;
        errors: {
            orderId: string;
            orderName?: string;
            message: string;
        }[];
        syncedVariants: number;
        syncedQty: number;
        variantCount: number;
    }>;
    getQueue(opts?: {
        limit?: number;
        repair?: boolean;
    }): Promise<{
        id: unknown;
        orderName: {};
        customerName: string | null;
        courier: {};
        itemCount: number;
        orderItemCount: number;
        stockIssue: string | null;
        missingProducts: (string | undefined)[];
        priority: {};
        omsStatus: unknown;
        shippingMethod: import("../../lib/manual-couriers.js").ShippingMethod;
        trackingStatus: string | null;
        needsManualTracking: boolean;
        awb: unknown;
        pickListId: string;
        shiprocketError: string | null;
        isCod: unknown;
        totalAmount: unknown;
        createdAt: unknown;
        packedAt: string | null;
        shippedAt: string | null;
        assignedEmployee: string | null;
    }[]>;
    getOrderDetail(commerceOrderId: string): Promise<{
        order: any;
        pickList: Record<string, unknown>;
        packSession: any;
        invoice: {
            id: string;
            invoice_number: string;
            document_type: string;
        } | null;
        shippingMethod: import("../../lib/manual-couriers.js").ShippingMethod;
        awbAssignAvailable: boolean;
        suggestedDispatchRack: string | null;
        printEnabled: boolean;
        workflow: {
            stage: "pack" | "picking";
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
            pickComplete: boolean;
            printEnabled: boolean;
        } | null;
        shiprocketDiagnostics: import("../shiprocket/shiprocket.service.js").ShiprocketDiagnostics | null;
        shiprocketErrorDisplay: string | null;
        assignment: {
            employeeId: string | null;
            employeeName: string | null;
            batchId: string | null;
            pickingStartedAt: any;
            labelVerifiedAt: any;
        };
        shippingLabel: {
            id: string;
            qrCode: string;
            labelVerified: boolean;
            verifiedAt: any;
            printSequence: number;
        } | null;
        labelBatch: {
            id: any;
            batch_number: any;
            assigned_employee_name: any;
            batch_status: any;
            printed_at: any;
        } | null;
        customerSummary: {
            phone: any;
            address: string | null;
            isCod: boolean;
            totalAmount: any;
        };
        package: {
            status: string;
            suggestedBoxCode: string;
            suggestedBoxName: string;
            packagingCategoryName: string | null;
            matchedRuleId: string | null;
            boxSelectionSource: {} | null;
            lengthCm: number;
            breadthCm: number;
            heightCm: number;
            estimatedWeightKg: number;
            packageWeightKg: number;
            volumetricWeightKg: number;
            billingWeightKg: number;
            boxCount: number;
            overridden: boolean;
            confirmedAt: any;
            courierPayload: {
                length: number;
                breadth: number;
                height: number;
                weight: number;
            };
            lines: import("./package-rule-engine.service.js").PackageLineInsight[];
        } | null;
    } & {
        pickComplete: boolean;
        printEnabled: boolean;
        fulfillmentGates: FulfillmentGates;
        workflow: {
            stage: string;
            step: number;
            currentRack: string | null;
            racks: unknown[];
            currentRackLines: unknown[];
            printEnabled?: boolean;
            pickComplete?: boolean;
        } | null | undefined;
    }>;
    estimatePackage(commerceOrderId: string): Promise<import("./package-rule-engine.service.js").PackageEstimate>;
    confirmPackage(commerceOrderId: string, actorEmail?: string, opts?: {
        autoAwb?: boolean;
    }): Promise<import("./package-rule-engine.service.js").PackageEstimate>;
    overridePackage(commerceOrderId: string, input: {
        boxId?: string;
        lengthCm: number;
        breadthCm: number;
        heightCm: number;
        weightKg: number;
    }, actorEmail?: string): Promise<import("./package-rule-engine.service.js").PackageEstimate>;
    selectPackageBox(commerceOrderId: string, boxId: string, boxCount?: number): Promise<import("./package-rule-engine.service.js").PackageEstimate>;
    listShippingBoxes(): Promise<import("./shipping-box.service.js").ShippingBox[]>;
    setShippingMethod(commerceOrderId: string, method: "shiprocket" | "manual", actorEmail?: string): Promise<any>;
    saveManualLogistics(commerceOrderId: string, input: {
        courierName: string;
        trackingAwb: string;
        trackingUrl?: string | null;
        notifyCustomer?: boolean;
    }, actorEmail?: string): Promise<any>;
    provisionShipment(commerceOrderId: string, actorEmail?: string, opts?: {
        forceRecreate?: boolean;
    }): Promise<import("../shiprocket/shiprocket.service.js").ShiprocketProvisionResult>;
    markPackedForOrder(commerceOrderId: string, actorEmail?: string): Promise<{
        ok: boolean;
        commerceOrderId: string;
        status: string;
    }>;
    markPacked(pickListId: string, actorEmail?: string): Promise<{
        ok: boolean;
        commerceOrderId: string;
        status: string;
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
        type: "reprint_label";
        note: string | null;
        manual: boolean;
        retried?: undefined;
        awb?: undefined;
    } | {
        ok: boolean;
        retried: boolean;
        awb: string | null;
        type?: undefined;
        note?: undefined;
        manual?: undefined;
    } | {
        ok: boolean;
        type: "stock_missing" | "wrong_barcode" | "reprint_label" | "courier_failed" | "weight_mismatch";
        note: string | null;
        manual?: undefined;
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
        advancedToRack: null;
        stage: "pack" | "picking";
        pickComplete: boolean;
        printEnabled: boolean;
        workflow: {
            stage: "pack" | "picking";
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
            pickComplete: boolean;
            printEnabled: boolean;
        };
        message: string;
    }>;
    advanceToNextRack(packSessionId: string): Promise<{
        ok: boolean;
        stage: "pack";
        pickComplete: boolean;
        printEnabled: boolean;
        workflow: {
            stage: "pack" | "picking";
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
            pickComplete: boolean;
            printEnabled: boolean;
        };
        message: string;
        advancedToRack?: undefined;
    } | {
        ok: boolean;
        stage: "pack" | "picking";
        pickComplete: boolean;
        printEnabled: boolean;
        advancedToRack: string | null;
        workflow: {
            stage: "pack" | "picking";
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
            pickComplete: boolean;
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
    getOrderTimeline(commerceOrderId: string): Promise<{
        key: string;
        label: string;
        status: "pending" | "done" | "current";
        at: string | null;
        detail: string | null;
    }[]>;
};
export {};
//# sourceMappingURL=fulfillment.service.d.ts.map