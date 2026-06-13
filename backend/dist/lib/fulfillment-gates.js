/** Mirrors packages/shared/src/fulfillment/fulfillment-gates.ts (backend has no shared dep). */
export function normalizeFulfillmentShippingMethod(raw) {
    return raw === 'manual' ? 'manual' : 'shiprocket';
}
export function isPackageConfirmedForCourier(status) {
    return status === 'confirmed' || status === 'label_generated';
}
export const POST_PICK_OMS_STATUSES = [
    'packing',
    'packaging_estimated',
    'packed',
    'ready_dispatch',
    'awaiting_label_verification',
    'awaiting_tracking',
    'ready_for_courier',
    'awb_generated',
    'label_generated',
    'shipped',
    'delivered',
    'completed',
];
export function resolvePickComplete(input) {
    if (Boolean(input.scanComplete))
        return true;
    if (input.rawWorkflowStage === 'pack' || input.rawWorkflowStage === 'print')
        return true;
    const status = String(input.omsStatus ?? '');
    if (POST_PICK_OMS_STATUSES.includes(status))
        return true;
    if (input.pickListStatus === 'packed')
        return true;
    if (input.workflowRacks?.length && input.workflowRacks.every((r) => r.complete))
        return true;
    if (isPackageConfirmedForCourier(input.packageStatus))
        return true;
    return false;
}
export function computeFulfillmentGates(input) {
    const shippingMethod = normalizeFulfillmentShippingMethod(input.shippingMethod);
    const packageConfirmed = isPackageConfirmedForCourier(input.packageStatus);
    const pickComplete = Boolean(input.pickComplete);
    const hasAwb = Boolean(String(input.trackingAwb ?? '').trim());
    const packRequired = pickComplete && !packageConfirmed;
    const printEnabled = pickComplete && packageConfirmed && (shippingMethod === 'manual' || hasAwb);
    const awbPending = pickComplete && packageConfirmed && shippingMethod === 'shiprocket' && !hasAwb;
    return {
        pickComplete,
        packRequired,
        printEnabled,
        awbPending,
        shippingMethod,
        packageConfirmed,
    };
}
export function workflowStageFromGates(gates) {
    if (gates.printEnabled)
        return 'print';
    if (gates.pickComplete)
        return 'pack';
    return 'picking';
}
export function isPrintableDocAvailable(docType, gates) {
    if (docType === 'picking_slip')
        return gates.pickComplete;
    if (docType === 'courier_label') {
        return gates.shippingMethod === 'shiprocket' && gates.printEnabled;
    }
    if (docType === 'packing_slip' || docType === 'tax_invoice') {
        return gates.packageConfirmed;
    }
    return true;
}
export function canViewPrintChecklist(gates) {
    return gates.pickComplete && gates.packageConfirmed;
}
//# sourceMappingURL=fulfillment-gates.js.map