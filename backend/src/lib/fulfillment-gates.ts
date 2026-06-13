/** Mirrors packages/shared/src/fulfillment/fulfillment-gates.ts (backend has no shared dep). */

export type FulfillmentShippingMethod = 'shiprocket' | 'manual';

export function normalizeFulfillmentShippingMethod(raw?: string | null): FulfillmentShippingMethod {
  return raw === 'manual' ? 'manual' : 'shiprocket';
}

export function isPackageConfirmedForCourier(status?: string | null): boolean {
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
] as const;

export function resolvePickComplete(input: {
  scanComplete?: boolean | null;
  omsStatus?: string | null;
  workflowRacks?: Array<{ complete?: boolean }> | null;
  rawWorkflowStage?: string | null;
  packageStatus?: string | null;
  pickListStatus?: string | null;
}): boolean {
  if (Boolean(input.scanComplete)) return true;
  if (input.rawWorkflowStage === 'pack' || input.rawWorkflowStage === 'print') return true;

  const status = String(input.omsStatus ?? '');
  if ((POST_PICK_OMS_STATUSES as readonly string[]).includes(status)) return true;
  if (input.pickListStatus === 'packed') return true;

  if (input.workflowRacks?.length && input.workflowRacks.every((r) => r.complete)) return true;
  if (isPackageConfirmedForCourier(input.packageStatus)) return true;

  return false;
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
    return gates.packageConfirmed;
  }
  return true;
}

export function canViewPrintChecklist(gates: FulfillmentGates): boolean {
  return gates.pickComplete && gates.packageConfirmed;
}
