/** Mirrors packages/shared/src/fulfillment/fulfillment-gates.ts (backend has no shared dep). */
export function normalizeFulfillmentShippingMethod(raw) {
    return raw === 'manual' ? 'manual' : 'shiprocket';
}
export function isPackageConfirmedForCourier(status) {
    return status === 'confirmed' || status === 'label_generated';
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
        if (!gates.packageConfirmed)
            return false;
        if (gates.shippingMethod === 'manual')
            return true;
        return gates.printEnabled;
    }
    return true;
}
//# sourceMappingURL=fulfillment-gates.js.map