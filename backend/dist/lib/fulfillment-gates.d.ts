/** Mirrors packages/shared/src/fulfillment/fulfillment-gates.ts (backend has no shared dep). */
export type FulfillmentShippingMethod = 'shiprocket' | 'manual';
export declare function normalizeFulfillmentShippingMethod(raw?: string | null): FulfillmentShippingMethod;
export declare function isPackageConfirmedForCourier(status?: string | null): boolean;
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
//# sourceMappingURL=fulfillment-gates.d.ts.map