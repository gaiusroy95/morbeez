import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterDispatchQueue,
  filterLrPending,
  filterPackQueue,
  filterPickQueue,
  isPickingQueueOrder,
  isWarehouseManagerRole,
  queueFilterBucket,
  warehouseModulesForRole,
} from '../../packages/shared/src/api/warehouse-queue.ts';
import type { QueueOrder } from '../../packages/shared/src/types/warehouse.ts';

function row(partial: Partial<QueueOrder> & Pick<QueueOrder, 'id' | 'orderName' | 'omsStatus'>): QueueOrder {
  return {
    courier: 'Manual',
    itemCount: 1,
    priority: 'normal',
    awb: null,
    pickListId: null,
    shiprocketError: null,
    ...partial,
  };
}

describe('warehouse queue helpers', () => {
  it('maps LR pending bucket', () => {
    assert.equal(
      queueFilterBucket(row({ id: '1', orderName: '#1', omsStatus: 'awaiting_tracking' })),
      'lr_pending'
    );
  });

  it('filters pick queue tabs', () => {
    const orders = [
      row({ id: '1', orderName: '#1', omsStatus: 'picking', pickListId: 'pl-1' }),
      row({
        id: '2',
        orderName: '#2',
        omsStatus: 'assigned',
        pickListId: 'pl-2',
        stockIssue: 'no_stock_reserved',
      }),
    ];
    assert.equal(filterPickQueue(orders, 'all').length, 2);
    assert.equal(filterPickQueue(orders, 'on_hold').length, 1);
    assert.equal(isPickingQueueOrder(orders[0]!), true);
  });

  it('filters dispatch and LR queues', () => {
    const orders = [
      row({ id: '1', orderName: '#1', omsStatus: 'ready_dispatch' }),
      row({ id: '2', orderName: '#2', omsStatus: 'awaiting_tracking' }),
    ];
    assert.equal(filterDispatchQueue(orders).length, 1);
    assert.equal(filterLrPending(orders).length, 1);
  });

  it('filters pack queue by packing statuses', () => {
    const orders = [
      row({ id: '1', orderName: '#1', omsStatus: 'packing' }),
      row({ id: '2', orderName: '#2', omsStatus: 'ready_dispatch' }),
      row({ id: '3', orderName: '#3', omsStatus: 'packaging_estimated' }),
    ];
    assert.equal(filterPackQueue(orders).length, 2);
  });
});

describe('warehouseModulesForRole', () => {
  it('restricts picker_packer to picking', () => {
    assert.deepEqual(warehouseModulesForRole('picker_packer'), ['picking', 'more']);
  });

  it('gives managers all tabs', () => {
    assert.ok(warehouseModulesForRole('warehouse').includes('dashboard'));
    assert.ok(warehouseModulesForRole('admin').includes('dispatch'));
  });

  it('identifies manager roles for batch assign', () => {
    assert.equal(isWarehouseManagerRole('warehouse'), true);
    assert.equal(isWarehouseManagerRole('picker_packer'), false);
  });
});
