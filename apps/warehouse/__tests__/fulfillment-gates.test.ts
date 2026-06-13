import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canViewPrintChecklist,
  computeFulfillmentGates,
  isPrintableDocAvailable,
  resolvePickComplete,
  workflowStageFromGates,
} from '../../../packages/shared/src/fulfillment/fulfillment-gates.ts';

describe('fulfillment workflow gates', () => {
  it('requires pack after pick before print', () => {
    const afterPick = computeFulfillmentGates({
      pickComplete: true,
      packageStatus: 'estimated',
      shippingMethod: 'shiprocket',
      trackingAwb: null,
    });
    assert.equal(afterPick.packRequired, true);
    assert.equal(afterPick.printEnabled, false);
    assert.equal(workflowStageFromGates(afterPick), 'pack');
  });

  it('enables shiprocket print only after AWB', () => {
    const confirmedNoAwb = computeFulfillmentGates({
      pickComplete: true,
      packageStatus: 'confirmed',
      shippingMethod: 'shiprocket',
      trackingAwb: null,
    });
    assert.equal(confirmedNoAwb.awbPending, true);
    assert.equal(confirmedNoAwb.printEnabled, false);
    assert.equal(canViewPrintChecklist(confirmedNoAwb), true);
    assert.equal(isPrintableDocAvailable('tax_invoice', confirmedNoAwb), true);
    assert.equal(isPrintableDocAvailable('packing_slip', confirmedNoAwb), true);
    assert.equal(isPrintableDocAvailable('courier_label', confirmedNoAwb), false);

    const withAwb = computeFulfillmentGates({
      pickComplete: true,
      packageStatus: 'confirmed',
      shippingMethod: 'shiprocket',
      trackingAwb: 'SR123',
    });
    assert.equal(withAwb.printEnabled, true);
    assert.equal(workflowStageFromGates(withAwb), 'print');
    assert.equal(isPrintableDocAvailable('courier_label', withAwb), true);
  });

  it('allows manual invoice print after package confirm without AWB', () => {
    const manual = computeFulfillmentGates({
      pickComplete: true,
      packageStatus: 'confirmed',
      shippingMethod: 'manual',
      trackingAwb: null,
    });
    assert.equal(manual.printEnabled, true);
    assert.equal(isPrintableDocAvailable('tax_invoice', manual), true);
    assert.equal(isPrintableDocAvailable('courier_label', manual), false);
  });

  it('treats ready_dispatch as pick complete even without scan_complete flag', () => {
    assert.equal(
      resolvePickComplete({
        scanComplete: false,
        omsStatus: 'ready_dispatch',
        packageStatus: 'confirmed',
      }),
      true
    );
  });

  it('treats all racks complete as pick complete', () => {
    assert.equal(
      resolvePickComplete({
        scanComplete: false,
        workflowRacks: [
          { complete: true },
          { complete: true },
        ],
      }),
      true
    );
  });
});
