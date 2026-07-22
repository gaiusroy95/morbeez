/** Mirrors packages/shared/src/fulfillment/fulfillment-gates.ts (backend has no shared dep). */
export type FulfillmentShippingMethod = 'shiprocket' | 'manual';
export declare function normalizeFulfillmentShippingMethod(raw?: string | null): FulfillmentShippingMethod;
export declare function isPackageConfirmedForCourier(status?: string | null): boolean;
export declare const POST_PICK_OMS_STATUSES: readonly ["packing", "packaging_estimated", "packed", "ready_dispatch", "awaiting_label_verification", "awaiting_tracking", "ready_for_courier", "awb_generated", "label_generated", "shipped", "delivered", "completed"];
export declare function resolvePickComplete(input: {
    scanComplete?: boolean | null;
    omsStatus?: string | null;
    workflowRacks?: Array<{
        complete?: boolean;
    }> | null;
    rawWorkflowStage?: string | null;
    packageStatus?: string | null;
    pickListStatus?: string | null;
}): boolean;
export type FulfillmentGates = {
    pickComplete: boolean;
    packRequired: boolean;
    printEnabled: boolean;
    awbPending: boolean;
    shippingMethod: FulfillmentShippingMethod;
    packageConfirmed: boolean;
};
export declare function computeFulfillmentGates(input: {
    pickComplete: boolean;
    packageStatus?: string | null;
    shippingMethod?: string | null;
    trackingAwb?: string | null;
}): FulfillmentGates;
export type PickWorkflowStage = 'picking' | 'pack' | 'print';
export declare function workflowStageFromGates(gates: FulfillmentGates): PickWorkflowStage;
export declare function isPrintableDocAvailable(docType: string, gates: FulfillmentGates): boolean;
export declare function canViewPrintChecklist(gates: FulfillmentGates): boolean;
//# sourceMappingURL=fulfillment-gates.d.ts.map