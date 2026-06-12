/** Mirrors packages/shared/src/fulfillment/fulfillment-gates.ts (backend has no shared dep). */

export type FulfillmentShippingMethod = 'shiprocket' | 'manual';

export function normalizeFulfillmentShippingMethod(raw?: string | null): FulfillmentShippingMethod {
  return raw === 'manual' ? 'manual' : 'shiprocket';
}

export function isPackageConfirmedForCourier(status?: string | null): boolean {
  return status === 'confirmed' || status === 'label_generated';
}

export type FulfillmentGates = {
  pickComplete: boolean;
  packRequired: boolean;
  printEnabled: boolean;
  awbPending: boolean;
  shippingMethod: FulfillmentShippingMethod;
  packageConfirmed: boolean;
};

export function computeFulfillmentGates(input: {
  pickComplete: boolean;
  packageStatus?: string | null;
  shippingMethod?: string | null;
  trackingAwb?: string | null;
}): FulfillmentGates {
  const shippingMethod = normalizeFulfillmentShippingMethod(input.shippingMethod);
  const packageConfirmed = isPackageConfirmedForCourier(input.packageStatus);
  const pickComplete = Boolean(input.pickComplete);
  const hasAwb = Boolean(String(input.trackingAwb ?? '').trim());

  const packRequired = pickComplete && !packageConfirmed;
  const printEnabled =
    pickComplete && packageConfirmed && (shippingMethod === 'manual' || hasAwb);
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

export type PickWorkflowStage = 'picking' | 'pack' | 'print';

export function workflowStageFromGates(gates: FulfillmentGates): PickWorkflowStage {
  if (gates.printEnabled) return 'print';
  if (gates.pickComplete) return 'pack';
  return 'picking';
}

export function isPrintableDocAvailable(docType: string, gates: FulfillmentGates): boolean {
  if (docType === 'picking_slip') return gates.pickComplete;
  if (docType === 'courier_label') {
    return gates.shippingMethod === 'shiprocket' && gates.printEnabled;
  }
  if (docType === 'packing_slip' || docType === 'tax_invoice') {
    if (!gates.packageConfirmed) return false;
    if (gates.shippingMethod === 'manual') return true;
    return gates.printEnabled;
  }
  return true;
}
